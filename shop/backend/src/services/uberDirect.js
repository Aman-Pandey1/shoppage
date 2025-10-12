import fetch from 'node-fetch';

const UBER_TOKEN_URL = 'https://login.uber.com/oauth/v2/token';
function isUsingMock() {
  try {
    if (globalThis && (globalThis.__USE_MOCK_DATA === true)) return true;
  } catch {}
  const val = String(process.env.USE_MOCK_DATA || '').toLowerCase();
  return val === 'true';
}
function resolveUberCreds(creds) {
  const clientId = creds?.clientId || process.env.UBER_CLIENT_ID || '';
  const clientSecret = creds?.clientSecret || process.env.UBER_CLIENT_SECRET || '';
  const env = String(creds?.env || process.env.UBER_ENV || 'production').toLowerCase();
  return { clientId, clientSecret, env };
}
function isMissingUberCreds(creds) {
  try {
    const { clientId, clientSecret } = resolveUberCreds(creds);
    return !clientId || !clientSecret;
  } catch {
    return true;
  }
}

// Cache tokens per clientId to support multi-tenant creds
const tokenCache = new Map(); // key: clientId -> { token, expiryMs }

async function getAccessToken(creds) {
  const { clientId, clientSecret } = resolveUberCreds(creds);
  if (!clientId || !clientSecret) throw new Error('Uber credentials missing');
  const now = Date.now();
  const existing = tokenCache.get(clientId);
  if (existing && now < (existing.expiryMs - 30000)) return existing.token;
  const body = new URLSearchParams();
  body.append('grant_type', 'client_credentials');
  body.append('client_id', clientId);
  body.append('client_secret', clientSecret);
  body.append('scope', 'eats.deliveries');
  const res = await fetch(UBER_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
  if (!res.ok) {
    let text = '';
    try { text = await res.text(); } catch {}
    throw new Error(`Uber token error ${res.status} ${String(text).slice(0,200)}`);
  }
  const data = await res.json();
  const token = data.access_token;
  const expiryMs = now + (Number(data.expires_in) * 1000);
  tokenCache.set(clientId, { token, expiryMs });
  return token;
}

function normalizeE164Phone(raw, fallback) {
	try {
		const cleaned = String(raw || '').replace(/[^\d+]/g, '');
		if (!cleaned) return fallback ?? '';
		// Ensure a single leading plus and only digits after
		let withPlus = cleaned.startsWith('+') ? cleaned : ('+' + cleaned);
		if (/^\+[1-9]\d{7,14}$/.test(withPlus)) return withPlus;
		// Collapse multiple plus signs if present
		withPlus = '+' + cleaned.replace(/\+/g, '');
		if (/^\+[1-9]\d{7,14}$/.test(withPlus)) return withPlus;
		return fallback ?? '';
	} catch {
		return fallback ?? '';
	}
}

export async function requestQuote({ customerId, pickup, dropoff, creds }) {
    // Simulate only when credentials are missing. Even if mock mode is on,
    // prefer calling Uber's sandbox/production when creds are provided so
    // admin tests and dashboards reflect real deliveries.
    if (isMissingUberCreds(creds)) {
        return {
            id: `q-${Date.now()}`,
            fee: { amount: 799, currency_code: 'CAD' },
            dropoff_estimated_dt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
            simulated: true,
        };
    }
  const { env } = resolveUberCreds(creds);
  const base = env === 'sandbox'
    ? 'https://sandbox-api.uber.com/v1/customers'
    : 'https://api.uber.com/v1/customers';
  const token = await getAccessToken(creds);
  const url = `${base}/${encodeURIComponent(customerId)}/delivery_quotes`; // POST
	const payload = {
    pickup_address: formatAddress(pickup.address),
    dropoff_address: formatAddress(dropoff.address),
		pickup_ready_dt: new Date().toISOString(),
	};
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await safeText(res);
    if ((env === 'sandbox' || isUsingMock()) && (res.status >= 500 || /address_undeliverable|Cannot find eligible product|internal_server_error/i.test(text))) {
      // Return a simulated quote to unblock testing
      return {
        id: `q-${Date.now()}`,
        fee: { amount: 799, currency_code: 'CAD' },
        dropoff_estimated_dt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
        simulated: true,
      };
    }
    throw new Error(`Uber quote error ${res.status} ${text}`);
  }
  return res.json();
}

