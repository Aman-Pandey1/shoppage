import fetch from 'node-fetch';

const UBER_TOKEN_URL = 'https://login.uber.com/oauth/v2/token';
function resolveUberTokenUrls(env) {
  // In sandbox, only use sandbox login. In production, only use prod login.
  // Avoid cross-env tokens that later cause 401s against the customer ID.
  const envStr = String(env || '').toLowerCase().trim();
  if (envStr === 'sandbox') return ['https://sandbox-login.uber.com/oauth/v2/token'];
  return [UBER_TOKEN_URL];
}
function isUsingMock() {
  try {
    if (globalThis && (globalThis.__USE_MOCK_DATA === true)) return true;
  } catch {}
  const val = String(process.env.USE_MOCK_DATA || '').toLowerCase();
  return val === 'true';
}
function resolveUberCreds(creds) {
  // Only use per-site credentials passed by callers; do not fall back to env.
  const clientId = String(creds?.clientId || '').trim();
  const clientSecret = String(creds?.clientSecret || '').trim();
  const env = String(creds?.env || 'production').toLowerCase().trim();
  const scopes = Object.prototype.hasOwnProperty.call(creds || {}, 'scopes') ? (typeof creds?.scopes === 'string' ? creds.scopes.trim() : creds?.scopes ?? '') : undefined;
  const audience = typeof creds?.audience === 'string' ? creds.audience.trim() : undefined;
  return { clientId, clientSecret, env, scopes, audience };
}
function isMissingUberCreds(creds) {
  try {
    const { clientId, clientSecret } = resolveUberCreds(creds);
    return !clientId || !clientSecret;
  } catch {
    return true;
  }
}

// Cache tokens per clientId+resolvedEnv to support multi-tenant creds and prevent
// cross-environment reuse (e.g., production token used in sandbox calls). We also
// persist which environment actually issued the token so API base hosts can align
// even if the configured env is mismatched.
const tokenCache = new Map(); // key: `${clientId}::${resolvedEnv}` -> { token, expiryMs, envUsed }
function invalidateToken(clientId) {
  try {
    tokenCache.delete(`${clientId}::production`);
    tokenCache.delete(`${clientId}::sandbox`);
  } catch {}
}

