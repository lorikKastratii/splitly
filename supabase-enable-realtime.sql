-- Enable Realtime for the tables that need real-time sync
-- Run this in Supabase SQL Editor

-- First, drop all tables from publication to start fresh
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS expenses;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS expense_splits;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS settlements;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS groups;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS group_members;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS friends;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS friend_requests;
ALTER PUBLICATION supabase_realtime DROP TABLE IF EXISTS profiles;

-- Now add all tables with realtime enabled
ALTER PUBLICATION supabase_realtime ADD TABLE expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE expense_splits;
ALTER PUBLICATION supabase_realtime ADD TABLE settlements;
ALTER PUBLICATION supabase_realtime ADD TABLE groups;
ALTER PUBLICATION supabase_realtime ADD TABLE group_members;
ALTER PUBLICATION supabase_realtime ADD TABLE friends;
ALTER PUBLICATION supabase_realtime ADD TABLE friend_requests;
ALTER PUBLICATION supabase_realtime ADD TABLE profiles;

-- Verify which tables have realtime enabled
SELECT schemaname, tablename FROM pg_publication_tables WHERE pubname = 'supabase_realtime' ORDER BY tablename;
