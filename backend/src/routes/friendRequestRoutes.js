const express = require('express');
const {
  searchUsers,
  sendFriendRequest,
  getFriendRequests,
  acceptFriendRequest,
  rejectFriendRequest,
} = require('../controllers/friendRequestController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.get('/search', searchUsers);
router.get('/', getFriendRequests);
router.post('/', sendFriendRequest);
router.put('/:id/accept', acceptFriendRequest);
router.put('/:id/reject', rejectFriendRequest);

module.exports = router;
