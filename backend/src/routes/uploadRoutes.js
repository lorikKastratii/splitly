const express = require('express');
const { uploadImage } = require('../controllers/uploadController');
const { authMiddleware } = require('../middleware/auth');
const { upload } = require('../middleware/upload');

const router = express.Router();

router.post('/', authMiddleware, upload.single('image'), uploadImage);

module.exports = router;
