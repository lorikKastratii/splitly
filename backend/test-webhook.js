/**
 * Sends a test webhook event to the local server.
 * Usage: node test-webhook.js [event-type]
 *
 * Available event types:
 *   payment.succeeded   (default)
 *   payment.failed
 *   subscription.updated
 *   subscription.canceled
 *   trial.converted
 *   trial.expired
 *   trial.ending_soon
 */

const crypto = require('crypto');
require('dotenv').config();

const SECRET = (process.env.PAYMENT_WEBHOOK_SECRET || '').trim();
const PORT   = process.env.PORT || 3000;
const URL    = `http://localhost:${PORT}/api/payments/webhook`;

// Change this to an actual user_id from your DB for events that use socket targeting
const TEST_USER_ID  = 'test-user-123';
const TEST_SUB_ID   = 'sub_test_abc123';

const EVENT_TYPE = process.argv[2] || 'payment.succeeded';

const payloads = {
  'payment.succeeded': {
    payment_intent_id: 'pi_test_succeeded',
    amount_cents: 999,
    currency: 'eur',
    user_id: TEST_USER_ID,
    plan_id: 'plan-uuid-here',
  },
  'payment.failed': {
    payment_intent_id: 'pi_test_failed',
    amount_cents: 999,
    currency: 'eur',
    failure_reason: 'card_declined',
    plan_id: 'plan-uuid-here',
  },
  'subscription.updated': {
    stripe_subscription_id: TEST_SUB_ID,
    stripe_customer_id: 'cus_test_123',
    status: 'active',
    period_end: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
  },
  'subscription.canceled': {
    stripe_subscription_id: TEST_SUB_ID,
    stripe_customer_id: 'cus_test_123',
    status: 'canceled',
  },
  'trial.converted': {
    stripe_subscription_id: TEST_SUB_ID,
    stripe_customer_id: 'cus_test_123',
    status: 'active',
    converted_at: new Date().toISOString(),
  },
  'trial.expired': {
    stripe_subscription_id: TEST_SUB_ID,
    stripe_customer_id: 'cus_test_123',
    status: 'expired',
    expired_at: new Date().toISOString(),
  },
  'trial.ending_soon': {
    stripe_subscription_id: TEST_SUB_ID,
    stripe_customer_id: 'cus_test_123',
    trial_end: new Date(Date.now() + 3 * 24 * 60 * 60 * 1000).toISOString(),
    days_remaining: 3,
  },
};

if (!payloads[EVENT_TYPE]) {
  console.error(`Unknown event type: ${EVENT_TYPE}`);
  console.error('Available:', Object.keys(payloads).join(', '));
  process.exit(1);
}

const event = {
  id: `evt_test_${Date.now()}`,
  type: EVENT_TYPE,
  created: Math.floor(Date.now() / 1000),
  app_id: 'test-app-id',
  data: payloads[EVENT_TYPE],
};

const body      = JSON.stringify(event);
const timestamp = Math.floor(Date.now() / 1000);
const signed    = `${timestamp}.${body}`;
const signature = SECRET
  ? crypto.createHmac('sha256', SECRET).update(signed, 'utf8').digest('hex')
  : 'no-secret-configured';

console.log(`\nSending: ${EVENT_TYPE}`);
console.log(`To:      ${URL}`);
console.log(`Payload: ${body}\n`);

fetch(URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'X-Webhook-Signature': `t=${timestamp},v1=${signature}`,
    'X-Webhook-Event': EVENT_TYPE,
  },
  body,
})
  .then(async (res) => {
    const text = await res.text();
    console.log(`Response: ${res.status} ${res.statusText}`);
    console.log(text);
  })
  .catch((err) => {
    console.error('Request failed — is the server running?', err.message);
  });
