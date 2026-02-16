const { pool } = require('../config/database');

const createExpense = async (req, res) => {
  const client = await pool.connect();

  try {
    const { group_id, description, amount, currency, split_type, category, date, notes, splits } = req.body;

    if (!group_id || !description || !amount || !splits || !Array.isArray(splits)) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const isMember = await client.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [group_id, req.userId]
    );

    if (isMember.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    await client.query('BEGIN');

    const expenseResult = await client.query(
      `INSERT INTO expenses (group_id, description, amount, currency, paid_by, split_type, category, date, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
       RETURNING *`,
      [group_id, description, amount, currency || 'USD', req.userId, split_type || 'equal', category, date || new Date().toISOString().split('T')[0], notes]
    );

    const expense = expenseResult.rows[0];

    for (const split of splits) {
      await client.query(
        'INSERT INTO expense_splits (expense_id, user_id, amount, percentage) VALUES ($1, $2, $3, $4)',
        [expense.id, split.user_id, split.amount, split.percentage]
      );
    }

    const splitsResult = await client.query(
      `SELECT es.*, u.name as user_name
       FROM expense_splits es
       JOIN users u ON es.user_id = u.id
       WHERE es.expense_id = $1`,
      [expense.id]
    );

    await client.query('COMMIT');

    expense.splits = splitsResult.rows;

    res.status(201).json({ expense });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Create expense error:', error);
    res.status(500).json({ error: 'Failed to create expense' });
  } finally {
    client.release();
  }
};

const getGroupExpenses = async (req, res) => {
  try {
    const { groupId } = req.params;

    const isMember = await pool.query(
      'SELECT 1 FROM group_members WHERE group_id = $1 AND user_id = $2',
      [groupId, req.userId]
    );

    if (isMember.rows.length === 0) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const expensesResult = await pool.query(
      `SELECT e.*, u.name as paid_by_name, u.avatar_url as paid_by_avatar
       FROM expenses e
       LEFT JOIN users u ON e.paid_by = u.id
       WHERE e.group_id = $1
       ORDER BY e.date DESC, e.created_at DESC`,
      [groupId]
    );

    const expenses = await Promise.all(
      expensesResult.rows.map(async (expense) => {
        const splitsResult = await pool.query(
          `SELECT es.*, u.name as user_name, u.avatar_url as user_avatar
           FROM expense_splits es
           JOIN users u ON es.user_id = u.id
           WHERE es.expense_id = $1`,
          [expense.id]
        );
        expense.splits = splitsResult.rows;
        return expense;
      })
    );

    res.json({ expenses });
  } catch (error) {
    console.error('Get expenses error:', error);
    res.status(500).json({ error: 'Failed to fetch expenses' });
  }
};

const deleteExpense = async (req, res) => {
  try {
    const { id } = req.params;

    const expense = await pool.query(
      'SELECT * FROM expenses WHERE id = $1',
      [id]
    );

    if (expense.rows.length === 0) {
      return res.status(404).json({ error: 'Expense not found' });
    }

    if (expense.rows[0].paid_by !== req.userId) {
      return res.status(403).json({ error: 'Only the person who paid can delete this expense' });
    }

    await pool.query('DELETE FROM expenses WHERE id = $1', [id]);

    res.json({ message: 'Expense deleted successfully' });
  } catch (error) {
    console.error('Delete expense error:', error);
    res.status(500).json({ error: 'Failed to delete expense' });
  }
};

module.exports = {
  createExpense,
  getGroupExpenses,
  deleteExpense,
};