export async function createDelivery({ customerId, pickup, dropoff, manifestItems, tip, externalId, creds }) {
    // Simulate only when credentials are missing. Even if mock mode is on,
    // prefer calling Uber's sandbox/production when creds are provided so
    // admin tests and dashboards reflect real deliveries.
    if (isMissingUberCreds(creds)) {
        const id = `d-${Date.now()}`;
        return {
            id,
            delivery_id: id,
            status: 'courier_accepted',
            tracking_url: `https://www.uber.com/`,
            share_url: `https://www.uber.com/`,
            tip_by_customer: tip || 0,
            external_id: externalId,
            simulated: true,
        };
    }
  const { env } = resolveUberCreds(creds);
  const base = env === 'sandbox'
    ? 'https://sandbox-api.uber.com/v1/customers'
    : 'https://api.uber.com/v1/customers';
  const token = await getAccessToken(creds);
  const url = `${base}/${encodeURIComponent(customerId)}/deliveries`; // POST
	const safeManifestItems = sanitizeManifestItems(manifestItems);
	// Ensure pickup phone is valid E.164. In sandbox or when missing/invalid, use a fixed test number.
	const normalizedPickupPhone = normalizeE164Phone(pickup?.phone, '+14155550123');
	const payload = {
		pickup_name: pickup.name,
		pickup_phone_number: normalizedPickupPhone,
		pickup_address: formatAddress(pickup.address),
		dropoff_name: dropoff.name,
		dropoff_phone_number: normalizeE164Phone(dropoff.phone),
		dropoff_address: formatAddress(dropoff.address),
		manifest_items: safeManifestItems,
		tip_by_customer: tip || 0,
		external_id: externalId,
	};
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await safeText(res);
		if (res.status === 400 && /manifest_items|toField:\s*size|unknown enum value/i.test(text)) {
      throw new Error('One or more items have an unsupported size. Use Small/Medium/Large or remove size.');
    }
		// Surface Uber's invalid phone message more clearly
		if (res.status === 400 && /pickup_phone_number|dropoff_phone_number|invalid_params/i.test(text)) {
			throw new Error('Phone number is invalid. Use E.164 format like +14155550123.');
		}
    if ((env === 'sandbox' || isUsingMock()) && (res.status >= 500 || /address_undeliverable|Cannot find eligible product|internal_server_error/i.test(text))) {
      // Simulate delivery object for testing
      const id = `d-${Date.now()}`;
      return {
        id,
        delivery_id: id,
        status: 'courier_accepted',
        tracking_url: `https://www.uber.com/`,
        share_url: `https://www.uber.com/`,
        tip_by_customer: tip || 0,
        external_id: externalId,
        simulated: true,
      };
    }
    throw new Error(`Uber create error ${res.status} ${text}`);
  }
  return res.json();
}

export async function getDelivery({ customerId, deliveryId, creds }) {
    const { env } = resolveUberCreds(creds);
    const base = env === 'sandbox'
      ? 'https://sandbox-api.uber.com/v1/customers'
      : 'https://api.uber.com/v1/customers';
    const token = await getAccessToken(creds);
    const url = `${base}/${encodeURIComponent(customerId)}/deliveries/${encodeURIComponent(deliveryId)}`; // GET
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        const text = await safeText(res);
        throw new Error(`Uber get delivery error ${res.status} ${text}`);
    }
    return res.json();
}

