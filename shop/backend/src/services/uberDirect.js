import fetch from 'node-fetch';

const UBER_TOKEN_URL = 'https://login.uber.com/oauth/v2/token';
const UBER_ENV = (process.env.UBER_ENV || 'production').toLowerCase();
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
		pickup_address: JSON.stringify(mapAddress(pickup.address)),
		dropoff_address: JSON.stringify(mapAddress(dropoff.address)),
		pickup_ready_dt: new Date().toISOString(),
	};
	const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
	if (!res.ok) throw new Error(`Uber quote error ${res.status}`);
	return res.json();
}

export async function createDelivery({ customerId, pickup, dropoff, manifestItems, tip, externalId }) {
	const token = await getAccessToken();
	const url = `${UBER_BASE}/${encodeURIComponent(customerId)}/deliveries`; // POST
	const payload = {
		pickup_name: pickup.name,
		pickup_phone_number: pickup.phone,
		pickup_address: JSON.stringify(mapAddress(pickup.address)),
		dropoff_name: dropoff.name,
		dropoff_phone_number: dropoff.phone,
		dropoff_address: JSON.stringify(mapAddress(dropoff.address)),
		manifest_items: manifestItems,
		tip_by_customer: tip || 0,
		external_id: externalId,
	};
	const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
	if (!res.ok) throw new Error(`Uber create error ${res.status}`);
	return res.json();
}

function mapAddress(addr) {
	return {
		street_address: addr.streetAddress,
		city: addr.city,
		state: addr.province,
		zip_code: addr.postalCode,
		country: addr.country || 'CA',
	};
}

