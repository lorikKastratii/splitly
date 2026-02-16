const { pool } = require('../config/database');
const { generateInviteCode } = require('../utils/helpers');

const createGroup = async (req, res) => {
  const client = await pool.connect();

  try {
    const { name, description, currency, image_url } = req.body;

    if (!name || !currency) {
      return res.status(400).json({ error: 'Name and currency are required' });
    }

    await client.query('BEGIN');

    const inviteCode = await generateInviteCode();

    const groupResult = await client.query(
      `INSERT INTO groups (name, description, currency, image_url, invite_code, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING *`,
      [name, description, currency.toUpperCase(), image_url, inviteCode, req.userId]
    );

    const group = groupResult.rows[0];

    await client.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, req.userId]
    );

    await client.query('COMMIT');

    res.status(201).json({ group });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Failed to create group' });
  } finally {
    client.release();
  }
};

const getGroups = async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT g.*, u.name as creator_name, COUNT(DISTINCT gm.user_id) as member_count
       FROM groups g
       LEFT JOIN users u ON g.created_by = u.id
       LEFT JOIN group_members gm ON g.id = gm.group_id
       WHERE g.id IN (SELECT group_id FROM group_members WHERE user_id = $1)
       GROUP BY g.id, u.name
       ORDER BY g.created_at DESC`,
      [req.userId]
    );

    res.json({ groups: result.rows });
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Failed to fetch groups' });
  }
};

const getGroupById = async (req, res) => {
  try {
    const { id } = req.params;

    const isMember = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [id, req.userId]
    );

    if (isMember.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const groupResult = await pool.query(
      `SELECT g.*, u.name as creator_name
       FROM groups g
       LEFT JOIN users u ON g.created_by = u.id
       WHERE g.id = $1`,
      [id]
    );

    if (groupResult.rows.length === 0) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const membersResult = await pool.query(
      `SELECT u.id, u.name, u.email, u.avatar_url, gm.joined_at
       FROM group_members gm
       JOIN users u ON gm.user_id = u.id
       WHERE gm.group_id = $1
       ORDER BY gm.joined_at`,
      [id]
    );

    const group = groupResult.rows[0];
    group.members = membersResult.rows;

    res.json({ group });
  } catch (error) {
    console.error('Get group error:', error);
    res.status(500).json({ error: 'Failed to fetch group' });
  }
};

const updateGroup = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, currency, image_url } = req.body;

    const isCreator = await pool.query(
      'SELECT 1 FROM groups WHERE id = $1 AND created_by = $2',
      [id, req.userId]
    );

    if (isCreator.rows.length === 0) {
      return res.status(403).json({ error: 'Only group creator can update' });
    }

    const updates = [];
    const values = [];
    let paramCount = 1;

    if (name) {
      updates.push(`name = $${paramCount++}`);
      values.push(name);
    }
    if (description !== undefined) {
      updates.push(`description = $${paramCount++}`);
      values.push(description);
    }
    if (currency) {
      updates.push(`currency = $${paramCount++}`);
      values.push(currency.toUpperCase());
    }
    if (image_url !== undefined) {
      updates.push(`image_url = $${paramCount++}`);
      values.push(image_url);
    }

    if (updates.length === 0) {
      return res.status(400).json({ error: 'No fields to update' });
    }

    values.push(id);

    const result = await pool.query(
      `UPDATE groups SET ${updates.join(', ')}, updated_at = NOW()
       WHERE id = $${paramCount}
       RETURNING *`,
      values
    );

    res.json({ group: result.rows[0] });
  } catch (error) {
    console.error('Update group error:', error);
    res.status(500).json({ error: 'Failed to update group' });
  }
};

const deleteGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const isCreator = await pool.query(
      'SELECT 1 FROM groups WHERE id = $1 AND created_by = $2',
      [id, req.userId]
    );

    if (isCreator.rows.length === 0) {
      return res.status(403).json({ error: 'Only group creator can delete' });
    }

    await pool.query('DELETE FROM groups WHERE id = $1', [id]);

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Failed to delete group' });
  }
};

const joinGroupByCode = async (req, res) => {
  const client = await pool.connect();

  try {
    const { invite_code } = req.body;

    if (!invite_code) {
      return res.status(400).json({ error: 'Invite code is required' });
    }

    await client.query('BEGIN');

    const groupResult = await client.query(
      'SELECT * FROM groups WHERE UPPER(invite_code) = UPPER($1)',
      [invite_code]
    );

    if (groupResult.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Invalid invite code' });
    }

    const group = groupResult.rows[0];

    const alreadyMember = await client.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [group.id, req.userId]
    );

    if (alreadyMember.rows.length > 0) {
      await client.query('COMMIT');
      return res.json({ group, message: 'Already a member' });
    }

    await client.query(
      'INSERT INTO group_members (group_id, user_id) VALUES ($1, $2)',
      [group.id, req.userId]
    );

    await client.query('COMMIT');

    res.status(201).json({ group, message: 'Joined group successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Join group error:', error);
    res.status(500).json({ error: 'Failed to join group' });
  } finally {
    client.release();
  }
};

const leaveGroup = async (req, res) => {
  try {
    const { id } = req.params;

    const result = await pool.query(
      'DELETE FROM group_members WHERE group_id = $1 AND user_id = $2 RETURNING *',
      [id, req.userId]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Not a member of this group' });
    }

    res.json({ message: 'Left group successfully' });
  } catch (error) {
    console.error('Leave group error:', error);
    res.status(500).json({ error: 'Failed to leave group' });
  }
};

module.exports = {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  joinGroupByCode,
  leaveGroup,
};
