-- ============================================
-- RESET DATABASE AND ADD USERNAME SUPPORT
-- Run this in Supabase SQL Editor
-- ============================================

-- Step 1: Drop all existing tables (cascade will handle dependencies)
DROP TABLE IF EXISTS expense_splits CASCADE;
DROP TABLE IF EXISTS expenses CASCADE;
DROP TABLE IF EXISTS settlements CASCADE;
DROP TABLE IF EXISTS group_members CASCADE;
DROP TABLE IF EXISTS groups CASCADE;
DROP TABLE IF EXISTS friends CASCADE;
DROP TABLE IF EXISTS profiles CASCADE;

-- Step 2: Create profiles table with username (unique)
CREATE TABLE profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  username TEXT UNIQUE NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create groups table
CREATE TABLE groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  image_url TEXT,
  currency TEXT DEFAULT 'USD',
  invite_code TEXT UNIQUE NOT NULL,
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create group_members table
CREATE TABLE group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Step 5: Create expenses table
CREATE TABLE expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  paid_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  split_type TEXT DEFAULT 'equal',
  category TEXT,
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 6: Create expense_splits table
CREATE TABLE expense_splits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  expense_id UUID REFERENCES expenses(id) ON DELETE CASCADE,
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  percentage DECIMAL(5,2)
);

-- Step 7: Create settlements table
CREATE TABLE settlements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  from_user UUID REFERENCES profiles(id) ON DELETE SET NULL,
  to_user UUID REFERENCES profiles(id) ON DELETE SET NULL,
  amount DECIMAL(12,2) NOT NULL,
  currency TEXT DEFAULT 'USD',
  date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 8: Create friends table (for mutual friendships - both users see each other)
CREATE TABLE friends (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  friend_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, friend_id)
);

-- Step 8b: Create friend_requests table (pending requests)
CREATE TABLE friend_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user UUID REFERENCES profiles(id) ON DELETE CASCADE,
  to_user UUID REFERENCES profiles(id) ON DELETE CASCADE,
  status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(from_user, to_user)
);

-- Step 9: Enable RLS on all tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE expenses ENABLE ROW LEVEL SECURITY;
ALTER TABLE expense_splits ENABLE ROW LEVEL SECURITY;
ALTER TABLE settlements ENABLE ROW LEVEL SECURITY;
ALTER TABLE friends ENABLE ROW LEVEL SECURITY;
ALTER TABLE friend_requests ENABLE ROW LEVEL SECURITY;

-- Step 9b: Create helper function to avoid infinite recursion in RLS policies
CREATE OR REPLACE FUNCTION get_user_group_ids(uid UUID)
RETURNS SETOF UUID AS $$
  SELECT group_id FROM group_members WHERE user_id = uid;
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- Step 9c: Create function to accept friend request (creates mutual friendship)
CREATE OR REPLACE FUNCTION accept_friend_request(request_id UUID)
RETURNS void AS $$
DECLARE
  req RECORD;
BEGIN
  -- Get the request details
  SELECT * INTO req FROM friend_requests WHERE id = request_id;
  
  IF req IS NULL THEN
    RAISE EXCEPTION 'Friend request not found';
  END IF;
  
  -- Verify the current user is the recipient
  IF req.to_user != auth.uid() THEN
    RAISE EXCEPTION 'You can only accept requests sent to you';
  END IF;
  
  -- Create mutual friendship (both directions)
  INSERT INTO friends (user_id, friend_id) VALUES (req.to_user, req.from_user)
    ON CONFLICT DO NOTHING;
  INSERT INTO friends (user_id, friend_id) VALUES (req.from_user, req.to_user)
    ON CONFLICT DO NOTHING;
  
  -- Delete the request
  DELETE FROM friend_requests WHERE id = request_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Step 10: Profiles policies
CREATE POLICY "Users can view all profiles" ON profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "Users can update own profile" ON profiles FOR UPDATE TO authenticated USING (auth.uid() = id);
CREATE POLICY "Users can insert own profile" ON profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);

-- Step 11: Groups policies
-- Users can see groups if:
-- 1. They are a member, OR
-- 2. They created it, OR  
-- 3. They are being added to it (check group_members for their user_id)
CREATE POLICY "Users can view groups they belong to or created" ON groups FOR SELECT TO authenticated
  USING (
    id IN (SELECT get_user_group_ids(auth.uid()))
    OR created_by = auth.uid()
    OR id IN (SELECT group_id FROM group_members WHERE user_id = auth.uid())
  );
CREATE POLICY "Authenticated users can create groups" ON groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Group members can update group" ON groups FOR UPDATE TO authenticated
  USING (id IN (SELECT get_user_group_ids(auth.uid())));
