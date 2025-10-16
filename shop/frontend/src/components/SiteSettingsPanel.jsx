import React from 'react';
import { fetchJsonAllowError, patchJson, resolveAssetUrl, postFile, API_BASE_URL } from '../lib/api';
import { Modal } from './Modal';

export const SiteSettingsPanel = ({ site, selectedSiteId, onSiteUpdated }) => {
  const [pickupName, setPickupName] = React.useState(site?.pickup?.name || '');
  const [pickupPhone, setPickupPhone] = React.useState(site?.pickup?.phone || '');
  const [addr1, setAddr1] = React.useState(site?.pickup?.address?.streetAddress?.[0] || '');
  const [addr2, setAddr2] = React.useState(site?.pickup?.address?.streetAddress?.[1] || '');
  const [city, setCity] = React.useState(site?.pickup?.address?.city || '');
  const [province, setProvince] = React.useState(site?.pickup?.address?.province || '');
  const [postalCode, setPostalCode] = React.useState(site?.pickup?.address?.postalCode || '');
  const [country, setCountry] = React.useState(site?.pickup?.address?.country || 'CA');
  const [uberCustomerId, setUberCustomerId] = React.useState(site?.uberCustomerId || '');
  const [brandColor, setBrandColor] = React.useState(site?.brandColor || '#0ea5e9');
  const [stripeAccountId, setStripeAccountId] = React.useState(site?.stripeAccountId || '');
  const [stripePublishableKey, setStripePublishableKey] = React.useState(site?.stripePublishableKey || '');
  const [stripeSecretKey, setStripeSecretKey] = React.useState(site?.stripeSecretKey || '');
  const [stripeWebhookSecret, setStripeWebhookSecret] = React.useState(site?.stripeWebhookSecret || '');
  const [tagline, setTagline] = React.useState(site?.tagline || '');
  const [deliveryProvider, setDeliveryProvider] = React.useState(site?.deliveryProvider || 'uber');
  const [uberClientId, setUberClientId] = React.useState(site?.uberClientId || '');
  const [uberClientSecret, setUberClientSecret] = React.useState(site?.uberClientSecret || '');
  const [uberEnv, setUberEnv] = React.useState(site?.uberEnv || 'production');
  const [uberTokenScopes, setUberTokenScopes] = React.useState(site?.uberTokenScopes ?? '');
  const [uberWebhookSecret, setUberWebhookSecret] = React.useState(site?.uberWebhookSecret || '');
  const [doordashStoreId, setDoordashStoreId] = React.useState(site?.doordashStoreId || '');
  const [doordashDeveloperId, setDoordashDeveloperId] = React.useState(site?.doordashDeveloperId || '');
  const [doordashKeyId, setDoordashKeyId] = React.useState(site?.doordashKeyId || '');
  const [doordashSigningSecret, setDoordashSigningSecret] = React.useState(site?.doordashSigningSecret || '');
  const [locations, setLocations] = React.useState(Array.isArray(site?.locations) ? site.locations : []);
  const [cities, setCities] = React.useState(Array.isArray(site?.cities) ? site.cities : []);
  const [deliveryFee, setDeliveryFee] = React.useState(((Number(site?.deliveryFeeCents)||0)/100).toFixed(2));
  const [splitDeliveryFee, setSplitDeliveryFee] = React.useState(!!site?.splitDeliveryFee);
  const [maxDeliveryDistanceKm, setMaxDeliveryDistanceKm] = React.useState(site?.maxDeliveryDistanceKm ?? '');
  const [logoUrl, setLogoUrl] = React.useState(site?.logoUrl || '');
  const [logoLinkUrl, setLogoLinkUrl] = React.useState(site?.logoLinkUrl || '');
  const [supportWhatsappPhone, setSupportWhatsappPhone] = React.useState(site?.supportWhatsappPhone || '');
  const [logoFile, setLogoFile] = React.useState(null);
  const [hours, setHours] = React.useState(site?.hours || {
    mon: { open: '10:00', close: '22:00', closed: false },
    tue: { open: '10:00', close: '22:00', closed: false },
    wed: { open: '10:00', close: '22:00', closed: false },
    thu: { open: '10:00', close: '22:00', closed: false },
    fri: { open: '10:00', close: '22:00', closed: false },
    sat: { open: '10:00', close: '22:00', closed: false },
    sun: { open: '10:00', close: '22:00', closed: false },
  });
  const [saving, setSaving] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(null);
  const [currency, setCurrency] = React.useState(site?.currency || 'usd');
  const [timeZone, setTimeZone] = React.useState(site?.timeZone || '');
  const [minOrderCents, setMinOrderCents] = React.useState(site?.minOrderCents ?? '');
  const [couponMinSubtotalCents, setCouponMinSubtotalCents] = React.useState(site?.couponMinSubtotalCents ?? '');
  const [orderNotifyUrl, setOrderNotifyUrl] = React.useState(site?.orderNotifyUrl || '');
  const [testingUber, setTestingUber] = React.useState(false);
  const [uberStatus, setUberStatus] = React.useState(null);
  const [testingDoorDash, setTestingDoorDash] = React.useState(false);
  const [doorDashStatus, setDoorDashStatus] = React.useState(null);
  const [testingStripe, setTestingStripe] = React.useState(false);
  const [stripeStatus, setStripeStatus] = React.useState(null);

  // Canada-focused time zones for easier admin selection
  const CANADA_TIME_ZONES = React.useMemo(() => ([
    'America/St_Johns',   // Newfoundland
    'America/Halifax',    // Nova Scotia, New Brunswick, PEI
    'America/Toronto',    // Ontario, Quebec (Montreal alias)
    'America/Winnipeg',   // Manitoba
    'America/Regina',     // Saskatchewan
    'America/Edmonton',   // Alberta
    'America/Vancouver',  // British Columbia
    'America/Whitehorse', // Yukon
    'America/Yellowknife',// Northwest Territories
    'America/Iqaluit',    // Nunavut
  ]), []);

  // Location modal state
  const [isLocFormOpen, setIsLocFormOpen] = React.useState(false);
  const [editingLocIndex, setEditingLocIndex] = React.useState(null);
  const [locForm, setLocForm] = React.useState({ name: '', phone: '', addr1: '', addr2: '', city: '', province: '', postalCode: '', country: 'CA' });

  React.useEffect(() => {
    setPickupName(site?.pickup?.name || '');
    setPickupPhone(site?.pickup?.phone || '');
    setAddr1(site?.pickup?.address?.streetAddress?.[0] || '');
    setAddr2(site?.pickup?.address?.streetAddress?.[1] || '');
    setCity(site?.pickup?.address?.city || '');
    setProvince(site?.pickup?.address?.province || '');
    setPostalCode(site?.pickup?.address?.postalCode || '');
    setCountry(site?.pickup?.address?.country || 'CA');
    setUberCustomerId(site?.uberCustomerId || '');
    setBrandColor(site?.brandColor || '#0ea5e9');
    setLocations(Array.isArray(site?.locations) ? site.locations : []);
    setCities(Array.isArray(site?.cities) ? site.cities : []);
    setDeliveryFee(((Number(site?.deliveryFeeCents)||0)/100).toFixed(2));
    setSplitDeliveryFee(!!site?.splitDeliveryFee);
    setMaxDeliveryDistanceKm(site?.maxDeliveryDistanceKm ?? '');
    setStripeAccountId(site?.stripeAccountId || '');
    setStripePublishableKey(site?.stripePublishableKey || '');
    setStripeSecretKey(site?.stripeSecretKey || '');
    setStripeWebhookSecret(site?.stripeWebhookSecret || '');
    setDeliveryProvider(site?.deliveryProvider || 'uber');
    setDoordashStoreId(site?.doordashStoreId || '');
    setDoordashDeveloperId(site?.doordashDeveloperId || '');
    setDoordashKeyId(site?.doordashKeyId || '');
    setDoordashSigningSecret(site?.doordashSigningSecret || '');
    setUberClientId(site?.uberClientId || '');
    setUberClientSecret(site?.uberClientSecret || '');
    setUberEnv(site?.uberEnv || 'production');
    setUberTokenScopes(site?.uberTokenScopes ?? '');
    setUberWebhookSecret(site?.uberWebhookSecret || '');
    setHours(site?.hours || {
      mon: { open: '10:00', close: '22:00', closed: false },
      tue: { open: '10:00', close: '22:00', closed: false },
      wed: { open: '10:00', close: '22:00', closed: false },
      thu: { open: '10:00', close: '22:00', closed: false },
      fri: { open: '10:00', close: '22:00', closed: false },
      sat: { open: '10:00', close: '22:00', closed: false },
      sun: { open: '10:00', close: '22:00', closed: false },
    });
    setLogoUrl(site?.logoUrl || '');
    setLogoLinkUrl(site?.logoLinkUrl || '');
    setTagline(site?.tagline || '');
    setLogoFile(null);
    setCurrency(site?.currency || 'usd');
    setTimeZone(site?.timeZone || '');
    setMinOrderCents(site?.minOrderCents ?? '');
    setCouponMinSubtotalCents(site?.couponMinSubtotalCents ?? '');
    setOrderNotifyUrl(site?.orderNotifyUrl || '');
    setSupportWhatsappPhone(site?.supportWhatsappPhone || '');
  }, [site?._id]);

  // Auto-suggest a Canadian time zone based on province when country is CA and no timeZone set
  React.useEffect(() => {
    if (timeZone) return; // respect explicit selection
    if ((country || 'CA').toUpperCase() !== 'CA') return;
    const prov = String(province || '').toUpperCase();
    const SUGGESTED_TZ = {
      NL: 'America/St_Johns',
      NS: 'America/Halifax',
      PE: 'America/Halifax',
      NB: 'America/Halifax',
      QC: 'America/Toronto',
      ON: 'America/Toronto',
      MB: 'America/Winnipeg',
      SK: 'America/Regina',
      AB: 'America/Edmonton',
      BC: 'America/Vancouver',
      YT: 'America/Whitehorse',
      NT: 'America/Yellowknife',
      NU: 'America/Iqaluit',
    };
    if (SUGGESTED_TZ[prov]) setTimeZone(SUGGESTED_TZ[prov]);
  }, [country, province, timeZone]);

  if (!site) return <div className="muted">Select a site to configure.</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
      <div style={{ gridColumn: '1 / -1', fontWeight: 800 }}>Pickup locations</div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
        {(locations || []).map((loc, idx) => (
          <div key={idx} className="card" style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <div>
              <div style={{ fontWeight: 700 }}>{loc.name || 'Restaurant'}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {(loc.address?.streetAddress || []).join(' ')}, {loc.address?.city}, {loc.address?.province} {loc.address?.postalCode}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button onClick={() => {
                setEditingLocIndex(idx);
                setLocForm({
                  name: loc.name || '',
                  phone: loc.phone || '',
                  addr1: loc.address?.streetAddress?.[0] || '',
                  addr2: loc.address?.streetAddress?.[1] || '',
                  city: loc.address?.city || '',
                  province: loc.address?.province || '',
                  postalCode: loc.address?.postalCode || '',
                  country: loc.address?.country || 'CA',
                });
                setIsLocFormOpen(true);
              }}>Edit</button>
              <button className="danger" onClick={() => setLocations(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
            </div>
          </div>
        ))}
        <button onClick={() => {
          setEditingLocIndex(null);
          setLocForm({ name: '', phone: '', addr1: '', addr2: '', city: '', province: '', postalCode: '', country: 'CA' });
          setIsLocFormOpen(true);
        }}>+ Add location</button>
      </div>

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Delivery cities (for Delivery tabs)</div>
      <div style={{ gridColumn: '1 / -1', display: 'grid', gap: 8 }}>
        {(cities || []).map((cityName, idx) => (
          <div key={idx} className="card" style={{ padding: 10, display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
            <input value={cityName} onChange={(e) => setCities(prev => prev.map((c, i) => i === idx ? e.target.value : c))} />
            <button className="danger" onClick={() => setCities(prev => prev.filter((_, i) => i !== idx))}>Remove</button>
          </div>
        ))}
        <button onClick={() => setCities(prev => [...prev, 'New City'])}>+ Add city</button>
      </div>

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Branding</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Support WhatsApp number (E.164, e.g., +14155550123)</span>
        <input value={supportWhatsappPhone} onChange={(e) => setSupportWhatsappPhone(e.target.value)} placeholder="+91... or +1..." />
        <span className="muted" style={{ fontSize: 12 }}>Shown in order details as a WhatsApp chat link.</span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Header title (optional)</span>
        <input value={tagline} onChange={(e) => setTagline(e.target.value)} placeholder="Shown next to logo; leave blank to hide" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Logo URL</span>
        <input value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://..." />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Logo link (redirect URL)</span>
        <input value={logoLinkUrl} onChange={(e) => setLogoLinkUrl(e.target.value)} placeholder="https://restaurant-website.com/" />
        <span className="muted" style={{ fontSize: 12 }}>Logo and back arrow will redirect to this link.</span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Or upload logo</span>
        <input type="file" accept="image/*" onChange={(e) => setLogoFile(e.target.files?.[0] || null)} />
      </label>
      {logoUrl ? (
        <div className="card" style={{ gridColumn: '1 / -1', padding: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <img src={resolveAssetUrl(logoUrl)} alt="logo" style={{ width: 64, height: 64, objectFit: 'contain' }} />
          <div className="muted" style={{ fontSize: 12 }}>Preview</div>
        </div>
      ) : null}

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Payments</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Currency</span>
        <select value={currency} onChange={(e) => setCurrency(e.target.value)}>
          <option value="usd">USD</option>
          <option value="cad">CAD</option>
          <option value="eur">EUR</option>
          <option value="gbp">GBP</option>
          <option value="inr">INR</option>
          <option value="aud">AUD</option>
        </select>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Stripe Account ID (acct_...)</span>
        <input value={stripeAccountId} onChange={(e) => setStripeAccountId(e.target.value)} placeholder="acct_123..." />
        <span className="muted" style={{ fontSize: 12 }}>Each website should have its own connected Stripe account.</span>
      </label>
      <div className="card" style={{ gridColumn: '1 / -1', padding: 10, display: 'grid', gap: 8 }}>
        <div style={{ fontWeight: 700 }}>Stripe keys (optional per-site override)</div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Publishable key</span>
          <input value={stripePublishableKey} onChange={(e) => setStripePublishableKey(e.target.value)} placeholder="pk_live_... or pk_test_..." />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Secret key</span>
          <input value={stripeSecretKey} onChange={(e) => setStripeSecretKey(e.target.value)} placeholder="sk_live_... or sk_test_..." />
        </label>
        <div className="sep" style={{ height: 1, background: 'var(--gray-200)', margin: '8px 0' }} />
        <div style={{ fontWeight: 700 }}>Stripe Webhook</div>
        <div className="muted" style={{ fontSize: 12 }}>
          Point Stripe webhooks to:
        </div>
        <div className="code" style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--gray-50)', padding: 8, borderRadius: 6 }}>
          {`${API_BASE_URL}/webhook/stripe/${site?._id || 'SITE_ID'}`}
        </div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Stripe Webhook Signing Secret</span>
          <input value={stripeWebhookSecret} onChange={(e) => setStripeWebhookSecret(e.target.value)} placeholder="whsec_..." />
        </label>
      </div>

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Delivery settings</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Time zone (IANA, Canada-ready)</span>
        <input list="tz-list" value={timeZone} onChange={(e) => setTimeZone(e.target.value)} placeholder="e.g., America/Edmonton" />
        <datalist id="tz-list">
          {CANADA_TIME_ZONES.map((tz) => (
            <option key={tz} value={tz} />
          ))}
        </datalist>
        <span className="muted" style={{ fontSize: 12 }}>Used to compute open/close hours correctly. Suggestions include Canadian time zones.</span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Minimum order (cents)</span>
        <input type="number" min={0} value={minOrderCents} onChange={(e) => setMinOrderCents(e.target.value)} placeholder="e.g., 5000 for $50.00" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Coupon minimum subtotal (cents)</span>
        <input type="number" min={0} value={couponMinSubtotalCents} onChange={(e) => setCouponMinSubtotalCents(e.target.value)} placeholder="e.g., 5000" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Provider</span>
        <select value={deliveryProvider} onChange={(e) => setDeliveryProvider(e.target.value)}>
          <option value="uber">Uber Direct</option>
          <option value="doordash">DoorDash Drive</option>
        </select>
        <span className="muted" style={{ fontSize: 12 }}>Only one provider is active at a time per website.</span>
      </label>
      {deliveryProvider === 'uber' ? (
        <div className="card" style={{ gridColumn: '1 / -1', padding: 10, display: 'grid', gap: 8 }}>
          <div style={{ fontWeight: 700 }}>Uber Direct credentials (optional per-site override)</div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Uber Client ID</span>
            <input value={uberClientId} onChange={(e) => setUberClientId(e.target.value)} placeholder="client_id" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Uber Client Secret</span>
            <input value={uberClientSecret} onChange={(e) => setUberClientSecret(e.target.value)} placeholder="client_secret" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Uber Environment</span>
            <select value={uberEnv} onChange={(e) => setUberEnv(e.target.value)}>
              <option value="production">Production</option>
              <option value="sandbox">Sandbox</option>
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Uber Token Scopes (optional)</span>
            <input value={uberTokenScopes} onChange={(e) => setUberTokenScopes(e.target.value)} placeholder="eats.deliveries or leave blank" />
            <span className="muted" style={{ fontSize: 12 }}>Leave blank to send no scope. Some Uber apps require blank; others require <code>eats.deliveries</code>. Ensure the app has the Eats Deliveries permission.</span>
          </label>
          <div className="sep" style={{ height: 1, background: 'var(--gray-200)', margin: '8px 0' }} />
          <div style={{ fontWeight: 700 }}>Uber Webhook</div>
          <div className="muted" style={{ fontSize: 12 }}>
            Point Uber Direct webhooks to:
          </div>
          <div className="code" style={{ fontFamily: 'monospace', fontSize: 12, background: 'var(--gray-50)', padding: 8, borderRadius: 6 }}>
            {`${API_BASE_URL}/webhook/uber/${site?._id || 'SITE_ID'}`}
          </div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Uber Webhook Signing Secret</span>
            <input value={uberWebhookSecret} onChange={(e) => setUberWebhookSecret(e.target.value)} placeholder="signing-secret from Uber" />
          </label>
        </div>
      ) : null}
      {deliveryProvider === 'doordash' ? (
        <div className="card" style={{ gridColumn: '1 / -1', padding: 10, display: 'grid', gap: 8 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>DoorDash Store ID</span>
            <input value={doordashStoreId} onChange={(e) => setDoordashStoreId(e.target.value)} placeholder="store-..." />
          </label>
          <div style={{ fontWeight: 700 }}>DoorDash Drive credentials (optional per-site override)</div>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Developer ID</span>
            <input value={doordashDeveloperId} onChange={(e) => setDoordashDeveloperId(e.target.value)} placeholder="developer-id" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Key ID</span>
            <input value={doordashKeyId} onChange={(e) => setDoordashKeyId(e.target.value)} placeholder="key-id" />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Signing Secret</span>
            <input value={doordashSigningSecret} onChange={(e) => setDoordashSigningSecret(e.target.value)} placeholder="signing-secret" />
          </label>
        </div>
      ) : null}
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Legacy delivery rate per km (ignored)</span>
        <input type="number" step="0.01" min={0} value={deliveryFee} onChange={(e) => setDeliveryFee(e.target.value)} />
        <span className="muted" style={{ fontSize: 12 }}>
          Current rule: $8 up to 8 km, then $1 per additional km (rounded up). This field is ignored.
        </span>
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Max delivery distance (km)</span>
        <input type="number" min={0} value={maxDeliveryDistanceKm} onChange={(e) => setMaxDeliveryDistanceKm(e.target.value)} placeholder="e.g., 8" />
        <span className="muted" style={{ fontSize: 12 }}>Orders beyond this distance will be blocked.</span>
      </label>
      <label style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <input type="checkbox" checked={!!splitDeliveryFee} onChange={(e) => setSplitDeliveryFee(e.target.checked)} />
        <span>Split delivery fee 50/50 (half customer, half restaurant)</span>
      </label>

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Opening hours</div>
      <div className="card" style={{ gridColumn: '1 / -1', padding: 10, display: 'grid', gap: 8 }}>
        {[
          ['mon','Monday'], ['tue','Tuesday'], ['wed','Wednesday'], ['thu','Thursday'], ['fri','Friday'], ['sat','Saturday'], ['sun','Sunday']
        ].map(([key, label]) => (
          <div key={key} style={{ display: 'grid', gridTemplateColumns: '120px 1fr 1fr auto', gap: 8, alignItems: 'center' }}>
            <div style={{ fontWeight: 600 }}>{label}</div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Open</span>
              <input type="time" value={hours?.[key]?.open || ''} onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...(prev?.[key] || {}), open: e.target.value } }))} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="muted" style={{ fontSize: 12 }}>Close</span>
              <input type="time" value={hours?.[key]?.close || ''} onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...(prev?.[key] || {}), close: e.target.value } }))} />
            </label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, justifySelf: 'end' }}>
              <input type="checkbox" checked={!!hours?.[key]?.closed} onChange={(e) => setHours((prev) => ({ ...prev, [key]: { ...(prev?.[key] || {}), closed: e.target.checked } }))} />
              <span>Closed</span>
            </label>
          </div>
        ))}
        <div className="muted" style={{ fontSize: 12 }}>Times use 24-hour format. Defaults to 10:00–22:00.</div>
      </div>

      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Legacy default pickup (optional)</div>
      <div style={{ gridColumn: '1 / -1', fontWeight: 800, marginTop: 8 }}>Notifications</div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Order notify URL (optional)</span>
        <input value={orderNotifyUrl} onChange={(e) => setOrderNotifyUrl(e.target.value)} placeholder="https://your-backend.example.com/api/order/notify" />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Pickup name</span>
        <input value={pickupName} onChange={(e) => setPickupName(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Pickup phone</span>
        <input value={pickupPhone} onChange={(e) => setPickupPhone(e.target.value)} placeholder="+1..." />
      </label>
      <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Address line 1</span>
        <input value={addr1} onChange={(e) => setAddr1(e.target.value)} />
      </label>
      <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Address line 2 (optional)</span>
        <input value={addr2} onChange={(e) => setAddr2(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>City</span>
        <input value={city} onChange={(e) => setCity(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>State/Province</span>
        <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="ON, BC, AB..." />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Postal Code</span>
        <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Country</span>
        <select value={country} onChange={(e) => setCountry(e.target.value)}>
          <option value="CA">Canada (CA)</option>
          <option value="US">United States (US)</option>
          <option value="IN">India (IN)</option>
          <option value="GB">United Kingdom (GB)</option>
          <option value="AU">Australia (AU)</option>
        </select>
      </label>
      <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Uber Customer ID</span>
        <input value={uberCustomerId} onChange={(e) => setUberCustomerId(e.target.value)} />
      </label>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span>Brand color</span>
        <input type="color" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} />
      </label>
      <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', gap: 8, alignItems: 'center' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button disabled={testingUber} onClick={async () => {
            setTestingUber(true);
            setUberStatus(null);
            try {
              const res = await fetchJsonAllowError(`/api/admin/sites/${site._id}/health`);
              if (res.ok) {
                const sim = res.simulated ? ' (simulated)' : '';
                setUberStatus({ ok: true, message: `Uber OK${sim}${res.eta ? ` · ETA ${new Date(res.eta).toLocaleTimeString()}` : ''}` });
              } else {
                setUberStatus({ ok: false, message: `Uber error: ${res.error}` });
              }
            } catch (e) {
              setUberStatus({ ok: false, message: e?.message || 'Uber error' });
            } finally {
              setTestingUber(false);
            }
          }}>{testingUber ? 'Testing…' : 'Test Uber'}</button>
          {uberStatus ? (
            <div style={{ fontSize: 12, color: uberStatus.ok ? 'var(--green-600)' : 'var(--red-600)' }}>{uberStatus.message}</div>
          ) : null}
          <button disabled={testingDoorDash} onClick={async () => {
            setTestingDoorDash(true);
            setDoorDashStatus(null);
            try {
              const res = await fetchJsonAllowError(`/api/admin/sites/${site._id}/health/doordash`);
              if (res.ok) {
                const sim = res.simulated ? ' (simulated)' : '';
                setDoorDashStatus({ ok: true, message: `DoorDash OK${sim}${res.eta ? ` · ETA ${new Date(res.eta).toLocaleTimeString()}` : ''}` });
              } else {
                setDoorDashStatus({ ok: false, message: `DoorDash error: ${res.error}` });
              }
            } catch (e) {
              setDoorDashStatus({ ok: false, message: e?.message || 'DoorDash error' });
            } finally {
              setTestingDoorDash(false);
            }
          }}>{testingDoorDash ? 'Testing…' : 'Test DoorDash'}</button>
          {doorDashStatus ? (
            <div style={{ fontSize: 12, color: doorDashStatus.ok ? 'var(--green-600)' : 'var(--red-600)' }}>{doorDashStatus.message}</div>
          ) : null}
          <button disabled={testingStripe} onClick={async () => {
            setTestingStripe(true);
            setStripeStatus(null);
            try {
              const res = await fetchJsonAllowError(`/api/admin/sites/${site._id}/health/stripe`);
              if (res.ok) {
                const flags = [];
                if (res.charges_enabled) flags.push('charges');
                if (res.payouts_enabled) flags.push('payouts');
                if (res.details_submitted) flags.push('details');
                const msg = flags.length ? `Stripe OK · ${flags.join(', ')}` : 'Stripe OK';
                setStripeStatus({ ok: true, message: msg });
              } else {
                setStripeStatus({ ok: false, message: `Stripe error: ${res.error}` });
              }
            } catch (e) {
              setStripeStatus({ ok: false, message: e?.message || 'Stripe error' });
            } finally {
              setTestingStripe(false);
            }
          }}>{testingStripe ? 'Testing…' : 'Test Stripe'}</button>
          {stripeStatus ? (
            <div style={{ fontSize: 12, color: stripeStatus.ok ? 'var(--green-600)' : 'var(--red-600)' }}>{stripeStatus.message}</div>
          ) : null}
        </div>
        {savedAt ? <div className="muted" style={{ alignSelf: 'center', fontSize: 12 }}>Saved {new Date(savedAt).toLocaleTimeString()}</div> : null}
        <button className="primary-btn" disabled={saving} onClick={async () => {
          setSaving(true);
          const payload = {
            uberCustomerId,
            brandColor,
            deliveryProvider,
            doordashStoreId,
            doordashDeveloperId,
            doordashKeyId,
            doordashSigningSecret,
            uberClientId,
            uberClientSecret,
            uberEnv,
            uberTokenScopes,
            uberWebhookSecret,
            stripeWebhookSecret,
            stripePublishableKey,
            stripeSecretKey,
            locations,
            cities,
            deliveryFeeCents: Math.max(0, Math.round(Number(deliveryFee || 0) * 100)),
            splitDeliveryFee: !!splitDeliveryFee,
            maxDeliveryDistanceKm: maxDeliveryDistanceKm === '' ? undefined : Number(maxDeliveryDistanceKm),
            hours,
            logoUrl,
            logoLinkUrl,
            tagline,
            supportWhatsappPhone,
            stripeAccountId,
            currency,
            minOrderCents: (minOrderCents === '' ? undefined : Number(minOrderCents)),
            couponMinSubtotalCents: (couponMinSubtotalCents === '' ? undefined : Number(couponMinSubtotalCents)),
            orderNotifyUrl,
            timeZone: timeZone || undefined,
            pickup: {
              name: pickupName,
              phone: pickupPhone,
              address: {
                streetAddress: [addr1, ...(addr2 ? [addr2] : [])],
                city,
                province,
                postalCode,
                country,
              }
            }
          };
          let updated = await patchJson(`/api/admin/sites/${selectedSiteId}`, payload);
          if (logoFile) {
            try {
              const data = await postFile(`/api/admin/sites/${selectedSiteId}/logo`, logoFile);
              updated = data.site || updated;
              setLogoUrl(data.logoUrl || updated.logoUrl || '');
            } catch {}
          }
          onSiteUpdated(updated);
          setSaving(false);
          setSavedAt(Date.now());
        }}>{saving ? 'Saving…' : 'Save settings'}</button>
      </div>

      <Modal
        open={isLocFormOpen}
        onClose={() => setIsLocFormOpen(false)}
        title={editingLocIndex !== null ? 'Edit location' : 'Add location'}
        footer={(
          <>
            <button onClick={() => setIsLocFormOpen(false)}>Cancel</button>
            <button
              className="primary-btn"
              onClick={() => {
                const payload = {
                  name: locForm.name || 'Restaurant',
                  phone: locForm.phone || '',
                  address: {
                    streetAddress: [locForm.addr1, ...(locForm.addr2 ? [locForm.addr2] : [])],
                    city: locForm.city || '',
                    province: locForm.province || '',
                    postalCode: locForm.postalCode || '',
                    country: locForm.country || 'CA',
                  },
                };
                setLocations(prev => {
                  if (editingLocIndex !== null && editingLocIndex >= 0) {
                    return prev.map((l, i) => i === editingLocIndex ? payload : l);
                  }
                  return [...prev, payload];
                });
                setIsLocFormOpen(false);
                setEditingLocIndex(null);
              }}
            >{editingLocIndex !== null ? 'Save changes' : 'Add location'}</button>
          </>
        )}
      >
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Name</span>
            <input value={locForm.name} onChange={(e) => setLocForm({ ...locForm, name: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Phone</span>
            <input value={locForm.phone} onChange={(e) => setLocForm({ ...locForm, phone: e.target.value })} placeholder="+1..." />
          </label>
          <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Address line 1</span>
            <input value={locForm.addr1} onChange={(e) => setLocForm({ ...locForm, addr1: e.target.value })} />
          </label>
          <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Address line 2 (optional)</span>
            <input value={locForm.addr2} onChange={(e) => setLocForm({ ...locForm, addr2: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>City</span>
            <input value={locForm.city} onChange={(e) => setLocForm({ ...locForm, city: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>State/Province</span>
            <input value={locForm.province} onChange={(e) => setLocForm({ ...locForm, province: e.target.value })} placeholder="ON, BC, AB..." />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Postal Code</span>
            <input value={locForm.postalCode} onChange={(e) => setLocForm({ ...locForm, postalCode: e.target.value })} />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Country</span>
            <select value={locForm.country} onChange={(e) => setLocForm({ ...locForm, country: e.target.value })}>
              <option value="CA">Canada (CA)</option>
              <option value="US">United States (US)</option>
              <option value="IN">India (IN)</option>
              <option value="GB">United Kingdom (GB)</option>
              <option value="AU">Australia (AU)</option>
            </select>
          </label>
        </div>
      </Modal>
    </div>
  );
};