async function getAccessToken(creds) {
  const { clientId, clientSecret, env, audience } = resolveUberCreds(creds);
  if (!clientId || !clientSecret) throw new Error('Uber credentials missing');
  // The configured env is a hint; the actual token may be issued by sandbox if production fails (or vice versa).
  // Prefer any non-expired cached token regardless of configured env.
  const now = Date.now();
  // Try production token first, then sandbox, for this clientId
  const prodKey = `${clientId}::production`;
  const sbxKey = `${clientId}::sandbox`;
  const existing = [tokenCache.get(prodKey), tokenCache.get(sbxKey)].find((e) => e && now < (e.expiryMs - 30000));
  if (existing && now < (existing.expiryMs - 30000)) return { token: existing.token, envUsed: existing.envUsed };

  // Scopes ordering and fallback strategy:
  // - If a scope was provided by the caller (including an explicit blank), try it first
  // - Then ALWAYS fall back to 'eats.deliveries' and then blank, to handle
  //   Uber apps that require one or the other. This makes the health check
  //   resilient without requiring the admin to guess the correct value.
  // - If no scope was provided by the caller, prefer env UBER_TOKEN_SCOPES first.
  const scopesPropProvided = creds && Object.prototype.hasOwnProperty.call(creds, 'scopes');
  const rawScopes = typeof creds?.scopes === 'string' ? creds.scopes : undefined;
  const trimmedScopes = typeof rawScopes === 'string' ? rawScopes.trim() : undefined;
  const scopeCandidates = [];
  const addCandidate = (s) => {
    if (typeof s !== 'string') return;
    // Keep order, avoid duplicates
    if (!scopeCandidates.includes(s)) scopeCandidates.push(s);
  };
  if (scopesPropProvided) {
    // Caller explicitly provided scopes; empty string means "no scope"
    addCandidate(trimmedScopes && trimmedScopes.length > 0 ? trimmedScopes : '');
  }
  // Always include safe fallbacks
  addCandidate('eats.deliveries');
  addCandidate('');

  // Audience ordering and fallback strategy:
  // - If audience was provided by the caller, try it first
  // - Then try environment-appropriate defaults:
  //     sandbox: 'https://sandbox-api.uber.com' then 'https://api.uber.com'
  //     production: 'https://api.uber.com' (legacy apps sometimes accept this in both envs)
  // - Finally, try with no audience parameter at all
  const audienceCandidates = [];
  const addAudience = (a) => {
    if (typeof a !== 'string') return;
    if (!audienceCandidates.includes(a)) audienceCandidates.push(a);
  };
  if (typeof audience === 'string' && audience.trim().length > 0) addAudience(audience.trim());
  // Prefer sandbox audience when env hint is sandbox
  if (env === 'sandbox') {
    addAudience('https://sandbox-api.uber.com');
  }
  addAudience('https://api.uber.com');
  addAudience('');

  const tokenUrls = resolveUberTokenUrls(env);
  let lastError = '';
  for (const tokenUrl of tokenUrls) {
    for (const scopeCandidate of scopeCandidates) {
      for (const audienceCandidate of audienceCandidates) {
      const body = new URLSearchParams();
      body.append('grant_type', 'client_credentials');
      body.append('client_id', clientId);
      body.append('client_secret', clientSecret);
      if (scopeCandidate) body.append('scope', scopeCandidate);
        if (audienceCandidate) body.append('audience', audienceCandidate);
      const res = await fetch(tokenUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body,
      });
      if (res.ok) {
        const data = await res.json();
        const token = data.access_token;
        const expiryMs = Date.now() + (Number(data.expires_in) * 1000);
        // Determine which environment the token should be used against.
        // Prefer detecting from token host and explicit audience used; fall back to requested env.
        const fromSandboxHost = /sandbox-login\.uber\.com/i.test(String(tokenUrl));
        const fromSandboxAudience = /^https:\/\/sandbox-api\.uber\.com$/i.test(String(audienceCandidate || ''));
        const envUsed = (fromSandboxHost || fromSandboxAudience)
          ? 'sandbox'
          : (env === 'sandbox' ? 'sandbox' : 'production');
        const key = `${clientId}::${envUsed}`;
        tokenCache.set(key, { token, expiryMs, envUsed });
        return { token, envUsed };
      }
      try {
        const text = await res.text();
        const msg = `Uber token error ${res.status} ${String(text).slice(0, 200)}`;
        lastError = msg;
        // Retry on invalid_scope only; otherwise, if tokenUrl is not the primary, go to next URL
        if (/invalid_scope/i.test(text)) {
            continue; // try next audience, then next scope or next host
        }
        // For other 4xx errors, do not attempt other scopes; break to next host
        if (res.status >= 400 && res.status < 500) break;
        // For 5xx errors, try next host if available
      } catch (e) {
        if (e instanceof Error) {
          lastError = e.message;
        } else {
          throw e;
        }
      }
      }
    }
  }
  if (/invalid_scope/i.test(String(lastError || ''))) {
    const hint = ' Hint: Ensure your Uber app has the "eats.deliveries" permission enabled. If it is not approved for Eats Deliveries, set Uber Token Scopes to blank in Site Settings. Also verify Sandbox vs Production match for both your app credentials and customer ID. If your app requires an OAuth audience, we also tried https://api.uber.com.';
    throw new Error((lastError || 'Uber token error') + hint);
  }
  throw new Error(lastError || 'Uber token error');
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

