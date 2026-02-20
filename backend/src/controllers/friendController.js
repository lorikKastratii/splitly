const { pool } = require('../config/database');

const getFriends = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT f.*, u.avatar_url as linked_user_avatar
       FROM friends f
       LEFT JOIN users u ON f.friend_user_id = u.id
       WHERE f.user_id = $1
       ORDER BY f.added_at DESC`,
      [req.userId]
    );

    res.json({ friends: result.rows });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Failed to fetch friends' });
  }
};

const addFriend = async (req, res) => {
  try {
    const { name, email, phone, avatar_url } = req.body;

    if (!name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    let friend_user_id = null;

    if (email) {
      const userResult = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (userResult.rows.length > 0) {
        friend_user_id = userResult.rows[0].id;
      }
    }

    const result = await pool.query(
      `INSERT INTO friends (user_id, friend_user_id, name, email, phone, avatar_url)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [req.userId, friend_user_id, name, email ? email.toLowerCase() : null, phone, avatar_url]
    );

    res.status(201).json({ friend: result.rows[0] });
  } catch (error) {
    console.error('Add friend error:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Friend with this email already exists' });
    }
    res.status(500).json({ error: 'Failed to add friend' });
  }
};

const updateFriend = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, email, phone, avatar_url } = req.body;

    const friendExists = await pool.query(
      'SELECT 1 FROM friends WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (friendExists.rows.length === 0) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (email !== undefined) {
      updates.push(`email = $${paramCount++}`);
      values.push(email ? email.toLowerCase() : null);
    }
    if (phone !== undefined) {
      updates.push(`phone = $${paramCount++}`);
      values.push(phone);
    }
    if (avatar_url !== undefined) {
      updates.push(`avatar_url = $${paramCount++}`);
      values.push(avatar_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE friends SET ${updates.join(', ')}
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json({ friend: result.rows[0] });
  } catch (error) {
    console.error('Update friend error:', error);
    res.status(500).json({ error: 'Failed to update friend' });
  }
};

const deleteFriend = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Get the record first so we know who the other user is
    const friendRecord = await client.query(
      'SELECT * FROM friends WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (friendRecord.rows.length === 0) {
      client.release();
      return res.status(404).json({ error: 'Friend not found' });
    }

    const { friend_user_id } = friendRecord.rows[0];

    await client.query('BEGIN');

    // Delete this user's friend record
    await client.query(
      'DELETE FROM friends WHERE id = $1 AND user_id = $2',
      [id, req.userId]
    );

    // Delete the reverse record so the other user's list is also updated
    if (friend_user_id) {
      await client.query(
        'DELETE FROM friends WHERE user_id = $1 AND friend_user_id = $2',
        [friend_user_id, req.userId]
      );
    }

    // Delete the friend_requests record so both users can re-add each other later
    if (friend_user_id) {
      await client.query(
        `DELETE FROM friend_requests
         WHERE (from_user_id = $1 AND to_user_id = $2)
            OR (from_user_id = $2 AND to_user_id = $1)`,
        [req.userId, friend_user_id]
      );
    }

    await client.query('COMMIT');

    // Notify both users in real-time
    const io = req.app.get('socketio');
    if (io && friend_user_id) {
      // Notify the removed friend that they were unfriended
      io.to(`user-${friend_user_id}`).emit('friend-removed', { friendUserId: req.userId });
      // Notify the requesting user too (for other devices/tabs)
      io.to(`user-${req.userId}`).emit('friend-removed', { friendUserId: friend_user_id });
    }

    res.json({ message: 'Friend deleted successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Delete friend error:', error);
    res.status(500).json({ error: 'Failed to delete friend' });
  } finally {
    client.release();
  }
};

module.exports = {
  getFriends,
  addFriend,
  updateFriend,
  deleteFriend,
};
