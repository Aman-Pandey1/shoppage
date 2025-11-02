import React, { useState } from 'react';
import { Modal } from './Modal';
import { useCart } from '../store/CartContext';
import { fetchJson, postJson } from '../lib/api';
// Address is selected in the order mode popup; this modal displays it read-only
import { formatCents } from '../lib/money';

export const DeliveryAddressModal = ({ open, siteSlug, onClose, onConfirmed, manifest, initialPickupIndex, mode = 'checkout', initialAddress, initialSummary }) => {
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
  // Distance and area validation removed for this modal
  const [notes, setNotes] = useState('');
  const [tab, setTab] = useState('enter'); // kept for compatibility; unused now
  const [locations, setLocations] = useState([]);
  const [cities, setCities] = useState([]);
  const [selectedPickupIndex, setSelectedPickupIndex] = useState(null);
  const [selectedCity, setSelectedCity] = useState('');
  const [minOrderCents, setMinOrderCents] = useState(5000);
  // Single-line address text for UI display and autocomplete
  const [addrText, setAddrText] = useState(initialSummary || '');

  // Distance tolerance no longer used here
  const DIST_TOLERANCE_KM = 0.5;

  const itemsSubtotalCents = React.useMemo(() => {
    try {
      return (Array.isArray(manifest) ? manifest : []).reduce((sum, it) => {
        const unitCents = Math.max(0, Math.round(Number(it.priceCents) || 0));
        const qty = Number(it.quantity) || 1;
        return sum + unitCents * qty;
      }, 0);
    } catch { return 0; }
  }, [manifest]);

  // Coupon + totals to mirror cart/payment breakdown
  const hasEligibleCoupon = React.useMemo(() => {
    const min = Number(state?.couponMinSubtotalCents) || 5000;
    return !!state?.coupon && itemsSubtotalCents >= min;
  }, [state?.coupon, state?.couponMinSubtotalCents, itemsSubtotalCents]);
  const couponPct = React.useMemo(() => (
    hasEligibleCoupon ? Math.max(0, Math.min(100, Number(state?.coupon?.percent) || 0)) : 0
  ), [hasEligibleCoupon, state?.coupon]);
  const itemsAfterDiscountCents = React.useMemo(() => {
    if (!hasEligibleCoupon || couponPct <= 0) return itemsSubtotalCents;
    const list = Array.isArray(manifest) ? manifest : [];
    return list.reduce((sum, it) => {
      const unit = Math.max(0, Number(it.priceCents) || 0);
      const qty = Number(it.quantity) || 1;
      const line = unit * qty;
      const discountedLine = Math.round(line * (100 - couponPct) / 100);
      return sum + discountedLine;
    }, 0);
  }, [manifest, itemsSubtotalCents, hasEligibleCoupon, couponPct]);
  const taxAfterDiscountCents = React.useMemo(() => Math.round(itemsAfterDiscountCents * 0.05), [itemsAfterDiscountCents]);
  const discountCents = React.useMemo(() => (
    hasEligibleCoupon ? Math.max(0, itemsSubtotalCents - itemsAfterDiscountCents) : 0
  ), [hasEligibleCoupon, itemsSubtotalCents, itemsAfterDiscountCents]);

  // Prefill address fields from an AddressAutocomplete selection (Canada only by default)
  React.useEffect(() => {
    try {
      if (!open) return;
      // Only prefill once when opening and if we don't already have a value
      if (initialAddress && !addr1 && !city && !province && !postalCode) {
        const line1 = Array.isArray(initialAddress.streetAddress)
          ? initialAddress.streetAddress.join(' ')
          : (initialAddress.line1 || '');
        setAddr1(line1 || '');
        setCity(initialAddress.city || '');
        setProvince(initialAddress.province || '');
        setPostalCode(initialAddress.postalCode || '');
        setCountry((initialAddress.country || 'CA').toUpperCase());
      }
      if (initialSummary && !addrText) setAddrText(initialSummary);
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

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
          // Do not preset delivery fee here; wait for a live quote
          setSplitDeliveryFee(!!data.splitDeliveryFee);
          if (typeof data.minOrderCents === 'number') setMinOrderCents(Math.max(0, Number(data.minOrderCents)));
          // Do not enforce or store a max delivery distance here
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

  // Address validation and distance checks removed — address comes from previous modal

  // Postal code validation removed in this modal

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
    return null;
  }

  async function getQuote() {
    setLoading(true); setError(undefined);
    try {
      let address;
      const invalid = validate();
      if (invalid) { setError(invalid); setLoading(false); return; }
      address = initialAddress || { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
      const normalizedPhone = normalizePhoneForCountry(phone, country);
      // Let backend select nearest pickup automatically
      const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { name, phone: normalizedPhone || phone, address }, itemsSubtotalCents });
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
      const address = initialAddress || { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
      const normalizedPhone = normalizePhoneForCountry(phone, country);
      if (!normalizedPhone) {
        setError('Enter phone in E.164 format like +14155550123');
        setLoading(false);
        return;
      }
      const result = await postJson(`/api/delivery/${siteSlug}/create`, {
        dropoff: { name, phone: normalizedPhone, address },
        manifestItems: manifest.map(m => ({ name: m.name, quantity: m.quantity, size: m.size, price: m.priceCents || 0, spiceLevel: m.spiceLevel, flavor: m.flavor, portion: m.portion, quantityOption: m.quantityOption, productId: m.productId, categoryId: m.categoryId })),
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
    <Modal open={open} onClose={onClose} title={mode === 'checkout' ? 'Confirm Delivery Details' : 'Delivery details'} closeOnOverlayClick={false} maxWidth={520} footer={(
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, width: '100%' }}>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onClose} disabled={loading}>Cancel</button>
        {mode === 'checkout' ? (
          <button className="primary-btn" disabled={loading} aria-busy={loading} onClick={async () => {
            setLoading(true); setError(undefined);
            try {
              // Validate name/phone only; address comes from previous modal
              if (!name.trim()) throw new Error('Full Name is required');
              const normalizedPhone = normalizePhoneForCountry(phone, country);
              if (!normalizedPhone) throw new Error('Enter phone in E.164 like +14155550123');
              const address = initialAddress || { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
              const dropoff = { name, phone: normalizedPhone, address };
          // Freeze the latest quote to avoid fee changing on submit; fallback to fresh quote only if missing
          let quotedFee = Math.max(0, Number(deliveryFeeCentsLocal || 0));
          let chosenIdx = (typeof selectedPickupIndex === 'number' ? selectedPickupIndex : 0);
          if (!quotedFee) {
            // Fresh quote without forcing pickup index; backend will return nearest index
            const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { name, phone: normalizedPhone, address } });
            quotedFee = typeof q?.customerDeliveryFeeCents === 'number' ? q.customerDeliveryFeeCents : 0;
            try { setDeliveryFeeCents(quotedFee); setDeliveryFeeCentsLocal(quotedFee); } catch {}
            if (typeof q?.pickupLocationIndex === 'number') { chosenIdx = q.pickupLocationIndex; setSelectedPickupIndex(q.pickupLocationIndex); }
            // No distance validation here
          }

              // Create Stripe checkout session for delivery
              const payload = {
                dropoff,
                manifestItems: (Array.isArray(manifest) ? manifest : []).map(m => ({
                  name: m.name,
                  quantity: m.quantity,
                  priceCents: m.priceCents || 0,
                  size: m.size,
                  spiceLevel: m.spiceLevel,
                  flavor: m.flavor,
                  portion: m.portion,
                  quantityOption: m.quantityOption,
                  productId: m.productId,
                  categoryId: m.categoryId,
                  selectedOptions: m.selectedOptions,
                })),
                pickupLocationIndex: chosenIdx,
                deliveryFeeCents: quotedFee,
                coupon: state?.coupon || undefined,
                itemsSubtotalCents,
              };
              const res = await postJson(`/api/payments/stripe/${siteSlug}/checkout/delivery`, payload);
              const url = res?.url;
              if (!url) throw new Error('Failed to start payment');
              const summary = initialSummary || addrText || [addr1, city, postalCode].filter(Boolean).join(', ');
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
              // Set delivery fee from quote using initial address, then go back to menu
              if (!name.trim()) throw new Error('Full Name is required');
              const normalizedPhone = normalizePhoneForCountry(phone, country);
              if (!normalizedPhone) throw new Error('Enter phone in E.164 like +14155550123');
              const address = initialAddress || { streetAddress: [addr1, ...(addr2 ? [addr2] : [])], city, province, postalCode, country };
              // Quote without client-specified pickup index
              const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { name, phone: normalizedPhone, address } });
              if (typeof q?.customerDeliveryFeeCents === 'number') {
                setDeliveryFeeCents(q.customerDeliveryFeeCents);
                setDeliveryFeeCentsLocal(q.customerDeliveryFeeCents);
              }
              const summary = initialSummary || addrText || [addr1, city, postalCode].filter(Boolean).join(', ');
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
      </div>
    )}>
      {(function(){
        const below = itemsSubtotalCents < (Number(minOrderCents) || 0);
        if (!below) return null;
        const dollars = formatCents(Math.max(0, Number(minOrderCents) || 0));
        return (
          <div style={{ color: 'var(--danger)', marginBottom: 8, fontWeight: 600 }}>
            Minimum total amount should be ${dollars} required for delivery.
          </div>
        );
      })()}
      {error ? <div style={{ color: 'var(--danger)', marginBottom: 8 }}>{error}</div> : null}
      {/* Suppress distance validation in payment step; handled in FulfillmentModal */}
      <div className="muted" style={{ marginBottom: 8, fontSize: 12 }}>Enter your delivery address. Delivery will be fulfilled by the website's selected provider.</div>

      <div className="form-grid" style={{ gap: 10 }}>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Full Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Phone</span>
          <input value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="+1..." />
        </label>
        <label style={{ gridColumn: '1 / -1', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Full Address</span>
          <input value={addrText} readOnly placeholder="Address" />
        </label>
        {/* Outside-delivery error is shown on the address entry form, not here */}
      </div>
      {/* Address validation and selection removed as requested */}
    </Modal>
  );
};

