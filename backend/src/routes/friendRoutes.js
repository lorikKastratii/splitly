const express = require('express');
const {
  getFriends,
  addFriend,
  updateFriend,
  deleteFriend,
} = require('../controllers/friendController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getFriends);
router.post('/', addFriend);
router.put('/:id', updateFriend);
router.delete('/:id', deleteFriend);

module.exports = router;