export async function requestQuote({ customerId, pickup, dropoff, creds, allowSimulation = true }) {
    // Simulate only when credentials are missing. Even if mock mode is on,
    // prefer calling Uber's sandbox/production when creds are provided so
    // admin tests and dashboards reflect real deliveries.
    if (isMissingUberCreds(creds)) {
        if (!allowSimulation) throw new Error('Uber credentials missing');
        return {
            id: `q-${Date.now()}`,
            fee: { amount: 799, currency_code: 'CAD' },
            dropoff_estimated_dt: new Date(Date.now() + 45 * 60 * 1000).toISOString(),
            simulated: true,
        };
    }
  const tokenInfo = await getAccessToken(creds);
  const envUsed = tokenInfo.envUsed || resolveUberCreds(creds).env;
  const base = envUsed === 'sandbox'
    ? 'https://sandbox-api.uber.com/v1/customers'
    : 'https://api.uber.com/v1/customers';
  const token = tokenInfo.token;
  const url = `${base}/${encodeURIComponent(customerId)}/delivery_quotes`; // POST
	const payload = {
    pickup_address: formatAddress(pickup.address),
    dropoff_address: formatAddress(dropoff.address),
		pickup_ready_dt: new Date().toISOString(),
	};
  let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await safeText(res);
    // If unauthorized, invalidate token and retry once (helps when cached token was minted with wrong audience)
    if (res.status === 401) {
      const { clientId } = resolveUberCreds(creds);
      invalidateToken(clientId);
      const retryToken = await getAccessToken(creds);
      const retryBase = (retryToken.envUsed || resolveUberCreds(creds).env) === 'sandbox'
        ? 'https://sandbox-api.uber.com/v1/customers'
        : 'https://api.uber.com/v1/customers';
      const retryUrl = `${retryBase}/${encodeURIComponent(customerId)}/delivery_quotes`;
      res = await fetch(retryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${retryToken.token}` }, body: JSON.stringify(payload) });
      if (res.ok) return res.json();
    }
    if (allowSimulation && (envUsed === 'sandbox' || isUsingMock()) && (res.status >= 500 || /address_undeliverable|Cannot find eligible product|internal_server_error/i.test(text))) {
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
  const tokenInfo = await getAccessToken(creds);
  const envUsed = tokenInfo.envUsed || resolveUberCreds(creds).env;
  const base = envUsed === 'sandbox'
    ? 'https://sandbox-api.uber.com/v1/customers'
    : 'https://api.uber.com/v1/customers';
  const token = tokenInfo.token;
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
  let res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(payload) });
  if (!res.ok) {
    const text = await safeText(res);
    if (res.status === 401) {
      const { clientId } = resolveUberCreds(creds);
      invalidateToken(clientId);
      const retryToken = await getAccessToken(creds);
      const retryBase = (retryToken.envUsed || resolveUberCreds(creds).env) === 'sandbox'
        ? 'https://sandbox-api.uber.com/v1/customers'
        : 'https://api.uber.com/v1/customers';
      const retryUrl = `${retryBase}/${encodeURIComponent(customerId)}/deliveries`;
      res = await fetch(retryUrl, { method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${retryToken.token}` }, body: JSON.stringify(payload) });
      if (res.ok) return res.json();
    }
		if (res.status === 400 && /manifest_items|toField:\s*size|unknown enum value/i.test(text)) {
      throw new Error('One or more items have an unsupported size. Use Small/Medium/Large or remove size.');
    }
		// Surface Uber's invalid phone message more clearly
		if (res.status === 400 && /pickup_phone_number|dropoff_phone_number|invalid_params/i.test(text)) {
			throw new Error('Phone number is invalid. Use E.164 format like +14155550123.');
		}
    if ((envUsed === 'sandbox' || isUsingMock()) && (res.status >= 500 || /address_undeliverable|Cannot find eligible product|internal_server_error/i.test(text))) {
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
    const tokenInfo = await getAccessToken(creds);
    const envUsed = tokenInfo.envUsed || resolveUberCreds(creds).env;
    const base = envUsed === 'sandbox'
      ? 'https://sandbox-api.uber.com/v1/customers'
      : 'https://api.uber.com/v1/customers';
    const token = tokenInfo.token;
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

