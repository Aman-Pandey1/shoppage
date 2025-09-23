import fetch from 'node-fetch';

const UBER_TOKEN_URL = 'https://login.uber.com/oauth/v2/token';
const UBER_ENV = (process.env.UBER_ENV || 'production').toLowerCase();
const USING_MOCK = String(process.env.USE_MOCK_DATA || '').toLowerCase() === 'true';
const UBER_BASE = UBER_ENV === 'sandbox'
  ? 'https://sandbox-api.uber.com/v1/customers'
  : 'https://api.uber.com/v1/customers';

let cachedToken = null;
let cachedExpiry = 0;

async function getAccessToken() {
	const now = Date.now();
	if (cachedToken && now < cachedExpiry - 30000) return cachedToken;
	const clientId = process.env.UBER_CLIENT_ID;
	const clientSecret = process.env.UBER_CLIENT_SECRET;
	if (!clientId || !clientSecret) throw new Error('Uber credentials missing');
	const body = new URLSearchParams();
	body.append('grant_type', 'client_credentials');
	body.append('client_id', clientId);
	body.append('client_secret', clientSecret);
	body.append('scope', 'eats.deliveries');
	const res = await fetch(UBER_TOKEN_URL, { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body });
	if (!res.ok) throw new Error(`Uber token error ${res.status}`);
	const data = await res.json();
	cachedToken = data.access_token;
	cachedExpiry = now + (data.expires_in * 1000);
	return cachedToken;
}

export async function requestQuote({ customerId, pickup, dropoff }) {
	const token = await getAccessToken();
	const url = `${UBER_BASE}/${encodeURIComponent(customerId)}/delivery_quotes`; // POST
	const payload = {
    pickup_address: formatAddress(pickup.address),
    dropoff_address: formatAddress(dropoff.address),
		pickup_ready_dt: new Date().toISOString(),
	};
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await safeText(res);
    if ((UBER_ENV === 'sandbox' || USING_MOCK) && /address_undeliverable|Cannot find eligible product/i.test(text)) {
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

export async function createDelivery({ customerId, pickup, dropoff, manifestItems, tip, externalId }) {
	const token = await getAccessToken();
	const url = `${UBER_BASE}/${encodeURIComponent(customerId)}/deliveries`; // POST
	const payload = {
		pickup_name: pickup.name,
		pickup_phone_number: pickup.phone,
		pickup_address: formatAddress(pickup.address),
		dropoff_name: dropoff.name,
		dropoff_phone_number: dropoff.phone,
		dropoff_address: formatAddress(dropoff.address),
		manifest_items: manifestItems,
		tip_by_customer: tip || 0,
		external_id: externalId,
	};
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await safeText(res);
    if ((UBER_ENV === 'sandbox' || USING_MOCK) && /address_undeliverable|Cannot find eligible product/i.test(text)) {
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

export async function getDelivery({ customerId, deliveryId }) {
    const token = await getAccessToken();
    const url = `${UBER_BASE}/${encodeURIComponent(customerId)}/deliveries/${encodeURIComponent(deliveryId)}`; // GET
    const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) {
        const text = await safeText(res);
        throw new Error(`Uber get delivery error ${res.status} ${text}`);
    }
    return res.json();
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

