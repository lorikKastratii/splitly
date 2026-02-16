const express = require('express');
const {
  createSettlement,
  getGroupSettlements,
  deleteSettlement,
} = require('../controllers/settlementController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/', createSettlement);
router.get('/group/:groupId', getGroupSettlements);
router.delete('/:id', deleteSettlement);

module.exports = router;
