const PAYMENT_API_URL = process.env.PAYMENT_API_URL;
const PAYMENT_API_KEY = process.env.PAYMENT_API_KEY;

const VALID_PLANS = ['monthly', 'yearly', 'lifetime'];

exports.createIntent = async (req, res) => {
  const { plan } = req.body;

  if (!plan || !VALID_PLANS.includes(plan)) {
    return res.status(400).json({ error: 'Invalid plan. Must be monthly, yearly, or lifetime.' });
  }

  if (!PAYMENT_API_URL || !PAYMENT_API_KEY) {
    console.error('Payment API not configured: missing PAYMENT_API_URL or PAYMENT_API_KEY');
    return res.status(503).json({ error: 'Payment service unavailable.' });
  }

  try {
    const response = await fetch(`${PAYMENT_API_URL}/payments/create-intent`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Api-Key': PAYMENT_API_KEY,
      },
      body: JSON.stringify({
        plan,
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

    // data.data contains the clientSecret and paymentIntentId from the .NET API
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