function sanitizeManifestItems(items) {
	try {
		const allowedSizes = new Set(['small', 'medium', 'large']);
		const list = Array.isArray(items) ? items : [];
		return list.map((m) => {
			const name = String(m?.name || '').trim() || 'Item';
			const quantityNum = Number(m?.quantity);
			const quantity = Number.isFinite(quantityNum) && quantityNum > 0 ? Math.floor(quantityNum) : 1;
			const out = { name, quantity };
			const rawSizeLabel = typeof m?.size === 'string' ? m.size.trim() : '';
			const rawSize = rawSizeLabel ? rawSizeLabel.toLowerCase() : '';
			let normalizedSize = '';
			if (rawSize) {
				if (['s', 'sm'].includes(rawSize)) normalizedSize = 'small';
				else if (['m', 'md', 'medium'].includes(rawSize)) normalizedSize = 'medium';
				else if (['l', 'lg', 'xl', 'x-large', 'xlarge', 'extra large', 'extra-large', 'large'].includes(rawSize)) normalizedSize = 'large';
			}
			if (normalizedSize && allowedSizes.has(normalizedSize)) {
				out.size = normalizedSize;
			} else if (rawSizeLabel) {
				// Preserve non-size variant labels by appending to the item name,
				// while ensuring we never send an unsupported size enum to Uber.
				out.name = `${name} (${rawSizeLabel})`;
			}
			return out;
		});
	} catch {
		return [];
	}
}

function formatAddress(addr) {
  const lines = Array.isArray(addr.streetAddress) ? addr.streetAddress : [addr.streetAddress];
  const country = String(addr.country || 'CA').toUpperCase();
  const province = normalizeProvince(addr.province, country);
  const postal = String(addr.postalCode || '').toUpperCase().replace(/\s+/g, ' ').trim();
  const parts = [
    ...lines.filter(Boolean).map((s) => String(s).trim()),
    addr.city,
    province,
    postal,
    country,
  ].filter(Boolean);
  return parts.join(', ');
}

function normalizeProvince(prov, country) {
  if (!prov) return prov;
  const p = String(prov).trim();
  if (p.length <= 3) return p.toUpperCase();
  if (country === 'CA') {
    const map = {
      alberta: 'AB', britishcolumbia: 'BC', manitoba: 'MB', newbrunswick: 'NB', newfoundlandandlabrador: 'NL',
      northwestterritories: 'NT', novascotia: 'NS', nunavut: 'NU', ontario: 'ON', princeedwardisland: 'PE',
      quebec: 'QC', saskatchewan: 'SK', yukon: 'YT'
    };
    const key = p.toLowerCase().replace(/[^a-z]/g, '');
    return map[key] || p;
  }
  if (country === 'US') {
    const states = {
      alabama: 'AL', alaska: 'AK', arizona: 'AZ', arkansas: 'AR', california: 'CA', colorado: 'CO', connecticut: 'CT',
      delaware: 'DE', florida: 'FL', georgia: 'GA', hawaii: 'HI', idaho: 'ID', illinois: 'IL', indiana: 'IN', iowa: 'IA',
      kansas: 'KS', kentucky: 'KY', louisiana: 'LA', maine: 'ME', maryland: 'MD', massachusetts: 'MA', michigan: 'MI',
      minnesota: 'MN', mississippi: 'MS', missouri: 'MO', montana: 'MT', nebraska: 'NE', nevada: 'NV', 'new hampshire': 'NH',
      'new jersey': 'NJ', 'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', ohio: 'OH',
      oklahoma: 'OK', oregon: 'OR', pennsylvania: 'PA', 'rhode island': 'RI', 'south carolina': 'SC', 'south dakota': 'SD',
      tennessee: 'TN', texas: 'TX', utah: 'UT', vermont: 'VT', virginia: 'VA', washington: 'WA', 'west virginia': 'WV',
      wisconsin: 'WI', wyoming: 'WY'
    };
    const key = p.toLowerCase();
    return states[key] || p;
  }
  return p;
}

async function safeText(res) {
  try {
    const text = await res.text();
    return text?.slice(0, 500) || '';
  } catch {
    return '';
  }
}

