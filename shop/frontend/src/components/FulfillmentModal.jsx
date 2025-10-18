import React from 'react';
import { Modal } from './Modal';
import { getPickupImage, getDeliveryImage } from '../lib/assetFinder';
import { fetchJson, postJson } from '../lib/api';
import { useCart } from '../store/CartContext';
import { formatCents } from '../lib/money';

// Enhanced fulfillment modal that matches the screenshot/requirements and also
// shows a closed-for-delivery notice under the Delivery option when applicable.
export const FulfillmentModal = ({
  open,
  onClose,
  siteSlug,
  AddressAutocomplete,
  // Pickup scheduling state passed from parent so it's the single source of truth
  pickupDate,
  pickupTime,
  dateOptions = [],
  timeOptions = [],
  onPickupDateChange,
  onPickupTimeChange,
  // Finalize callbacks
  onConfirmPickup, // ({ when, date, time })
  onConfirmDelivery, // ({ when, address, summary })
  selectedType: selectedTypeProp,
}) => {
  const { setDeliveryFeeCents: setFeeInCart } = useCart();
  const pickupImg = getPickupImage();
  const deliveryImg = getDeliveryImage();
  const [processedDeliveryImg, setProcessedDeliveryImg] = React.useState(null);
  const [selectedType, setSelectedType] = React.useState(selectedTypeProp || null);
  const [timing, setTiming] = React.useState(null); // 'now' | 'later'
  const [addrText, setAddrText] = React.useState('');
  const [addrObj, setAddrObj] = React.useState(null);
  const [deliveryAreaError, setDeliveryAreaError] = React.useState('');
  const [deliveryFeeCents, setDeliveryFeeCentsLocal] = React.useState(null);
  const [checkingArea, setCheckingArea] = React.useState(false);
  // Admin-configured delivery radius in kilometers
  const [maxDeliveryKm, setMaxDeliveryKm] = React.useState(null);

  // Hours and closed message for delivery
  const [hours, setHours] = React.useState(null);
  const [closedMsg, setClosedMsg] = React.useState('');
  const [closedNow, setClosedNow] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      setSelectedType(selectedTypeProp || null);
      setTiming(null);
      setAddrText('');
      setAddrObj(null);
      setDeliveryAreaError('');
      setCheckingArea(false);
    }
  }, [open, selectedTypeProp]);

  // Convert near-white pixels in the delivery image to transparent so it matches pickup style
  React.useEffect(() => {
    let cancelled = false;
    async function process() {
      try {
        if (!deliveryImg) { setProcessedDeliveryImg(null); return; }
        const img = new Image();
        img.crossOrigin = 'anonymous';
        const src = String(deliveryImg);
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = src;
        });
        if (cancelled) return;
        const width = Math.max(1, img.naturalWidth || img.width || 1);
        const height = Math.max(1, img.naturalHeight || img.height || 1);
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) { setProcessedDeliveryImg(null); return; }
        ctx.drawImage(img, 0, 0, width, height);
        try {
          const imageData = ctx.getImageData(0, 0, width, height);
          const data = imageData.data;
          // Treat near-white background as transparent
          for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];
            // Threshold tuned to remove white/very light greys without affecting illustration
            if (r > 245 && g > 245 && b > 245) {
              data[i + 3] = 0; // alpha = 0
            }
          }
          ctx.putImageData(imageData, 0, 0);
          const out = canvas.toDataURL('image/png');
          if (!cancelled) setProcessedDeliveryImg(out);
        } catch {
          // If getImageData fails (tainted canvas), fall back to original
          if (!cancelled) setProcessedDeliveryImg(null);
        }
      } catch {
        if (!cancelled) setProcessedDeliveryImg(null);
      }
    }
    process();
    return () => { cancelled = true; };
  }, [deliveryImg]);

  React.useEffect(() => {
    let cancelled = false;
    async function loadHours() {
      try {
        if (!siteSlug) { setHours(null); return; }
        const resp = await fetchJson(`/api/shop/${siteSlug}/hours`);
        if (!cancelled) setHours(resp?.hours || resp || null);
      } catch { if (!cancelled) setHours(null); }
    }
    loadHours();
    return () => { cancelled = true; };
  }, [siteSlug]);

  // Load site info to get max delivery distance (km) for early validation
  React.useEffect(() => {
    let cancelled = false;
    async function loadSiteInfo() {
      try {
        if (!siteSlug) { setMaxDeliveryKm(null); return; }
        const site = await fetchJson(`/api/shop/${siteSlug}/site`);
        if (!cancelled) {
          const km = (typeof site?.maxDeliveryDistanceKm === 'number' && isFinite(site.maxDeliveryDistanceKm))
            ? Number(site.maxDeliveryDistanceKm)
            : null;
          setMaxDeliveryKm(km);
        }
      } catch { if (!cancelled) setMaxDeliveryKm(null); }
    }
    loadSiteInfo();
    return () => { cancelled = true; };
  }, [siteSlug]);

  React.useEffect(() => {
    try {
      if (!hours) { setClosedMsg(''); setClosedNow(false); return; }
      const now = new Date();
      const dayIdx = now.getDay();
      const keys = ['sun','mon','tue','wed','thu','fri','sat'];
      const cfg = hours[keys[dayIdx]];
      if (!cfg) { setClosedMsg(''); setClosedNow(false); return; }
      const [oh, om] = String(cfg?.open || '10:00').split(':').map(Number);
      const [ch, cm] = String(cfg?.close || '22:00').split(':').map(Number);
      const nowMin = now.getHours()*60 + now.getMinutes();
      const openMin = (oh||0)*60 + (om||0);
      // Last order 15 minutes before close
      const lastOrder = (ch||0)*60 + Math.max(0, (cm||0)-15);
      const isClosed = !!cfg?.closed || !(nowMin >= openMin && nowMin <= lastOrder);
      if (isClosed) {
        const openText = cfg?.closed ? nextOpenText(hours, dayIdx) : timeLabel(oh||10, om||0);
        // Remove the space before AM/PM to match requested copy (e.g., 10:00AM)
        const openNoSpace = String(openText || '').replace(/\s*(AM|PM)$/i, '$1');
        setClosedMsg(`Order Now Is Closed. We Will Be Back At ${openNoSpace}. You Can Pre-Order For Later.....`);
        setClosedNow(true);
      } else {
        setClosedMsg('');
        setClosedNow(false);
      }
    } catch { setClosedMsg(''); setClosedNow(false); }
  }, [hours]);

  function timeLabel(hh, mm) {
    const mod = hh >= 12 ? 'PM' : 'AM';
    const h12 = hh % 12 === 0 ? 12 : hh % 12;
    return `${h12}:${String(mm).padStart(2,'0')} ${mod}`;
  }

  function nextOpenText(all, startDayIdx) {
    try {
      const keys = ['sun','mon','tue','wed','thu','fri','sat'];
      for (let i = 0; i < 7; i++) {
        const idx = (startDayIdx + i) % 7;
        const cfg = all[keys[idx]];
        if (!cfg) continue;
        if (!cfg.closed) {
          const [oh, om] = String(cfg.open || '10:00').split(':').map(Number);
          if (i === 0) return timeLabel(oh||10, om||0);
          return timeLabel(oh||10, om||0);
        }
      }
    } catch {}
    return '8:00 AM';
  }

  const canConfirmPickup = selectedType === 'pickup' && timing && pickupDate && pickupTime;
  // Require a Google-selected full address object (not just typed text)
  const canConfirmDelivery = selectedType === 'delivery' && timing && !!addrObj && !deliveryAreaError && !checkingArea;

  // Live check for delivery area only for Delivery option
  React.useEffect(() => {
    let cancelled = false;
    let t = null;
    async function doCheck() {
      try {
        if (selectedType !== 'delivery') { setDeliveryAreaError(''); setCheckingArea(false); return; }
        // Require an address object (from autocomplete) to quote
        if (!addrObj) { setDeliveryAreaError(''); setDeliveryFeeCentsLocal(null); setCheckingArea(false); return; }
        setCheckingArea(true);
        // Do not specify pickup index; backend will pick nearest and return it
        const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { address: addrObj } });
        if (cancelled) return;
        // Early radius validation using admin-configured maxDeliveryKm
        if (typeof q?.distanceKm === 'number' && typeof maxDeliveryKm === 'number' && isFinite(maxDeliveryKm)) {
          const outside = Number(q.distanceKm) > Number(maxDeliveryKm);
          if (outside) {
            setDeliveryAreaError(`Outside delivery area (within ${maxDeliveryKm} km). Please select Takeout.`);
            setDeliveryFeeCentsLocal(null);
            setCheckingArea(false);
            return;
          }
        }
        setDeliveryAreaError('');
        if (typeof q?.customerDeliveryFeeCents === 'number') {
          const cents = Math.max(0, Math.round(Number(q.customerDeliveryFeeCents)));
          setDeliveryFeeCentsLocal(cents);
          try { setFeeInCart(cents); } catch {}
        } else {
          setDeliveryFeeCentsLocal(null);
        }
        setCheckingArea(false);
      } catch (e) {
        if (cancelled) return;
        const rawMsg = String(e?.message || e || '');
        const lower = rawMsg.toLowerCase();
        // Show a clearer error including the configured km limit if present
        if (/within\s*\d+\s*km/.test(lower) || /only available within/.test(lower)) {
          const m = rawMsg.match(/within\s*(\d+)\s*km/i);
          const kmTxt = m && m[1] ? m[1] : '';
          setDeliveryAreaError(`Outside delivery area${kmTxt ? ` (within ${kmTxt} km)` : ''}`);
        } else {
          setDeliveryAreaError('');
        }
        setDeliveryFeeCentsLocal(null);
        setCheckingArea(false);
      }
    }
    if (!addrObj) { setDeliveryAreaError(''); setDeliveryFeeCentsLocal(null); setCheckingArea(false); return () => { cancelled = true; if (t) clearTimeout(t); }; }
    if (t) clearTimeout(t);
    t = setTimeout(doCheck, 300);
    return () => { cancelled = true; if (t) clearTimeout(t); setCheckingArea(false); };
  }, [addrObj, selectedType, siteSlug, maxDeliveryKm]);

  // Clear local fee when switching away from delivery mode
  React.useEffect(() => {
    if (selectedType !== 'delivery') {
      setDeliveryFeeCentsLocal(null);
    }
  }, [selectedType]);

  // When restaurant is closed, keep both buttons visible but disable 'Order Now'.
  // This applies to both Takeout and Delivery modes.

  function renderTypeButtons() {
    return (
      <>
        {closedMsg ? (
          <div style={{
            color: '#a21b0c',
            background: 'var(--danger-alpha-06, rgba(220,53,69,0.06))',
            border: '1px solid var(--danger-alpha-20, rgba(220,53,69,0.2))',
            padding: 10,
            borderRadius: 10,
            marginBottom: 8,
            whiteSpace: 'pre-line',
            textAlign: 'center',
            fontWeight: 700,
            fontSize: 13,
          }}>
            {closedMsg}
          </div>
        ) : null}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8 }}>
        <button
          onClick={() => setSelectedType('pickup')}
          style={{
            padding: 2,
            borderRadius: 12,
            overflow: 'hidden',
            border: selectedType === 'pickup' ? '2px solid var(--primary-600)' : '1px solid var(--border)',
            background: selectedType === 'pickup'
              ? 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ padding: 4, display: 'grid', gap: 2, textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Takeout</div>
            {pickupImg ? (
              <div style={{ height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={pickupImg} alt="Takeout" loading="eager" decoding="async" style={{ display: 'block', maxWidth: '100%', maxHeight: '100%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }} />
              </div>
            ) : (
              <div style={{ fontSize: 34, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏪</div>
            )}
          </div>
        </button>
        <button
          onClick={() => { setSelectedType('delivery'); }}
          style={{
            padding: 2,
            borderRadius: 12,
            overflow: 'hidden',
            border: selectedType === 'delivery' ? '2px solid var(--primary-600)' : '1px solid var(--border)',
            background: selectedType === 'delivery'
              ? 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))',
            opacity: 1,
            cursor: 'pointer',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ padding: 4, display: 'grid', gap: 2, textAlign: 'center' }}>
            <div style={{ fontWeight: 800, fontSize: 13 }}>Delivery</div>
            {deliveryImg ? (
              <div style={{ height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img
                  src={processedDeliveryImg || deliveryImg}
                  alt="Delivery"
                  loading="eager"
                  decoding="async"
                  style={{
                    display: 'block',
                    maxWidth: '100%',
                    maxHeight: '100%',
                    objectFit: 'contain',
                    // Blend remaining whites if processing fails
                    mixBlendMode: 'multiply',
                    filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))',
                  }}
                />
              </div>
            ) : (
              <div style={{ fontSize: 34, height: 88, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚚</div>
            )}
          </div>
        </button>
        </div>
      </>
    );
  }

  function renderTimingButtons() {
    const disabled = !selectedType;
    const disableNow = disabled || closedNow; // disable 'Now' when closed
    const disableLater = disabled; // allow 'Order For Later' even when closed
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <button
          disabled={disableNow}
          className="primary-btn"
          style={{ opacity: disableNow ? 0.6 : 1 }}
          onClick={() => setTiming('now')}
          title={closedNow ? 'Restaurant is closed' : undefined}
        >
          Order Now
        </button>
        <button
          disabled={disableLater}
          className="primary-btn"
          style={{ opacity: disableLater ? 0.6 : 1 }}
          onClick={() => setTiming('later')}
        >
          Order For Later
        </button>
      </div>
    );
  }

  function renderFollowUp() {
    if (!selectedType || !timing) return null;
    if (selectedType === 'pickup') {
      return (
        <div className="form-grid" style={{ gap: 12, marginTop: 12 }}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Day</span>
            <select value={pickupDate || ''} onChange={(e) => onPickupDateChange && onPickupDateChange(e.target.value)}>
              {(Array.isArray(dateOptions) ? dateOptions : []).map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
              ))}
            </select>
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span>Time</span>
            <select value={pickupTime || ''} onChange={(e) => onPickupTimeChange && onPickupTimeChange(e.target.value)}>
              {(Array.isArray(timeOptions) ? timeOptions : []).map((t) => (
                <option key={(t.value || t)} value={t.value || t} disabled={!!t.disabled}>{t.label || t}</option>
              ))}
            </select>
          </label>
        </div>
      );
    }
    // delivery
    return (
      <div style={{ display: 'grid', gap: 8, marginTop: 10 }}>
        {timing === 'later' ? (
          <div className="form-grid" style={{ gap: 12 }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Day</span>
              <select value={pickupDate || ''} onChange={(e) => onPickupDateChange && onPickupDateChange(e.target.value)}>
                {(Array.isArray(dateOptions) ? dateOptions : []).map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label || opt.value}</option>
                ))}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <span>Time</span>
              <select value={pickupTime || ''} onChange={(e) => onPickupTimeChange && onPickupTimeChange(e.target.value)}>
                {(Array.isArray(timeOptions) ? timeOptions : []).map((t) => (
                  <option key={(t.value || t)} value={t.value || t} disabled={!!t.disabled}>{t.label || t}</option>
                ))}
              </select>
            </label>
          </div>
        ) : null}
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span>Delivery Address</span>
          {AddressAutocomplete ? (
            <AddressAutocomplete
              siteSlug={siteSlug}
              value={addrText}
              onChange={(t) => setAddrText(t)}
              onSelect={(addr, summary) => { setAddrObj(addr); setAddrText(summary || ''); }}
              placeholder="Address"
              country="CA"
            />
          ) : (
            <input value={addrText} onChange={(e) => setAddrText(e.target.value)} placeholder="Address" />
          )}
        </label>
        {deliveryAreaError ? (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>
            {deliveryAreaError}
            <div style={{ marginTop: 6 }}>
              <button onClick={() => setSelectedType('pickup')} style={{ border: '1px solid var(--border)', padding: '4px 8px', borderRadius: 6 }}>Select Takeout</button>
            </div>
          </div>
        ) : null}
        {(!deliveryAreaError && selectedType === 'delivery' && addrObj && typeof deliveryFeeCents === 'number') ? (
          <div className="muted" style={{ fontSize: 12 }}>Delivery fee: ${ formatCents(deliveryFeeCents) }</div>
        ) : null}
        {/* Prompt user to select full address from Google suggestions */}
        {(selectedType === 'delivery' && timing && !addrObj) ? (
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>Please select your full address from Google suggestions</div>
        ) : null}
        <div className="muted" style={{ fontSize: 10, textAlign: 'right' }}>powered by Google</div>
      </div>
    );
  }

  function renderFooter() {
    const canConfirm = canConfirmPickup || canConfirmDelivery;
    return (
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, width: '100%' }}>
        <button
          className="primary-btn"
          disabled={!canConfirm}
          onClick={() => {
            if (selectedType === 'pickup' && canConfirmPickup) {
              onConfirmPickup && onConfirmPickup({ when: timing, date: pickupDate, time: pickupTime });
              onClose && onClose();
            } else if (selectedType === 'delivery' && canConfirmDelivery) {
              onConfirmDelivery && onConfirmDelivery({ when: timing, address: addrObj, summary: addrText });
              onClose && onClose();
            }
          }}
        >
          {checkingArea ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <svg width="16" height="16" viewBox="0 0 50 50" aria-hidden="true" focusable="false">
                <circle cx="25" cy="25" r="20" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" strokeDasharray="31.415 31.415">
                  <animateTransform attributeName="transform" type="rotate" from="0 25 25" to="360 25 25" dur="0.8s" repeatCount="indefinite" />
                </circle>
              </svg>
              Validating address…
            </span>
          ) : 'Proceed To Menu'}
        </button>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={<div style={{ textAlign: 'center', width: '100%' }}>Select Order Mode</div>} footer={renderFooter()} maxWidth={520} closeOnOverlayClick={false}>
      {renderTypeButtons()}
      {renderTimingButtons()}
      {renderFollowUp()}
    </Modal>
  );
};

 