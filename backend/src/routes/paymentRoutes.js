const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');

// POST /api/payments/create-intent
// Creates a Stripe PaymentIntent for the selected plan.
// Requires JWT authentication so we know which user is paying.
router.post('/create-intent', authMiddleware, paymentController.createIntent);

module.exports = router;
