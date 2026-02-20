const { pool } = require('../config/database');

const createSettlement = async (req, res) => {
  const client = await pool.connect();

  try {
    const { group_id, from_user, to_user, amount, currency, date, notes } = req.body;

    if (!group_id || !to_user || !amount) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const isMember = await client.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [group_id, req.userId]
    );

    if (isMember.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    // Use from_user from request body if provided, otherwise default to the requesting user
    const payer = from_user || req.userId;

    await client.query('BEGIN');

    const result = await client.query(
      `INSERT INTO settlements (group_id, from_user, to_user, amount, currency, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       RETURNING *`,
      [group_id, payer, to_user, amount, currency || 'USD', date || new Date().toISOString().split('T')[0], notes]
    );

    await client.query('COMMIT');

    // Emit real-time event to all group members
    const emitToGroup = req.app.get('emitToGroup');
    if (emitToGroup) {
      emitToGroup(group_id, 'settlement-added', { settlement: result.rows[0] });
    }

    res.status(201).json({ settlement: result.rows[0] });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create settlement error:', error);
    res.status(500).json({ error: 'Failed to create settlement' });
  } finally {
    client.release();
  }
};

const getGroupSettlements = async (req, res) => {
  try {
    const { groupId } = req.params;

    const isMember = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );

    if (isMember.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const result = await pool.query(
      `SELECT s.*,
              u1.name as from_user_name, u1.avatar_url as from_user_avatar,
              u2.name as to_user_name, u2.avatar_url as to_user_avatar
       FROM settlements s
       LEFT JOIN users u1 ON s.from_user = u1.id
       LEFT JOIN users u2 ON s.to_user = u2.id
       WHERE s.group_id = $1
       ORDER BY s.date DESC, s.created_at DESC`,
      [groupId]
    );

    res.json({ settlements: result.rows });
  } catch (error) {
    console.error('Get settlements error:', error);
    res.status(500).json({ error: 'Failed to fetch settlements' });
  }
};

const deleteSettlement = async (req, res) => {
  try {
    const { id } = req.params;

    const settlement = await pool.query(
      'SELECT * FROM settlements WHERE id = $1',
      [id]
    );

    if (settlement.rows.length === 0) {
      return res.status(404).json({ error: 'Settlement not found' });
    }

    const { from_user, to_user } = settlement.rows[0];

    if (from_user !== req.userId && to_user !== req.userId) {
      return res.status(403).json({ error: 'Only settlement participants can delete' });
    }

    await pool.query('DELETE FROM settlements WHERE id = $1', [id]);

    // Emit real-time event to all group members
    const emitToGroup = req.app.get('emitToGroup');
    if (emitToGroup) {
      emitToGroup(settlement.rows[0].group_id, 'settlement-deleted', { id });
    }

    res.json({ message: 'Settlement deleted successfully' });
  } catch (error) {
    console.error('Delete settlement error:', error);
    res.status(500).json({ error: 'Failed to delete settlement' });
  }
};

module.exports = {
  createSettlement,
  getGroupSettlements,
  deleteSettlement,
};
