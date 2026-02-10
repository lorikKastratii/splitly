-- ============================================
-- REALTIME CHANNEL RLS POLICIES
-- ============================================
-- Allow users to subscribe to group channels and personal notification channels

-- Policy to allow group members to read messages in their group channels
CREATE POLICY IF NOT EXISTS "group_members_can_subscribe"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  -- Allow channels matching pattern: group:{group_id}:messages
  topic ~ '^group:[a-f0-9-]+:messages$'
  AND
  -- User must be a member of the group
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id::text = (regexp_match(topic, '^group:([a-f0-9-]+):messages$'))[1]
    AND group_members.user_id = auth.uid()
  )
);

-- Policy to allow group members to broadcast to their group channels
CREATE POLICY IF NOT EXISTS "group_members_can_broadcast"
ON realtime.messages
FOR INSERT
TO authenticated
WITH CHECK (
  -- Allow channels matching pattern: group:{group_id}:messages
  topic ~ '^group:[a-f0-9-]+:messages$'
  AND
  -- User must be a member of the group
  EXISTS (
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id::text = (regexp_match(topic, '^group:([a-f0-9-]+):messages$'))[1]
    AND group_members.user_id = auth.uid()
  )
);

-- Policy to allow users to access their own notification channels
CREATE POLICY IF NOT EXISTS "users_can_use_personal_channels"
ON realtime.messages
FOR ALL
TO authenticated
USING (
  -- Allow channels matching pattern: user:{user_id}:notifications
  topic ~ '^user:[a-f0-9-]+:notifications$'
  AND
  -- User can only access their own channel
  topic = 'user:' || auth.uid()::text || ':notifications'
);

-- Verify policies were created
SELECT schemaname, tablename, policyname, cmd, qual
FROM pg_policies
WHERE schemaname = 'realtime'
AND tablename = 'messages'
ORDER BY policyname;
