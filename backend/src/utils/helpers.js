const { pool } = require('../config/database');

const generateInviteCode = async () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code;
  let isUnique = false;

  while (!isUnique) {
    code = '';
    for (let i = 0; i < 6; i++) {
      code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const result = await pool.query(
      'SELECT 1 FROM groups WHERE invite_code = $1',
      [code]
    );

    if (result.rows.length === 0) {
      isUnique = true;
    }
  }

  return code;
};

module.exports = {
  generateInviteCode,
};
