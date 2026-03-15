const { pool } = require('../config/database');

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
        externalId: String(userId),
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

function extractSyncPayload(payload) {
  if (!payload || typeof payload !== 'object') return {};

  const candidates = [
    payload,
    payload?.data,
    payload?.result,
  ];

  return candidates.find((candidate) => candidate && typeof candidate === 'object') || {};
}

function normalizeLifetimeAccess(payload) {
  const syncPayload = extractSyncPayload(payload);

  const directFlag = syncPayload.hasLifetimeAccess;
  const pascalFlag = syncPayload.HasLifetimeAccess;

  if (typeof directFlag === 'boolean') return directFlag;
  if (typeof pascalFlag === 'boolean') return pascalFlag;
  return false;
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
        externalId: req.userId?.toString(),
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

exports.getEntitlement = async (req, res) => {
  const userId = req.userId;
  const userEmail = req.userEmail;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, key } = getConfig();

  if (!url || !key) {
    logMissingConfigContext(url, key);
    return res.json({
      synced: false,
      hasLifetimeAccess: false,
      tier: 'free',
    });
  }

  try {
    const response = await fetch(`${url}/v2/users/sync`, {
      method: 'POST',
      headers: getHeaders(key),
      body: JSON.stringify({
        externalId: String(userId),
        email: userEmail || null,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('Payment entitlement sync failed:', response.status, errorBody);
      return res.status(502).json({ error: 'Failed to retrieve payment entitlement.' });
    }

    const data = await response.json();
    const hasLifetimeAccess = normalizeLifetimeAccess(data);

    return res.json({
      synced: true,
      hasLifetimeAccess,
      tier: hasLifetimeAccess ? 'lifetime' : 'free',
    });
  } catch (error) {
    console.error('Payment entitlement error:', error);
    return res.status(500).json({ error: 'Failed to retrieve payment entitlement.' });
  }
};

// ── Trial endpoints ─────────────────────────────────────────────────────────

exports.checkTrialEligibility = async (req, res) => {
  const { planId, deviceFingerprint } = req.body;

  if (!planId) {
    return res.status(400).json({ error: 'planId is required.' });
  }

  const { url, key } = getConfig();

  if (!url || !key) {
    logMissingConfigContext(url, key);
    return res.status(503).json({ error: 'Payment service unavailable.' });
  }

  try {
    const response = await fetch(`${url}/v2/trials/check-eligibility`, {
      method: 'POST',
      headers: getHeaders(key),
      body: JSON.stringify({
        planId,
        externalId: req.userId?.toString(),
        email: req.userEmail || null,
        deviceFingerprint: deviceFingerprint || null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const payload = data.data || data;
    return res.json({
      eligible: payload.eligible ?? false,
      reason: payload.reason ?? null,
      trialDays: payload.trialDays ?? payload.TrialDays ?? 0,
      requiresCard: payload.requiresCard ?? payload.RequiresCard ?? false,
      introPriceInCents: payload.introPriceInCents ?? payload.IntroPriceInCents ?? null,
      regularPriceInCents: payload.regularPriceInCents ?? payload.RegularPriceInCents ?? null,
      currency: payload.currency ?? payload.Currency ?? null,
    });
  } catch (error) {
    console.error('Trial eligibility check error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

exports.startTrial = async (req, res) => {
  const { planId, paymentMethodId, deviceFingerprint } = req.body;

  if (!planId) {
    return res.status(400).json({ error: 'planId is required.' });
  }

  const { url, key } = getConfig();

  if (!url || !key) {
    logMissingConfigContext(url, key);
    return res.status(503).json({ error: 'Payment service unavailable.' });
  }

  try {
    const response = await fetch(`${url}/v2/trials/start`, {
      method: 'POST',
      headers: getHeaders(key),
      body: JSON.stringify({
        planId,
        externalId: req.userId?.toString(),
        email: req.userEmail || null,
        paymentMethodId: paymentMethodId || null,
        deviceFingerprint: deviceFingerprint || null,
      }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const payload = data.data || data;
    const stripeSubscriptionId = payload.stripeSubscriptionId ?? payload.StripeSubscriptionId;

    if (stripeSubscriptionId && req.userId) {
      pool.query(
        `INSERT INTO user_subscriptions (user_id, stripe_subscription_id, plan_id, status, trial_end)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (stripe_subscription_id) DO UPDATE
           SET status = EXCLUDED.status, trial_end = EXCLUDED.trial_end, updated_at = NOW()`,
        [
          req.userId,
          stripeSubscriptionId,
          planId,
          payload.status ?? payload.Status ?? 'trialing',
          payload.trialEnd ?? payload.TrialEnd ?? null,
        ],
      ).catch((err) => console.error('Failed to save user subscription mapping:', err));
    }

    return res.json({
      subscriptionId: payload.subscriptionId ?? payload.SubscriptionId,
      stripeSubscriptionId,
      status: payload.status ?? payload.Status,
      trialEnd: payload.trialEnd ?? payload.TrialEnd,
      trialDays: payload.trialDays ?? payload.TrialDays,
      planName: payload.planName ?? payload.PlanName,
      requiresCard: payload.requiresCard ?? payload.RequiresCard,
    });
  } catch (error) {
    console.error('Start trial error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

exports.cancelTrial = async (req, res) => {
  const { subscriptionId } = req.params;

  const { url, key } = getConfig();

  if (!url || !key) {
    logMissingConfigContext(url, key);
    return res.status(503).json({ error: 'Payment service unavailable.' });
  }

  try {
    const response = await fetch(`${url}/v2/trials/${subscriptionId}/cancel`, {
      method: 'POST',
      headers: getHeaders(key),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const payload = data.data || data;
    return res.json({
      subscriptionId: payload.Id ?? payload.id ?? subscriptionId,
      status: payload.Status ?? payload.status,
      canceledAt: payload.canceledAt ?? new Date().toISOString(),
    });
  } catch (error) {
    console.error('Cancel trial error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

// ── Feature entitlements endpoint ────────────────────────────────────────────

exports.getFeatures = async (req, res) => {
  const userId = req.userId;

  if (!userId) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { url, key } = getConfig();

  if (!url || !key) {
    logMissingConfigContext(url, key);
    return res.json({ features: [], isFreeTier: true });
  }

  try {
    const response = await fetch(`${url}/v2/entitlements?externalId=${encodeURIComponent(String(userId))}`, {
      headers: getHeaders(key),
    });

    if (!response.ok) {
      const errorBody = await response.text().catch(() => '');
      console.error('Payment features fetch failed:', response.status, errorBody);
      return res.json({ features: [], isFreeTier: true });
    }

    const data = await response.json();
    const payload = data.data || data;

    const features = (payload.features || []).map((f) => ({
      key: f.key || f.Key,
      type: f.type || f.Type || 'boolean',
      booleanValue: f.booleanValue ?? f.BooleanValue ?? null,
      numericValue: f.numericValue ?? f.NumericValue ?? null,
    }));

    return res.json({
      features,
      isFreeTier: payload.isFreeTier ?? payload.IsFreeTier ?? true,
      planName: payload.planName ?? payload.PlanName ?? null,
    });
  } catch (error) {
    console.error('Payment features error:', error);
    return res.json({ features: [], isFreeTier: true });
  }
};

exports.syncUserWithPaymentApi = syncUserWithPaymentApi;

// ── Coupon endpoints ────────────────────────────────────────────────────────

exports.validateCoupon = async (req, res) => {
  const { code, planId } = req.body;

  if (!code || !planId) {
    return res.status(400).json({ error: 'code and planId are required.' });
  }

  const { url, key } = getConfig();

  if (!url || !key) {
    logMissingConfigContext(url, key);
    return res.status(503).json({ error: 'Payment service unavailable.' });
  }

  try {
    const response = await fetch(`${url}/v2/coupons/validate`, {
      method: 'POST',
      headers: getHeaders(key),
      body: JSON.stringify({ code, planId }),
    });

    const data = await response.json();

    if (!response.ok) {
      return res.status(response.status).json(data);
    }

    const payload = data.data || data;
    return res.json({
      valid: payload.valid ?? false,
      discountType: payload.discountType ?? null,
      percentOff: payload.percentOff ?? null,
      amountOffCents: payload.amountOffCents ?? null,
      currency: payload.currency ?? null,
      duration: payload.duration ?? null,
      durationInMonths: payload.durationInMonths ?? null,
      couponName: payload.couponName ?? null,
      originalPriceCents: payload.originalPriceCents ?? null,
      discountedPriceCents: payload.discountedPriceCents ?? null,
      error: payload.error ?? null,
    });
  } catch (error) {
    console.error('Coupon validation error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};

exports.createIntentWithCoupon = async (req, res) => {
  const { planId, promotionCode } = req.body;

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
        externalId: req.userId?.toString(),
        email: req.userEmail,
        promotionCode: promotionCode || null,
      }),
    });

    if (!response.ok) {
      const errorBody = await response.json().catch(() => ({}));
      console.error('PaymentStripe API error:', response.status, errorBody);
      const msg = errorBody?.error?.message || 'Payment initialization failed. Please try again.';
      return res.status(502).json({ error: msg });
    }

    const data = await response.json();
    const payload = data.data || data;
    return res.json({
      clientSecret: payload.clientSecret || payload.client_secret,
      paymentIntentId: payload.paymentIntentId || payload.payment_intent_id,
      originalAmountCents: payload.originalAmountCents ?? null,
      discountAmountCents: payload.discountAmountCents ?? null,
      finalAmountCents: payload.finalAmountCents ?? null,
      promotionCode: payload.promotionCode ?? null,
    });
  } catch (error) {
    console.error('Payment controller error:', error);
    return res.status(500).json({ error: 'An unexpected error occurred.' });
  }
};
