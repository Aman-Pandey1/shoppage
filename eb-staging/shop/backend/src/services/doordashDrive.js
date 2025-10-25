import fetch from 'node-fetch';

// NOTE: This is a minimal placeholder for DoorDash Drive integration.
// The real DoorDash Drive API requires HMAC-signed requests with Developer ID, Key ID,
// and Signing Secret. Implementing full auth here is out of scope for this change.
// We simulate quotes and deliveries when credentials are missing or in dev.

function isSimulated() {
  try {
    if (globalThis && (globalThis.__USE_MOCK_DATA === true)) return true;
  } catch {}
  const v = String(process.env.DD_SIMULATE || process.env.DOORDASH_SIMULATE || 'true').toLowerCase();
  return v === 'true';
}

export async function requestQuote({ storeId, pickup, dropoff }) {
  // Simulate a quote with a 40–55 minute ETA
  if (isSimulated()) {
    return {
      id: `ddq-${Date.now()}`,
      fee: { amount: 899, currency_code: (process.env.STRIPE_CURRENCY || 'USD').toUpperCase() },
      dropoff_estimated_dt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
      simulated: true,
    };
  }
  // TODO: Implement real DoorDash Drive quote API call using signed requests
  // For now, behave as simulated to avoid breaking flows
  return {
    id: `ddq-${Date.now()}`,
    fee: { amount: 899, currency_code: (process.env.STRIPE_CURRENCY || 'USD').toUpperCase() },
    dropoff_estimated_dt: new Date(Date.now() + 50 * 60 * 1000).toISOString(),
    simulated: true,
  };
}

export async function createDelivery({ storeId, pickup, dropoff, manifestItems, tip, externalId }) {
  if (isSimulated()) {
    const id = `ddd-${Date.now()}`;
    return {
      id,
      delivery_id: id,
      status: 'accepted',
      tracking_url: 'https://www.doordash.com/',
      share_url: 'https://www.doordash.com/',
      tip_by_customer: tip || 0,
      external_id: externalId,
      simulated: true,
    };
  }
  // TODO: Implement real DoorDash Drive create API call using signed requests
  const id = `ddd-${Date.now()}`;
  return {
    id,
    delivery_id: id,
    status: 'accepted',
    tracking_url: 'https://www.doordash.com/',
    share_url: 'https://www.doordash.com/',
    tip_by_customer: tip || 0,
    external_id: externalId,
    simulated: true,
  };
}
