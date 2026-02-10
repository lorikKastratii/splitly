-- Fix the infinite recursion in group_members policies
-- Run this in Supabase SQL Editor

-- Drop ALL existing policies on group_members
DROP POLICY IF EXISTS "Members viewable by group members" ON group_members;
DROP POLICY IF EXISTS "Users can join groups" ON group_members;
DROP POLICY IF EXISTS "Users can leave groups" ON group_members;
DROP POLICY IF EXISTS "Members viewable by authenticated users" ON group_members;
DROP POLICY IF EXISTS "Users can add themselves to groups" ON group_members;
DROP POLICY IF EXISTS "Users can remove themselves from groups" ON group_members;

-- Create simple, non-recursive policies for group_members

-- Allow any authenticated user to view all group members
-- (This is fine since groups are meant to be shared)
CREATE POLICY "Authenticated users can view group members" ON group_members
  FOR SELECT USING (auth.uid() IS NOT NULL);

-- Allow users to insert themselves as members (for joining groups)
CREATE POLICY "Users can insert themselves as members" ON group_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Allow users to remove themselves from groups
CREATE POLICY "Users can delete their own memberships" ON group_members
  FOR DELETE USING (auth.uid() = user_id);
