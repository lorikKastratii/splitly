const express = require('express');
const {
  createGroup,
  getGroups,
  getGroupById,
  updateGroup,
  deleteGroup,
  joinGroupByCode,
  leaveGroup,
  addMemberToGroup,
} = require('../controllers/groupController');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

router.use(authMiddleware);

router.post('/', createGroup);
router.get('/', getGroups);
router.post('/join', joinGroupByCode);
router.get('/:id', getGroupById);
router.put('/:id', updateGroup);
router.delete('/:id', deleteGroup);
router.delete('/:id/leave', leaveGroup);
router.post('/:id/members', addMemberToGroup);

module.exports = router;
