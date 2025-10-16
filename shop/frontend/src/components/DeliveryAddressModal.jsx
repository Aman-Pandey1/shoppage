import React, { useState } from 'react';
import { Modal } from './Modal';
import { useCart } from '../store/CartContext';
import { fetchJson, postJson } from '../lib/api';

export const DeliveryAddressModal = ({ open, siteSlug, onClose, onConfirmed, manifest, initialPickupIndex, mode = 'checkout' }) => {
  const { state, setDeliveryFeeCents } = useCart();
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [addr1, setAddr1] = useState('');
  const [addr2, setAddr2] = useState('');
  const [city, setCity] = useState('');
  const [province, setProvince] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState();
  const [quote, setQuote] = useState(null);
  const [siteName, setSiteName] = useState('');
  const [deliveryFeeCentsLocal, setDeliveryFeeCentsLocal] = useState(0);
  const [splitDeliveryFee, setSplitDeliveryFee] = useState(false);
  const [country, setCountry] = useState('CA');
  const [distanceKm, setDistanceKm] = useState(null);
  const [maxDeliveryKm, setMaxDeliveryKm] = useState(null);
  const [addressAreaError, setAddressAreaError] = useState('');
  const [tab, setTab] = useState('enter'); // delivery: only manual address (enter)
  const [locations, setLocations] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedPickupIndex, setSelectedPickupIndex] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [minOrderCents, setMinOrderCents] = useState(5000);

  const itemsSubtotalCents = React.useMemo(() => {
    try {
      return (Array.isArray(manifest) ? manifest : []).reduce((sum, it) => sum + (Number(it.priceCents) || 0) * (Number(it.quantity) || 1), 0);
    } catch { return 0; }
  }, [manifest]);

  function parseServerError(err) {
    try {
      const raw = String(err?.message || err || '');
      // Try extract JSON { error: ... }
      const brace = raw.indexOf('{');
      if (brace >= 0) {
        const json = raw.slice(brace);
        try {
          const parsed = JSON.parse(json);
          if (parsed && parsed.error) return String(parsed.error);
        } catch {}
      }
      // Friendly Uber 5xx mapping
      if (/internal_server_error|We have experienced a problem/i.test(raw)) {
        return 'Delivery service is temporarily unavailable. Please try again in a minute or choose pickup.';
      }
      return raw.replace(/^Request failed:\s*\d+\s*/i, '').trim() || 'Something went wrong';
    } catch {
      return 'Something went wrong';
    }
  }

  React.useEffect(() => {
    let cancelled = false;
    async function loadSite() {
      try {
        const data = await fetchJson(`/api/shop/${siteSlug}/site`);
        if (!cancelled) {
          setSiteName(data.name || '');
          const baseFee = Number(data.deliveryFeeCents) || 0;
          setDeliveryFeeCents(baseFee);
          setDeliveryFeeCentsLocal(baseFee);
          setSplitDeliveryFee(!!data.splitDeliveryFee);
          if (typeof data.minOrderCents === 'number') setMinOrderCents(Math.max(0, Number(data.minOrderCents)));
          if (typeof data.maxDeliveryDistanceKm === 'number' && data.maxDeliveryDistanceKm > 0) {
            setMaxDeliveryKm(Number(data.maxDeliveryDistanceKm));
          } else {
            setMaxDeliveryKm(null);
          }
        }
      } catch {}
    }
    async function loadLists() {
      try {
        const [locs, cits] = await Promise.all([
          fetchJson(`/api/shop/${siteSlug}/locations`),
          fetchJson(`/api/shop/${siteSlug}/cities`),
        ]);
        if (!cancelled) {
          setLocations(Array.isArray(locs) ? locs : []);
          setCities(Array.isArray(cits) ? cits : []);
          if (Array.isArray(locs) && locs.length) {
            const idx = (typeof initialPickupIndex === 'number' && initialPickupIndex >= 0 && initialPickupIndex < locs.length)
              ? initialPickupIndex
              : 0;
            setSelectedPickupIndex(idx);
          }
          if (Array.isArray(cits) && cits.length) setSelectedCity(cits[0]);
        }
      } catch {}
    }
    loadSite();
    loadLists();
    return () => { cancelled = true; };
  }, [siteSlug, initialPickupIndex]);

  // Live distance/area check as the user enters a full address
  React.useEffect(() => {
    let cancelled = false;
    let t = null;
    function readyToCheck() {
      try {
        return (
          String(addr1 || '').trim() &&
          String(city || '').trim() &&
          String(province || '').trim() &&
          isValidPostal(String(postalCode || '')) &&
          String(country || '').trim() &&
          typeof selectedPickupIndex === 'number' && selectedPickupIndex >= 0
        );
      } catch { return false; }
    }
    async function doCheck() {
      try {
        const address = { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
        const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { address }, pickupLocationIndex: selectedPickupIndex });
        if (cancelled) return;
        const km = (typeof q?.distanceKm === 'number') ? q.distanceKm : null;
        if (km != null) setDistanceKm(km);
        if (typeof maxDeliveryKm === 'number' && km != null && km > maxDeliveryKm) {
          setAddressAreaError('Outside Delivery area, please choose Takeout');
        } else {
          setAddressAreaError('');
        }
      } catch (e) {
        if (cancelled) return;
        const msg = (parseServerError(e) || '').toLowerCase();
        if (/only available within/.test(msg) || /within \d+\s*km/.test(msg)) {
          setAddressAreaError('Outside Delivery area, please choose Takeout');
        } else {
          setAddressAreaError('');
        }
      }
    }
    if (!readyToCheck()) { setAddressAreaError(''); return () => { cancelled = true; if (t) clearTimeout(t); }; }
    if (t) clearTimeout(t);
    t = setTimeout(doCheck, 500);
    return () => { cancelled = true; if (t) clearTimeout(t); };
  }, [addr1, addr2, city, province, postalCode, country, selectedPickupIndex, siteSlug, maxDeliveryKm]);

  function isValidPostal(code) {
    const v = code.trim();
    if (country === 'CA') return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v);
    if (country === 'US') return /^\d{5}(-\d{4})?$/.test(v);
    return v.length >= 4; // fallback
  }

  function isValidPhone(ph) {
    return /^\+?[1-9]\d{7,14}$/.test(ph.replace(/[^\d+]/g, ''));
  }

  function normalizePhoneForCountry(raw, countryCode) {
    try {
      const cleaned = String(raw || '').replace(/[^\d+]/g, '');
      const c = String(countryCode || 'CA').toUpperCase();
      const ccMap = { CA: '1', US: '1', IN: '91', GB: '44', AU: '61' };
      const usesTrunkZero = new Set(['GB', 'IN', 'AU']);
      const defaultCc = ccMap[c] || '';
      if (!cleaned) return '';
      if (cleaned.startsWith('+')) {
        let withPlus = '+' + cleaned.replace(/\+/g, '');
        if (defaultCc && usesTrunkZero.has(c)) {
          const afterCcIdx = 1 + defaultCc.length;
          if (withPlus.slice(1, afterCcIdx) === defaultCc && withPlus[afterCcIdx] === '0') {
            withPlus = '+' + defaultCc + withPlus.slice(afterCcIdx + 1);
          }
        }
        return /^\+[1-9]\d{7,14}$/.test(withPlus) ? withPlus : '';
      }
      let national = cleaned;
      if (usesTrunkZero.has(c) && national.startsWith('0')) national = national.replace(/^0+/, '');
      if (defaultCc) {
        if (defaultCc === '1') {
          if (/^1\d{10}$/.test(national)) return '+' + national;
          if (/^\d{10}$/.test(national)) return '+1' + national;
        }
        const combined = '+' + defaultCc + national;
        return /^\+[1-9]\d{7,14}$/.test(combined) ? combined : '';
      }
      if (/^[1-9]\d{7,14}$/.test(national)) return '+' + national;
      return '';
    } catch { return ''; }
  }

  function validate() {
    if (!name.trim()) return 'Full Name is required';
    if (!isValidPhone(phone)) return 'Enter phone as +1XXXXXXXXXX';
    if (!addr1.trim()) return 'Address line 1 is required';
    if (!city.trim()) return 'City is required';
    if (!province.trim()) return 'Province is required';
    if (!isValidPostal(postalCode)) return 'Postal code must be like A1A 1A1';
    return null;
  }

  async function getQuote() {
    setLoading(true); setError(undefined);
    try {
      let address;
      if (tab === 'enter') {
        const invalid = validate();
        if (invalid) { setError(invalid); setLoading(false); return; }
        address = { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
      }
      const normalizedPhone = normalizePhoneForCountry(phone, country);
      const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { name, phone: normalizedPhone || phone, address }, pickupLocationIndex: selectedPickupIndex });
      setQuote(q);
      if (typeof q?.distanceKm === 'number') setDistanceKm(q.distanceKm);
      if (typeof q?.customerDeliveryFeeCents === 'number') {
        setDeliveryFeeCents(q.customerDeliveryFeeCents);
        setDeliveryFeeCentsLocal(q.customerDeliveryFeeCents);
      }
    } catch (e) {
      setError(parseServerError(e) || 'Failed to get quote');
    } finally { setLoading(false); }
  }

  async function createDelivery() {
    if (!quote) return;
    setLoading(true); setError(undefined);
    try {
      const address = { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
      const normalizedPhone = normalizePhoneForCountry(phone, country);
      if (!normalizedPhone) {
        setError('Enter phone in E.164 format like +14155550123');
        setLoading(false);
        return;
      }
      const result = await postJson(`/api/delivery/${siteSlug}/create`, {
        dropoff: { name, phone: normalizedPhone, address },
        manifestItems: manifest.map(m => ({ name: m.name, quantity: m.quantity, size: m.size, price: m.priceCents || 0, spiceLevel: m.spiceLevel })),
        externalId: `${siteName ? siteName.replace(/\s+/g, '-') : siteSlug}-order-${Date.now()}`,
        pickupLocationIndex: (quote && typeof quote.pickupLocationIndex === 'number') ? quote.pickupLocationIndex : selectedPickupIndex,
        notes,
      });
      const summary = [addr1, city, postalCode].filter(Boolean).join(', ');
      onConfirmed(result.id || result.delivery_id || '', summary);
      onClose();
    } catch (e) {
      setError(parseServerError(e) || 'Failed to create delivery');
    } finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={mode === 'checkout' ? 'Confirm Delivery Details' : 'Delivery details'} footer={(
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
        <button onClick={onClose} disabled={loading}>Cancel</button>
        {mode === 'checkout' ? (
          <button className="primary-btn" disabled={loading} aria-busy={loading} onClick={async () => {
            setLoading(true); setError(undefined);
            try {
              // Validate and build dropoff
              if (!name.trim()) throw new Error('Full Name is required');
              if (!addr1.trim() || !city.trim() || !province.trim() || !isValidPostal(postalCode)) throw new Error('Enter a valid full address');
              const normalizedPhone = normalizePhoneForCountry(phone, country);
              if (!normalizedPhone) throw new Error('Enter phone in E.164 like +14155550123');
              const address = { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
              const dropoff = { name, phone: normalizedPhone, address };
              // Always get a fresh quote to ensure delivery fee consistency with checkout
              const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { name, phone: normalizedPhone, address }, pickupLocationIndex: selectedPickupIndex });
              const quotedFee = typeof q?.customerDeliveryFeeCents === 'number' ? q.customerDeliveryFeeCents : 0;
              try { setDeliveryFeeCents(quotedFee); setDeliveryFeeCentsLocal(quotedFee); } catch {}
              const chosenIdx = (typeof q?.pickupLocationIndex === 'number') ? q.pickupLocationIndex : (typeof selectedPickupIndex === 'number' ? selectedPickupIndex : 0);

              // Create Stripe checkout session for delivery
              const payload = {
                dropoff,
                manifestItems: (Array.isArray(manifest) ? manifest : []).map(m => ({
                  name: m.name,
                  quantity: m.quantity,
                  priceCents: m.priceCents || 0,
                  size: m.size,
                  spiceLevel: m.spiceLevel,
                })),
                pickupLocationIndex: chosenIdx,
                deliveryFeeCents: quotedFee,
                coupon: state?.coupon || undefined,
              };
              const res = await postJson(`/api/payments/stripe/${siteSlug}/checkout/delivery`, payload);
              const url = res?.url;
              if (!url) throw new Error('Failed to start payment');
              const summary = [addr1, city, postalCode].filter(Boolean).join(', ');
              try { onConfirmed(`addr-${Date.now()}`, summary); } catch {}
              try { onClose(); } catch {}
              window.location.href = url;
            } catch (e) {
              setError(parseServerError(e) || 'Failed to start payment');
            } finally { setLoading(false); }
          }}>
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 50 50" aria-hidden="true" focusable="false">
                  <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray="31.415 31.415">
                    <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
                  </circle>
                </svg>
                Redirecting…
              </span>
            ) : (
              'Continue to payment'
            )}
          </button>
        ) : (
          <button className="primary-btn" disabled={loading} aria-busy={loading} onClick={async () => {
            setLoading(true); setError(undefined);
            try {
              // Validate and compute quote to set delivery fee, then go back to menu
              if (!name.trim()) throw new Error('Full Name is required');
              if (!addr1.trim() || !city.trim() || !province.trim() || !isValidPostal(postalCode)) throw new Error('Enter a valid full address');
              const normalizedPhone = normalizePhoneForCountry(phone, country);
              if (!normalizedPhone) throw new Error('Enter phone in E.164 like +14155550123');
              const address = { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
              const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { name, phone: normalizedPhone, address }, pickupLocationIndex: selectedPickupIndex });
              if (typeof q?.customerDeliveryFeeCents === 'number') {
                setDeliveryFeeCents(q.customerDeliveryFeeCents);
                setDeliveryFeeCentsLocal(q.customerDeliveryFeeCents);
              }
              const summary = [addr1, city, postalCode].filter(Boolean).join(', ');
              try { onConfirmed(`addr-${Date.now()}`, summary); } catch {}
              onClose();
            } catch (e) {
              setError(parseServerError(e) || 'Invalid address');
            } finally { setLoading(false); }
          }}>
            {loading ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 50 50" aria-hidden="true" focusable="false">
                  <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray="31.415 31.415">
                    <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
                  </circle>
                </svg>
                Processing…
              </span>
            ) : (
              'Proceed to menu'
            )}
          </button>
        )}
      </div>
    )}>
      {(function(){
        const below = itemsSubtotalCents < (Number(minOrderCents) || 0);
        if (!below) return null;
        const dollars = (Math.max(0, Number(minOrderCents) || 0) / 100).toFixed(2);
        return (
          <div style={{ color: 'var(--danger)', marginBottom: 8, fontWeight: 600 }}>
            Minimum total amount should be ${dollars} required for delivery.
          </div>
        );
      })()}
      {error ? <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div> : null}
      <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>Enter your delivery address. Delivery will be fulfilled by the website's selected provider.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Full Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." />
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
          <span>Province</span>
          <input value={province} onChange={(e) => setProvince(e.target.value)} placeholder="ON, BC, AB..." />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Postal Code</span>
          <input value={postalCode} onChange={(e) => setPostalCode(e.target.value)} placeholder="A1A 1A1" />
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
        {addressAreaError ? (
          <div style={{ gridColumn: '1 / -1', color: 'var(--danger)', fontSize: 12, marginTop: -4 }}>
            {addressAreaError}
          </div>
        ) : null}
      </div>
      {/* Notes of Instruction removed as requested */}
      {/* Removed quote/fee panel and payment buttons as requested */}
    </Modal>
  );
};

