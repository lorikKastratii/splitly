-- ============================================
-- SPLITLY DATABASE SCHEMA FOR SUPABASE
-- ============================================
-- Run this in Supabase SQL Editor:
-- Dashboard → SQL Editor → New Query → Paste this → Run

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================
-- 1. PROFILES TABLE (extends Supabase auth.users)
-- ============================================
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Auto-create profile when user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO profiles (id, email, name)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1))
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 2. GROUPS TABLE
-- ============================================
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  currency TEXT NOT NULL DEFAULT 'USD',
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for fast invite code lookups
CREATE INDEX idx_groups_invite_code ON groups(invite_code);

-- ============================================
-- 3. GROUP MEMBERS TABLE (junction table)
-- ============================================
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

CREATE INDEX idx_group_members_group ON group_members(group_id);
CREATE INDEX idx_group_members_user ON group_members(user_id);

-- ============================================
-- 4. EXPENSES TABLE
-- ============================================
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  paid_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  split_type TEXT NOT NULL DEFAULT 'equal',
  category TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_expenses_group ON expenses(group_id);

-- ============================================
-- 5. EXPENSE SPLITS TABLE
-- ============================================
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12, 2) NOT NULL,
  percentage DECIMAL(5, 2),
  UNIQUE(expense_id, user_id)
);

CREATE INDEX idx_expense_splits_expense ON expense_splits(expense_id);

-- ============================================
-- 6. SETTLEMENTS TABLE
-- ============================================
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  from_user UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_user UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amount DECIMAL(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_settlements_group ON settlements(group_id);

-- ============================================
-- 7. FRIENDS TABLE (user's personal contacts)
-- ============================================
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_user_id UUID REFERENCES profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  avatar_url TEXT,
  added_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, email)
);

CREATE INDEX idx_friends_user ON friends(user_id);

-- ============================================
-- ROW LEVEL SECURITY (RLS) POLICIES
-- ============================================

-- Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;

-- PROFILES: Users can read all profiles, update their own
CREATE POLICY "Profiles are viewable by everyone" ON profiles
  FOR SELECT USING (true);

CREATE POLICY "Users can update own profile" ON profiles
  FOR UPDATE USING (auth.uid() = id);

-- GROUPS: Members can view their groups, anyone can view for joining
CREATE POLICY "Groups viewable by members" ON groups
  FOR SELECT USING (
    id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
    OR created_by = auth.uid()
  );

CREATE POLICY "Authenticated users can create groups" ON groups
  FOR INSERT WITH CHECK (auth.uid() = created_by);

CREATE POLICY "Group creator can update" ON groups
  FOR UPDATE USING (created_by = auth.uid());

CREATE POLICY "Group creator can delete" ON groups
  FOR DELETE USING (created_by = auth.uid());

-- Special policy to allow looking up groups by invite code
CREATE POLICY "Anyone can lookup group by invite code" ON groups
  FOR SELECT USING (true);

-- GROUP_MEMBERS: Members can view, users can join/leave
CREATE POLICY "Members viewable by group members" ON group_members
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can join groups" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can leave groups" ON group_members
  FOR DELETE USING (auth.uid() = user_id);

-- EXPENSES: Group members can CRUD expenses
CREATE POLICY "Expenses viewable by group members" ON expenses
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Group members can create expenses" ON expenses
  FOR INSERT WITH CHECK (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Expense creator can update" ON expenses
  FOR UPDATE USING (paid_by = auth.uid());

CREATE POLICY "Expense creator can delete" ON expenses
  FOR DELETE USING (paid_by = auth.uid());

-- EXPENSE_SPLITS: Viewable by group members
CREATE POLICY "Splits viewable by group members" ON expense_splits
  FOR SELECT USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      JOIN group_members gm ON e.group_id = gm.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can create splits" ON expense_splits
  FOR INSERT WITH CHECK (
    expense_id IN (
      SELECT e.id FROM expenses e
      JOIN group_members gm ON e.group_id = gm.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

CREATE POLICY "Group members can delete splits" ON expense_splits
  FOR DELETE USING (
    expense_id IN (
      SELECT e.id FROM expenses e
      JOIN group_members gm ON e.group_id = gm.group_id
      WHERE gm.user_id = auth.uid()
    )
  );

-- SETTLEMENTS: Group members can CRUD
CREATE POLICY "Settlements viewable by group members" ON settlements
  FOR SELECT USING (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Group members can create settlements" ON settlements
  FOR INSERT WITH CHECK (
    group_id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );

CREATE POLICY "Settlement parties can delete" ON settlements
  FOR DELETE USING (from_user = auth.uid() OR to_user = auth.uid());

-- FRIENDS: Users manage their own friends
CREATE POLICY "Users can view own friends" ON friends
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Users can add friends" ON friends
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own friends" ON friends
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "Users can delete own friends" ON friends
  FOR DELETE USING (user_id = auth.uid());

-- ============================================
-- HELPER FUNCTIONS
-- ============================================

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- Function to get group by invite code (for joining)
CREATE OR REPLACE FUNCTION get_group_by_invite_code(code TEXT)
RETURNS TABLE (
  id UUID,
  name TEXT,
  description TEXT,
  currency TEXT,
  member_count BIGINT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    g.id,
    g.name,
    g.description,
    g.currency,
    COUNT(gm.id) as member_count
  FROM groups g
  LEFT JOIN group_members gm ON g.id = gm.group_id
  WHERE UPPER(g.invite_code) = UPPER(code)
  GROUP BY g.id, g.name, g.description, g.currency;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- ============================================
-- DONE! Your database is ready.
-- ============================================
