const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

router.get('/config', paymentController.getPaymentConfig);
router.get('/plans', paymentController.getPlans);
router.post('/create-intent', authMiddleware, paymentController.createIntent);

module.exports = router;