CREATE POLICY "Group creator can delete group" ON groups FOR DELETE TO authenticated
  USING (created_by = auth.uid());

-- Step 12: Group members policies (use helper function to avoid recursion)
-- Users can see group_members if:
-- 1. They are already a member of the group, OR
-- 2. The row is about them being added to a group
CREATE POLICY "Users can view group members" ON group_members FOR SELECT TO authenticated
  USING (
    group_id IN (SELECT get_user_group_ids(auth.uid()))
    OR user_id = auth.uid()
  );
CREATE POLICY "Authenticated users can join groups" ON group_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can leave groups" ON group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR group_id IN (SELECT id FROM groups WHERE created_by = auth.uid()));

-- Step 13: Expenses policies
CREATE POLICY "Users can view expenses in their groups" ON expenses FOR SELECT TO authenticated
  USING (group_id IN (SELECT get_user_group_ids(auth.uid())));
CREATE POLICY "Users can create expenses in their groups" ON expenses FOR INSERT TO authenticated
  WITH CHECK (group_id IN (SELECT get_user_group_ids(auth.uid())));
CREATE POLICY "Users can update expenses they created" ON expenses FOR UPDATE TO authenticated
  USING (paid_by = auth.uid());
CREATE POLICY "Users can delete expenses in their groups" ON expenses FOR DELETE TO authenticated
  USING (group_id IN (SELECT get_user_group_ids(auth.uid())));

-- Step 14: Expense splits policies
CREATE POLICY "Users can view splits in their groups" ON expense_splits FOR SELECT TO authenticated
  USING (expense_id IN (SELECT id FROM expenses WHERE group_id IN (SELECT get_user_group_ids(auth.uid()))));
CREATE POLICY "Users can create splits" ON expense_splits FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "Users can delete splits" ON expense_splits FOR DELETE TO authenticated USING (true);

-- Step 15: Settlements policies
CREATE POLICY "Users can view settlements in their groups" ON settlements FOR SELECT TO authenticated
  USING (group_id IN (SELECT get_user_group_ids(auth.uid())));
CREATE POLICY "Users can create settlements" ON settlements FOR INSERT TO authenticated
  WITH CHECK (group_id IN (SELECT get_user_group_ids(auth.uid())));
CREATE POLICY "Users can delete their settlements" ON settlements FOR DELETE TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

-- Step 16: Friends policies
CREATE POLICY "Users can view their friends" ON friends FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());
CREATE POLICY "Users can add friends" ON friends FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove friends" ON friends FOR DELETE TO authenticated
  USING (user_id = auth.uid() OR friend_id = auth.uid());

-- Step 16b: Friend requests policies
CREATE POLICY "Users can view their friend requests" ON friend_requests FOR SELECT TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());
CREATE POLICY "Users can send friend requests" ON friend_requests FOR INSERT TO authenticated
  WITH CHECK (from_user = auth.uid());
CREATE POLICY "Users can update requests sent to them" ON friend_requests FOR UPDATE TO authenticated
  USING (to_user = auth.uid());
CREATE POLICY "Users can delete their requests" ON friend_requests FOR DELETE TO authenticated
  USING (from_user = auth.uid() OR to_user = auth.uid());

-- Step 17: Create trigger to auto-create profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, username)
  VALUES (new.id, new.email, new.raw_user_meta_data->>'username');
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Step 18: Enable realtime on all tables
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_splits;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
ALTER PUBLICATION supabase_realtime ADD TABLE friends;
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;

-- Step 19: Create index for username search
CREATE INDEX idx_profiles_username ON profiles(username);
CREATE INDEX idx_profiles_username_lower ON profiles(LOWER(username));

-- Step 20: Create avatars storage bucket
INSERT INTO storage.buckets (id, name, public)
VALUES ('avatars', 'avatars', true)
ON CONFLICT (id) DO UPDATE SET public = true;

-- Drop existing storage policies if they exist (ignore errors)
DROP POLICY IF EXISTS "Users can upload avatars" ON storage.objects;
DROP POLICY IF EXISTS "Avatars are publicly accessible" ON storage.objects;
DROP POLICY IF EXISTS "Users can update avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete avatars" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload their own avatar" ON storage.objects;

-- Storage policies for avatars
CREATE POLICY "Users can upload avatars" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'avatars');
CREATE POLICY "Avatars are publicly accessible" ON storage.objects FOR SELECT TO public
  USING (bucket_id = 'avatars');
CREATE POLICY "Users can update avatars" ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'avatars');
CREATE POLICY "Users can delete avatars" ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'avatars');

-- ============================================
-- AFTER RUNNING THIS SQL:
-- 1. Go to Authentication > Users in Supabase Dashboard
-- 2. Delete ALL existing users
-- 3. Users will need to sign up again with a username
-- ============================================
