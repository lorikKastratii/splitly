-- Fix delete group permissions
-- Run this in Supabase SQL Editor

-- First, let's see current policies on groups
-- SELECT * FROM pg_policies WHERE tablename = 'groups';

-- Drop existing delete policies
DROP POLICY IF EXISTS "Group creators can delete groups" ON groups;
DROP POLICY IF EXISTS "Users can delete their own groups" ON groups;
DROP POLICY IF EXISTS "Group creator can delete" ON groups;

-- Create policy to allow group creator to delete the group
CREATE POLICY "Group creator can delete" ON groups
  FOR DELETE USING (auth.uid() = created_by);

-- Alternative: Allow any member to delete (if you want this behavior)
-- DROP POLICY IF EXISTS "Group members can delete" ON groups;
-- CREATE POLICY "Group members can delete" ON groups
--   FOR DELETE USING (
--     EXISTS (
--       SELECT 1 FROM group_members 
--       WHERE group_members.group_id = groups.id 
--       AND group_members.user_id = auth.uid()
--     )
--   );

-- Also need to handle cascading deletes for related data
-- When a group is deleted, we need to delete:
-- 1. group_members
-- 2. expenses (and expense_splits)
-- 3. settlements

-- Enable cascade delete on foreign keys (if not already set)
-- This is usually done in the schema, but let's make sure policies allow it

-- Allow deleting group_members when group is deleted
DROP POLICY IF EXISTS "Allow cascade delete of group members" ON group_members;
CREATE POLICY "Allow cascade delete of group members" ON group_members
  FOR DELETE USING (
    auth.uid() IN (
      SELECT created_by FROM groups WHERE id = group_id
    )
    OR auth.uid() = user_id
  );

-- Allow deleting expenses when group is deleted
DROP POLICY IF EXISTS "Allow cascade delete of expenses" ON expenses;
DROP POLICY IF EXISTS "Group creator can delete expenses" ON expenses;
CREATE POLICY "Group creator can delete expenses" ON expenses
  FOR DELETE USING (
    auth.uid() IN (
      SELECT created_by FROM groups WHERE id = group_id
    )
    OR auth.uid() = paid_by
  );

-- Allow deleting expense_splits when expense is deleted
DROP POLICY IF EXISTS "Allow cascade delete of expense splits" ON expense_splits;
DROP POLICY IF EXISTS "Allow cascade delete of expense_splits" ON expense_splits;
CREATE POLICY "Allow cascade delete of expense splits" ON expense_splits
  FOR DELETE USING (
    auth.uid() IN (
      SELECT e.paid_by FROM expenses e WHERE e.id = expense_id
    )
    OR auth.uid() IN (
      SELECT g.created_by FROM groups g 
      JOIN expenses e ON e.group_id = g.id 
      WHERE e.id = expense_id
    )
  );

-- Allow deleting settlements when group is deleted  
DROP POLICY IF EXISTS "Allow cascade delete of settlements" ON settlements;
DROP POLICY IF EXISTS "Group creator can delete settlements" ON settlements;
CREATE POLICY "Group creator can delete settlements" ON settlements
  FOR DELETE USING (
    auth.uid() IN (
      SELECT created_by FROM groups WHERE id = group_id
    )
    OR auth.uid() = from_user
    OR auth.uid() = to_user
  );
