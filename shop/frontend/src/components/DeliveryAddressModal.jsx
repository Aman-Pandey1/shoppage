import React, { useState } from 'react';
import { Modal } from './Modal';
import { fetchJson, postJson } from '../lib/api';

export const DeliveryAddressModal = ({ open, siteSlug, onClose, onConfirmed, manifest }) => {
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
  const [deliveryFeeCents, setDeliveryFeeCents] = useState(0);
  const [country, setCountry] = useState('CA');
  const [distanceKm, setDistanceKm] = useState(null);
  const [tab, setTab] = useState('enter'); // delivery: only manual address (enter)
  const [notes, setNotes] = useState('');
  const [locations, setLocations] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedPickupIndex, setSelectedPickupIndex] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');

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
          setDeliveryFeeCents(Number(data.deliveryFeeCents) || 0);
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
          if (Array.isArray(locs) && locs.length) setSelectedPickupIndex(0);
          if (Array.isArray(cits) && cits.length) setSelectedCity(cits[0]);
        }
      } catch {}
    }
    loadSite();
    loadLists();
    return () => { cancelled = true; };
  }, [siteSlug]);

  function isValidPostal(code) {
    const v = code.trim();
    if (country === 'CA') return /^[A-Za-z]\d[A-Za-z][ -]?\d[A-Za-z]\d$/.test(v);
    if (country === 'US') return /^\d{5}(-\d{4})?$/.test(v);
    return v.length >= 4; // fallback
  }

  function isValidPhone(ph) {
    return /^\+?[1-9]\d{7,14}$/.test(ph.replace(/[^\d+]/g, ''));
  }

  function validate() {
    if (!name.trim()) return 'Name is required';
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
      const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { name, phone, address }, pickupLocationIndex: selectedPickupIndex });
      setQuote(q);
      if (typeof q?.distanceKm === 'number') setDistanceKm(q.distanceKm);
      if (typeof q?.distanceFeeCents === 'number') setDeliveryFeeCents(q.distanceFeeCents);
    } catch (e) {
      setError(parseServerError(e) || 'Failed to get quote');
    } finally { setLoading(false); }
  }

  async function createDelivery() {
    if (!quote) return;
    setLoading(true); setError(undefined);
    try {
      const address = { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
      const result = await postJson(`/api/delivery/${siteSlug}/create`, {
        dropoff: { name, phone, address },
        manifestItems: manifest.map(m => ({ name: m.name, quantity: m.quantity, size: m.size || 'small', price: m.priceCents || 0 })),
        externalId: `${siteName ? siteName.replace(/\s+/g, '-') : siteSlug}-order-${Date.now()}`,
        pickupLocationIndex: (quote && typeof quote.pickupLocationIndex === 'number') ? quote.pickupLocationIndex : selectedPickupIndex,
      });
      const summary = [addr1, city, postalCode].filter(Boolean).join(', ');
      onConfirmed(result.id || result.delivery_id || '', summary);
      onClose();
    } catch (e) {
      setError(parseServerError(e) || 'Failed to create delivery');
    } finally { setLoading(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="Delivery details">
      {error ? <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div> : null}
      <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>Enter your delivery address.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Name</span>
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
      </div>
      <label style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
        <span>Notes for restaurant (optional)</span>
        <textarea rows={3} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g., Leave at door, call on arrival" />
      </label>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, marginTop: 14, alignItems: 'flex-start' }}>
        <div style={{ display: 'grid', gap: 8, marginLeft: 'auto', minWidth: 260 }}>
            <div className="card" style={{ padding: 10, borderRadius: 10, background: 'var(--primary-alpha-04)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted">Items</span>
              <span style={{ fontWeight: 700 }}>${(itemsSubtotalCents/100).toFixed(2)}</span>
            </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span className="muted">Tax (5%)</span>
                <span style={{ fontWeight: 700 }}>${((itemsSubtotalCents*0.05)/100).toFixed(2)}</span>
              </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
              <span className="muted">Delivery fee</span>
              <span style={{ fontWeight: 700 }}>{deliveryFeeCents ? `$${(deliveryFeeCents/100).toFixed(2)}` : '—'}</span>
            </div>
            <div style={{ height: 1, background: 'var(--border)', margin: '6px 0' }} />
            {quote?.dropoff_estimated_dt ? (
              <div className="muted" style={{ fontSize: 12, marginBottom: 6 }}>ETA: {new Date(quote.dropoff_estimated_dt).toLocaleTimeString()}</div>
            ) : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontWeight: 800 }}>Estimated total</span>
                <span style={{ fontWeight: 900 }}>${(((itemsSubtotalCents + Math.round(itemsSubtotalCents*0.05) + (deliveryFeeCents||0)))/100).toFixed(2)}</span>
            </div>
          </div>
        {!quote ? (
          <button className="primary-btn" disabled={loading} onClick={getQuote} style={{ padding: '12px 16px', borderRadius: 12 }}>{loading ? 'Requesting…' : 'Get quote'}</button>
        ) : (
          <>
            <button className="primary-btn" disabled={loading} onClick={async () => {
              // Wrap createDelivery to include notes in payload
              setLoading(true); setError(undefined);
              try {
                const address = { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
                const result = await postJson(`/api/delivery/${siteSlug}/create`, {
                  dropoff: { name, phone, address },
                  manifestItems: manifest.map(m => ({ name: m.name, quantity: m.quantity, size: m.size || 'small', price: m.priceCents || 0 })),
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
            }} style={{ padding: '12px 16px', borderRadius: 12 }}>{loading ? 'Creating…' : 'Confirm delivery'}</button>
          </>
        )}
        </div>
      </div>
    </Modal>
  );
};

