const { pool } = require('../config/database');

const searchUsers = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const result = await pool.query(
      `SELECT id, name, email, avatar_url FROM users
       WHERE LOWER(name) = LOWER($1) AND id != $2
       LIMIT 1`,
      [query.trim(), req.userId]
    );

    if (result.rows.length === 0) {
      return res.json({ user: null });
    }

    res.json({ user: result.rows[0] });
  } catch (error) {
    console.error('Search users error:', error);
    res.status(500).json({ error: 'Failed to search users' });
  }
};

const sendFriendRequest = async (req, res) => {
  try {
    const { to_user_id } = req.body;

    if (!to_user_id) {
      return res.status(400).json({ error: 'to_user_id is required' });
    }

    if (to_user_id === req.userId) {
      return res.status(400).json({ error: "You can't send a friend request to yourself" });
    }

    // Check if already friends
    const existingFriend = await pool.query(
      `SELECT 1 FROM friends
       WHERE (user_id = $1 AND friend_user_id = $2)
          OR (user_id = $2 AND friend_user_id = $1)`,
      [req.userId, to_user_id]
    );

    if (existingFriend.rows.length > 0) {
      return res.status(400).json({ error: 'Already friends' });
    }

    // Check if a pending request already exists (in either direction)
    const existingRequest = await pool.query(
      `SELECT id, from_user_id, to_user_id, status FROM friend_requests
       WHERE ((from_user_id = $1 AND to_user_id = $2)
          OR (from_user_id = $2 AND to_user_id = $1))
         AND status = 'pending'`,
      [req.userId, to_user_id]
    );

    if (existingRequest.rows.length > 0) {
      const existing = existingRequest.rows[0];
      if (existing.from_user_id === to_user_id) {
        return res.status(400).json({ error: 'This user has already sent you a friend request' });
      }
      return res.status(400).json({ error: 'Friend request already sent' });
    }

    const result = await pool.query(
      `INSERT INTO friend_requests (from_user_id, to_user_id, status)
       VALUES ($1, $2, 'pending')
       RETURNING *`,
      [req.userId, to_user_id]
    );

    res.status(201).json({ request: result.rows[0] });
  } catch (error) {
    console.error('Send friend request error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Friend request already exists' });
    }
    res.status(500).json({ error: 'Failed to send friend request' });
  }
};

const getFriendRequests = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT fr.id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at,
              u.name as from_username, u.email as from_email, u.avatar_url as from_avatar
       FROM friend_requests fr
       JOIN users u ON u.id = fr.from_user_id
       WHERE fr.to_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.userId]
    );

    // Also get sent requests
    const sentResult = await pool.query(
      `SELECT fr.id, fr.from_user_id, fr.to_user_id, fr.status, fr.created_at,
              u.name as to_username, u.email as to_email, u.avatar_url as to_avatar
       FROM friend_requests fr
       JOIN users u ON u.id = fr.to_user_id
       WHERE fr.from_user_id = $1 AND fr.status = 'pending'
       ORDER BY fr.created_at DESC`,
      [req.userId]
    );

    res.json({
      received: result.rows,
      sent: sentResult.rows,
    });
  } catch (error) {
    console.error('Get friend requests error:', error);
    res.status(500).json({ error: 'Failed to fetch friend requests' });
  }
};

const acceptFriendRequest = async (req, res) => {
  const client = await pool.connect();

  try {
    const { id } = req.params;

    await client.query('BEGIN');

    // Get the request and verify it's for this user
    const requestResult = await client.query(
      `SELECT * FROM friend_requests WHERE id = $1 AND to_user_id = $2 AND status = 'pending'`,
      [id, req.userId]
    );

    if (requestResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Friend request not found' });
    }

    const friendRequest = requestResult.rows[0];

    // Update request status
    await client.query(
      `UPDATE friend_requests SET status = 'accepted' WHERE id = $1`,
      [id]
    );

    // Get both users' info
    const fromUser = await client.query(
      'SELECT id, name, email, avatar_url FROM users WHERE id = $1',
      [friendRequest.from_user_id]
    );
    const toUser = await client.query(
      'SELECT id, name, email, avatar_url FROM users WHERE id = $1',
      [friendRequest.to_user_id]
    );

    // Create friend entries for both users
    await client.query(
      `INSERT INTO friends (user_id, friend_user_id, name, email, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [friendRequest.to_user_id, friendRequest.from_user_id,
       fromUser.rows[0].name, fromUser.rows[0].email, fromUser.rows[0].avatar_url]
    );

    await client.query(
      `INSERT INTO friends (user_id, friend_user_id, name, email, avatar_url)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT DO NOTHING`,
      [friendRequest.from_user_id, friendRequest.to_user_id,
       toUser.rows[0].name, toUser.rows[0].email, toUser.rows[0].avatar_url]
    );

    await client.query('COMMIT');

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Failed to accept friend request' });
  } finally {
    client.release();
  }
};

const rejectFriendRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      `UPDATE friend_requests SET status = 'rejected'
       WHERE id = $1 AND to_user_id = $2 AND status = 'pending'
       RETURNING *`,
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    console.error('Reject friend request error:', error);
    res.status(500).json({ error: 'Failed to reject friend request' });
  }
};

module.exports = {
  searchUsers,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
};
