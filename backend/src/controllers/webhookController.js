const crypto = require('crypto');
const { pool } = require('../config/database');

function getWebhookSecret() {
  return process.env.PAYMENT_WEBHOOK_SECRET || '';
}

/**
 * Verifies the X-Webhook-Signature header from PaymentStripe.
 * Format: "t=<unix_timestamp>,v1=<hex_signature>"
 * Signed payload: "<timestamp>.<rawBody>"
 * Algorithm: HMAC-SHA256(secret, signedPayload) → lowercase hex
 */
function verifySignature(rawBody, signatureHeader, secret) {
  if (!signatureHeader || !secret) return false;

  const parts = Object.fromEntries(
    signatureHeader.split(',').map((part) => part.split('='))
  );

  const timestamp = parts.t;
  const v1 = parts.v1;

  if (!timestamp || !v1) return false;

  // Reject if timestamp is older than 5 minutes (replay protection)
  const age = Math.abs(Date.now() / 1000 - parseInt(timestamp, 10));
  if (age > 300) return false;

  const signedPayload = `${timestamp}.${rawBody}`;
  const expected = crypto
    .createHmac('sha256', secret)
    .update(signedPayload, 'utf8')
    .digest('hex');

  return crypto.timingSafeEqual(
    Buffer.from(expected, 'hex'),
    Buffer.from(v1, 'hex')
  );
}

/**
 * Looks up the Splitly user_id from a stripe_subscription_id.
 * Returns null if not found.
 */
async function findUserByStripeSubscription(stripeSubscriptionId) {
  if (!stripeSubscriptionId) return null;
  try {
    const result = await pool.query(
      'SELECT user_id FROM user_subscriptions WHERE stripe_subscription_id = $1',
      [stripeSubscriptionId]
    );
    return result.rows[0]?.user_id ?? null;
  } catch (err) {
    console.error('DB lookup error for stripe subscription:', err);
    return null;
  }
}

/**
 * Updates the status of a subscription in the local mapping table.
 */
async function updateSubscriptionStatus(stripeSubscriptionId, status) {
  if (!stripeSubscriptionId) return;
  try {
    await pool.query(
      'UPDATE user_subscriptions SET status = $1, updated_at = NOW() WHERE stripe_subscription_id = $2',
      [status, stripeSubscriptionId]
    );
  } catch (err) {
    console.error('Failed to update subscription status:', err);
  }
}

exports.handleWebhook = async (req, res) => {
  const secret = getWebhookSecret();
  const signatureHeader = req.headers['x-webhook-signature'];

  // Raw body is a Buffer when using express.raw()
  const rawBody = req.body instanceof Buffer ? req.body.toString('utf8') : req.body;

  if (secret) {
    if (!verifySignature(rawBody, signatureHeader, secret)) {
      console.warn('Webhook signature verification failed');
      return res.status(400).json({ error: 'Invalid webhook signature' });
    }
  } else {
    console.warn('PAYMENT_WEBHOOK_SECRET not configured — skipping signature verification');
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return res.status(400).json({ error: 'Invalid JSON payload' });
  }

  const { type, data } = event;
  const io = req.app.get('socketio');

  console.log(`Webhook received: ${type}`, { eventId: event.id });

  try {
    switch (type) {
      case 'payment.succeeded': {
        const userId = data?.user_id;
        console.log('Payment succeeded for user:', userId, {
          planId: data?.plan_id,
          amount: data?.amount_cents,
        });

        if (io && userId) {
          io.to(`user-${userId}`).emit('payment:succeeded', {
            planId: data?.plan_id,
            amountCents: data?.amount_cents,
            currency: data?.currency,
          });
        }
        break;
      }

      case 'payment.failed': {
        // PaymentStripe does not include user_id in payment.failed payloads.
        // Log it for debugging; the user sees failure feedback through Stripe's own UI.
        console.log('Payment failed:', {
          paymentIntentId: data?.payment_intent_id,
          reason: data?.failure_reason,
          planId: data?.plan_id,
        });
        break;
      }

      case 'payment.refunded': {
        const userId = data?.user_id;
        console.log('Payment refunded:', {
          paymentIntentId: data?.payment_intent_id,
          refundId: data?.refund_id,
          amountCents: data?.amount_cents,
          type: data?.type,
          reason: data?.reason,
        });

        if (io && userId) {
          io.to(`user-${userId}`).emit('payment:refunded', {
            paymentIntentId: data?.payment_intent_id,
            amountCents: data?.amount_cents,
            currency: data?.currency,
            type: data?.type,
          });
        }
        break;
      }

      case 'subscription.updated': {
        const stripeSubId = data?.stripe_subscription_id;
        console.log('Subscription updated:', stripeSubId, { status: data?.status });

        const userId = await findUserByStripeSubscription(stripeSubId);
        await updateSubscriptionStatus(stripeSubId, data?.status);

        if (io && userId) {
          io.to(`user-${userId}`).emit('subscription:updated', {
            stripeSubscriptionId: stripeSubId,
            status: data?.status,
            periodEnd: data?.period_end,
          });
        }
        break;
      }

      case 'subscription.canceled': {
        const stripeSubId = data?.stripe_subscription_id;
        console.log('Subscription canceled:', stripeSubId);

        const userId = await findUserByStripeSubscription(stripeSubId);
        await updateSubscriptionStatus(stripeSubId, 'canceled');

        if (io && userId) {
          io.to(`user-${userId}`).emit('subscription:canceled', {
            stripeSubscriptionId: stripeSubId,
            status: data?.status,
          });
        }
        break;
      }

      case 'trial.converted': {
        const stripeSubId = data?.stripe_subscription_id;
        console.log('Trial converted to active:', stripeSubId);

        const userId = await findUserByStripeSubscription(stripeSubId);
        await updateSubscriptionStatus(stripeSubId, 'active');

        if (io && userId) {
          io.to(`user-${userId}`).emit('trial:converted', {
            stripeSubscriptionId: stripeSubId,
            convertedAt: data?.converted_at,
          });
        }
        break;
      }

      case 'trial.expired': {
        const stripeSubId = data?.stripe_subscription_id;
        console.log('Trial expired:', stripeSubId);

        const userId = await findUserByStripeSubscription(stripeSubId);
        await updateSubscriptionStatus(stripeSubId, 'expired');

        if (io && userId) {
          io.to(`user-${userId}`).emit('trial:expired', {
            stripeSubscriptionId: stripeSubId,
            expiredAt: data?.expired_at,
          });
        }
        break;
      }

      case 'trial.ending_soon': {
        const stripeSubId = data?.stripe_subscription_id;
        console.log('Trial ending soon:', {
          daysRemaining: data?.days_remaining,
          trialEnd: data?.trial_end,
        });

        const userId = await findUserByStripeSubscription(stripeSubId);

        if (io && userId) {
          io.to(`user-${userId}`).emit('trial:ending_soon', {
            stripeSubscriptionId: stripeSubId,
            trialEnd: data?.trial_end,
            daysRemaining: data?.days_remaining,
          });
        }
        break;
      }

      default:
        console.log('Unhandled webhook event type:', type);
    }

    return res.json({ received: true });
  } catch (error) {
    console.error('Error processing webhook event:', error);
    return res.status(500).json({ error: 'Webhook processing failed' });
  }
};
