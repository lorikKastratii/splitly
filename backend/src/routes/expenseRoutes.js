const express = require('express');
const {
  createExpense,
  getGroupExpenses,
  deleteExpense,
} = require('../controllers/expenseController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/', createExpense);
router.get('/group/:groupId', getGroupExpenses);
router.delete('/:id', deleteExpense);

module.exports = router;
