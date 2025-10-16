import React from 'react';
import { Modal } from './Modal';
import { getPickupImage, getDeliveryImage } from '../lib/assetFinder';
import { fetchJson, postJson } from '../lib/api';

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
  const pickupImg = getPickupImage();
  const deliveryImg = getDeliveryImage();
  const [selectedType, setSelectedType] = React.useState(selectedTypeProp || null);
  const [timing, setTiming] = React.useState(null); // 'now' | 'later'
  const [addrText, setAddrText] = React.useState('');
  const [addrObj, setAddrObj] = React.useState(null);
  const [deliveryAreaError, setDeliveryAreaError] = React.useState('');

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
    }
  }, [open, selectedTypeProp]);

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

  React.useEffect(() => {
    try {
      if (!hours) { setClosedMsg(''); setClosedNow(false); return; }
      const now = new Date();
      const dayIdx = now.getDay();
      const keys = ['sun','mon','tue','wed','thu','fri','sat'];
      const cfg = hours[keys[dayIdx]];
      if (!cfg) { setClosedMsg(''); setClosedNow(false); return; }
      if (cfg.closed) {
        const openText = nextOpenText(hours, dayIdx);
        setClosedMsg(`We are currently closed.\nWe will open today at ${openText}. You can Pre-Order for later.`);
        setClosedNow(true);
        return;
      }
      const [oh, om] = String(cfg.open || '10:00').split(':').map(Number);
      const [ch, cm] = String(cfg.close || '22:00').split(':').map(Number);
      const nowMin = now.getHours()*60 + now.getMinutes();
      const openMin = (oh||0)*60 + (om||0);
      const lastOrder = (ch||0)*60 + Math.max(0, (cm||0)-15);
      if (!(nowMin >= openMin && nowMin <= lastOrder)) {
        const openText = timeLabel(oh||10, om||0);
        setClosedMsg(`We are currently closed.\nWe will open today at ${openText}. You can Pre-Order for later.`);
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
  const canConfirmDelivery = selectedType === 'delivery' && timing && !!addrObj && !deliveryAreaError;

  // Live check for delivery area only for Delivery option
  React.useEffect(() => {
    let cancelled = false;
    let t = null;
    async function doCheck() {
      try {
        if (selectedType !== 'delivery') { setDeliveryAreaError(''); return; }
        // Require an address object (from autocomplete) to quote
        if (!addrObj) { setDeliveryAreaError(''); return; }
        const q = await postJson(`/api/delivery/${siteSlug}/quote`, { dropoff: { address: addrObj } });
        if (cancelled) return;
        setDeliveryAreaError('');
      } catch (e) {
        if (cancelled) return;
        const raw = String(e?.message || '').toLowerCase();
        if (/within\s*\d+\s*km/.test(raw) || /only available within/.test(raw)) {
          setDeliveryAreaError('Outside Delivery area, please choose Takeout');
        } else {
          setDeliveryAreaError('');
        }
      }
    }
    if (!addrObj) { setDeliveryAreaError(''); return () => { cancelled = true; if (t) clearTimeout(t); }; }
    if (t) clearTimeout(t);
    t = setTimeout(doCheck, 300);
    return () => { cancelled = true; if (t) clearTimeout(t); };
  }, [addrObj, selectedType, siteSlug]);

  // When restaurant is closed, we disable only the 'Order Now' option.
  // Users can still select Delivery or Takeout and pre-order for later.

  function renderTypeButtons() {
    return (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 }}>
        <button
          onClick={() => setSelectedType('pickup')}
          style={{
            padding: 6,
            borderRadius: 12,
            overflow: 'hidden',
            border: selectedType === 'pickup' ? '2px solid var(--primary-600)' : '1px solid var(--border)',
            background: selectedType === 'pickup'
              ? 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))'
              : 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ padding: 8, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Takeout</div>
            {pickupImg ? (
              <div style={{ height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={pickupImg} alt="Takeout" loading="eager" decoding="async" style={{ display: 'block', maxWidth: '78%', maxHeight: '78%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }} />
              </div>
            ) : (
              <div style={{ fontSize: 32, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🏪</div>
            )}
          </div>
        </button>
        <button
          onClick={() => { setSelectedType('delivery'); }}
          style={{
            padding: 6,
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
          <div style={{ padding: 8, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Delivery</div>
            {closedMsg ? (
              <div style={{ color: 'var(--danger)', whiteSpace: 'pre-line', fontSize: 12 }}>
                {closedMsg}
              </div>
            ) : null}
            {deliveryImg ? (
              <div style={{ height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <img src={deliveryImg} alt="Delivery" loading="eager" decoding="async" style={{ display: 'block', maxWidth: '78%', maxHeight: '78%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }} />
              </div>
            ) : (
              <div style={{ fontSize: 32, height: 84, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>🚚</div>
            )}
          </div>
        </button>
      </div>
    );
  }

  function renderTimingButtons() {
    const disabled = !selectedType;
    const disableNow = disabled || closedNow; // when restaurant is closed, block 'Order Now'
    const disableLater = disabled; // allow 'Order For Later' even when closed
    return (
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
        <button
          disabled={disableNow}
          className="primary-btn"
          style={{ opacity: disableNow ? 0.6 : 1 }}
          onClick={() => setTiming('now')}
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
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginTop: 12 }}>
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
          <div style={{ color: 'var(--danger)', fontSize: 12 }}>{deliveryAreaError}</div>
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
          OK
        </button>
      </div>
    );
  }

  return (
    <Modal open={open} onClose={onClose} title={'Select Order Mode'} footer={renderFooter()} maxWidth={480} closeOnOverlayClick={false}>
      {renderTypeButtons()}
      {renderTimingButtons()}
      {renderFollowUp()}
    </Modal>
  );
};

 