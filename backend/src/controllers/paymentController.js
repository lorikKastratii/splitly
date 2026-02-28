const PAYMENT_API_URL = process.env.PAYMENT_API_URL;
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;

function getHeaders() {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': PAYMENT_API_KEY,
  };
}

exports.getPaymentConfig = async (_req, res) => {
  if (!PAYMENT_API_URL || !PAYMENT_API_KEY) {
    console.error('Payment API not configured: missing PAYMENT_API_URL or PAYMENT_API_KEY');
    return res.json({ paymentRequired: true });
  }

  try {
    const response = await fetch(`${PAYMENT_API_URL}/v2/configs/payment-required`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error('PaymentStripe config error:', response.status);
      return res.json({ paymentRequired: true });
    }

    const paymentRequired = await response.json();
    return res.json({ paymentRequired });
  } catch (error) {
    console.error('Payment config error:', error);
    return res.json({ paymentRequired: true });
  }
};

exports.getPlans = async (_req, res) => {
  if (!PAYMENT_API_URL || !PAYMENT_API_KEY) {
    return res.json({ plans: [] });
  }

  try {
    const response = await fetch(`${PAYMENT_API_URL}/v2/configs/plans`, {
      headers: getHeaders(),
    });

    if (!response.ok) {
      console.error('PaymentStripe plans error:', response.status);
      return res.json({ plans: [] });
    }

    const data = await response.json();
    const plans = data.data || data;
    return res.json({ plans: Array.isArray(plans) ? plans : [] });
  } catch (error) {
    console.error('Payment plans error:', error);
    return res.json({ plans: [] });
  }
};

exports.createIntent = async (req, res) => {
  const { planId } = req.body;

  if (!planId) {
    return res.status(400).json({ error: 'planId is required.' });
  }

  if (!PAYMENT_API_URL || !PAYMENT_API_KEY) {
    console.error('Payment API not configured: missing PAYMENT_API_URL or PAYMENT_API_KEY');
    return res.status(503).json({ error: 'Payment service unavailable.' });
  }

  try {
    const response = await fetch(`${PAYMENT_API_URL}/v2/payments/create-intent`, {
      method: 'POST',
      headers: getHeaders(),
      body: JSON.stringify({
        planId,
        userId: req.userId?.toString(),
        email: req.userEmail,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('PaymentStripe API error:', response.status, errorBody);
      return res.status(502).json({ error: 'Payment initialization failed. Please try again.' });
    }

    const data = await response.json();
    const payload = data.data || data;
    return res.json({
      clientSecret: payload.clientSecret || payload.client_secret,
      paymentIntentId: payload.paymentIntentId || payload.payment_intent_id,
    });
  } catch (error) {
    console.error('Payment controller error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
