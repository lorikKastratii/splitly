-- ============================================
-- ENABLE REALTIME WITH RLS AUTHORIZATION
-- ============================================
-- Run this in Supabase SQL Editor to enable realtime for all users in a group
-- This is CRITICAL for cross-user real-time sync

-- Add tables with FULL replica identity for realtime (includes old values on UPDATE/DELETE)
ALTER TABLE expenses REPLICA IDENTITY FULL;
ALTER TABLE expense_splits REPLICA IDENTITY FULL;
ALTER TABLE settlements REPLICA IDENTITY FULL;
ALTER TABLE groups REPLICA IDENTITY FULL;
ALTER TABLE group_members REPLICA IDENTITY FULL;
ALTER TABLE friends REPLICA IDENTITY FULL;
ALTER TABLE friend_requests REPLICA IDENTITY FULL;
ALTER TABLE profiles REPLICA IDENTITY FULL;

-- Drop and re-add tables to publication (using DO block to handle if table not in publication)
DO $$
BEGIN
  -- Try to drop tables from publication (ignore errors if they don't exist)
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE expenses;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE expense_splits;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE settlements;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE groups;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE group_members;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE friends;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE friend_requests;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
  BEGIN
    ALTER PUBLICATION supabase_realtime DROP TABLE profiles;
  EXCEPTION WHEN undefined_object THEN NULL;
  END;
END $$;

-- Add all tables to the realtime publication
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_splits;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE friends;
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- ============================================
-- IMPORTANT: Supabase Dashboard Configuration
-- ============================================
-- 1. Go to Supabase Dashboard → Database → Replication
-- 2. Under "Realtime", make sure ALL these tables have a checkmark:
--    - expenses
--    - expense_splits  
--    - settlements
--    - groups
--    - group_members
--    - friends
--    - friend_requests
--    - profiles
--
-- 3. Go to Project Settings → API → Realtime section
--    Make sure "Enable Realtime" is turned ON
--
-- 4. For RLS to work with Realtime:
--    Go to Database → Replication → supabase_realtime publication
--    Enable "Publish INSERTS", "Publish UPDATES", "Publish DELETES"
-- ============================================

-- Verify the publication includes all tables
SELECT schemaname, tablename 
FROM pg_publication_tables 
WHERE pubname = 'supabase_realtime' 
ORDER BY tablename;

-- Check replica identity is set correctly
SELECT c.relname as table_name, 
       CASE c.relreplident
         WHEN 'd' THEN 'default (primary key)'
         WHEN 'n' THEN 'nothing'
         WHEN 'f' THEN 'full'
         WHEN 'i' THEN 'index'
       END as replica_identity
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
AND c.relkind = 'r'
AND c.relname IN ('expenses', 'expense_splits', 'settlements', 'groups', 'group_members', 'friends', 'friend_requests', 'profiles')
ORDER BY c.relname;
