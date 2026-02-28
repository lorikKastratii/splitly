function getConfig() {
  const getEnvValue = (aliases) => {
    for (const alias of aliases) {
      if (process.env[alias]) return process.env[alias];
    }

    const envKeys = Object.keys(process.env);
    for (const alias of aliases) {
      const matchedKey = envKeys.find((envKey) => envKey.trim() === alias);
      if (matchedKey && process.env[matchedKey]) {
        return process.env[matchedKey];
      }
    }

    return '';
  };

  const sanitize = (value) => {
    if (typeof value !== 'string') return '';
    const trimmed = value.trim().replace(/^['\"]|['\"]$/g, '');
    if (!trimmed) return '';
    const lower = trimmed.toLowerCase();
    if (lower === 'undefined' || lower === 'null') return '';
    return trimmed;
  };

  const rawUrl = sanitize(getEnvValue([
    'PAYMENT_API_URL',
    'PAYMENTSTRIPE_API_URL',
    'PAYMENT_URL',
  ]));

  const rawKey = sanitize(getEnvValue([
    'PAYMENT_API_KEY',
    'PAYMENTSTRIPE_API_KEY',
    'PAYMENT_APIKEY',
    'PAYMENT_KEY',
  ]));

  const normalizedUrl = !rawUrl
    ? rawUrl
    : /^https?:\/\//i.test(rawUrl)
      ? rawUrl
      : `https://${rawUrl}`;

  return {
    url: normalizedUrl,
    key: rawKey,
  };
}

function getHeaders(apiKey) {
  return {
    'Content-Type': 'application/json',
    'X-Api-Key': apiKey,
  };
}

async function syncUserWithPaymentApi(userId, email) {
  if (!userId) return false;

  const { url, key } = getConfig();
  if (!url || !key) {
    logMissingConfigContext(url, key);
    return false;
  }

  try {
    const response = await fetch(`${url}/v2/users/sync`, {
      method: 'POST',
      headers: getHeaders(key),
      body: JSON.stringify({
        userId: String(userId),
        email: email || null,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('Payment user sync failed:', response.status, errorBody);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Payment user sync error:', error);
    return false;
  }
}

function normalizePaymentRequired(payload) {
  if (typeof payload === 'boolean') return payload;
  if (typeof payload?.data === 'boolean') return payload.data;
  if (typeof payload?.paymentRequired === 'boolean') return payload.paymentRequired;
  return true;
}

function normalizePlan(plan) {
  if (!plan || typeof plan !== 'object') return null;

  const id = plan.id ?? plan.Id;
  const name = plan.name ?? plan.Name;
  const description = plan.description ?? plan.Description ?? '';
  const priceInCents = Number(plan.priceInCents ?? plan.PriceInCents);
  const currency = (plan.currency ?? plan.Currency ?? 'eur').toString().toLowerCase();
  const billingPeriod = (plan.billingPeriod ?? plan.BillingPeriod ?? 'monthly').toString().toLowerCase();
  const sortOrder = Number(plan.sortOrder ?? plan.SortOrder ?? 0);

  if (!id || !name || Number.isNaN(priceInCents)) {
    return null;
  }

  return {
    id: String(id),
    name: String(name),
    description: String(description),
    priceInCents,
    currency,
    billingPeriod,
    sortOrder: Number.isNaN(sortOrder) ? 0 : sortOrder,
  };
}

function extractPlans(payload) {
  const candidates = [
    payload,
    payload?.data,
    payload?.plans,
    payload?.data?.plans,
    payload?.result,
    payload?.result?.plans,
  ];

  const rawPlans = candidates.find(Array.isArray) || [];
  return rawPlans.map(normalizePlan).filter(Boolean);
}

function logMissingConfigContext(url, key) {
  const paymentEnvKeys = Object.keys(process.env)
    .filter((name) => name.startsWith('PAYMENT'));

  console.error('Payment API not configured: missing PAYMENT_API_URL or PAYMENT_API_KEY', {
    hasUrl: Boolean(url),
    hasKey: Boolean(key),
    paymentEnvKeys,
  });
}

exports.getPaymentConfig = async (_req, res) => {
  const { url, key } = getConfig();

  if (!url || !key) {
    logMissingConfigContext(url, key);
    return res.json({ paymentRequired: true });
  }

  try {
    const response = await fetch(`${url}/v2/configs/payment-required`, {
      headers: getHeaders(key),
    });

    if (!response.ok) {
      console.error('PaymentStripe config error:', response.status);
      return res.json({ paymentRequired: true });
    }

    const data = await response.json();
    return res.json({ paymentRequired: normalizePaymentRequired(data) });
  } catch (error) {
    console.error('Payment config error:', error);
    return res.json({ paymentRequired: true });
  }
};

exports.getPlans = async (_req, res) => {
  const { url, key } = getConfig();

  if (!url || !key) {
    logMissingConfigContext(url, key);
    return res.json({ plans: [] });
  }

  try {
    const response = await fetch(`${url}/v2/configs/plans`, {
      headers: getHeaders(key),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('PaymentStripe plans error:', response.status, errorBody);
      return res.json({ plans: [] });
    }

    const data = await response.json();
    return res.json({ plans: extractPlans(data) });
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

  const { url, key } = getConfig();

  if (!url || !key) {
    logMissingConfigContext(url, key);
    return res.status(503).json({ error: 'Payment service unavailable.' });
  }

  try {
    const response = await fetch(`${url}/v2/payments/create-intent`, {
      method: 'POST',
      headers: getHeaders(key),
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

exports.syncUserWithPaymentApi = syncUserWithPaymentApi;
