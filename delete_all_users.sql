-- ============================================
-- DELETE ALL USERS - Run in Supabase SQL Editor
-- This will delete all users and their data
-- ============================================

-- Step 1: Delete all data from app tables (cascade will handle most)
DELETE FROM expense_splits;
DELETE FROM expenses;
DELETE FROM settlements;
DELETE FROM group_members;
DELETE FROM groups;
DELETE FROM friend_requests;
DELETE FROM friends;
DELETE FROM profiles;

-- Step 2: Delete all users from auth.users
-- This requires running in Supabase SQL Editor with admin privileges
DELETE FROM auth.users;

-- ============================================
-- After running this:
-- 1. Close the app completely
-- 2. Open the app and sign up fresh with a new account
-- ============================================
