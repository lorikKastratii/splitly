const express = require('express');
const router = express.Router();
const { authMiddleware } = require('../middleware/auth');
const paymentController = require('../controllers/paymentController');
const webhookController = require('../controllers/webhookController');

// Webhook endpoint — receives outgoing events from PaymentStripe (raw body preserved in server.js)
router.post('/webhook', webhookController.handleWebhook);

router.get('/config', paymentController.getPaymentConfig);
router.get('/plans', paymentController.getPlans);
router.get('/entitlement', authMiddleware, paymentController.getEntitlement);
router.get('/features', authMiddleware, paymentController.getFeatures);
router.post('/create-intent', authMiddleware, paymentController.createIntent);

// Trial endpoints
router.post('/trials/check-eligibility', authMiddleware, paymentController.checkTrialEligibility);
router.post('/trials/start', authMiddleware, paymentController.startTrial);
router.post('/trials/:subscriptionId/cancel', authMiddleware, paymentController.cancelTrial);

// Coupon endpoints
router.post('/coupons/validate', authMiddleware, paymentController.validateCoupon);
router.post('/create-intent-with-coupon', authMiddleware, paymentController.createIntentWithCoupon);

module.exports = router;
