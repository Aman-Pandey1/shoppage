import React from 'react';
import { Modal } from './Modal';
import { getPickupImage, getDeliveryImage } from '../lib/assetFinder';
import { fetchJson } from '../lib/api';

export const FulfillmentModal = ({ open, onChoose, siteSlug }) => {
  const pickupImg = getPickupImage();
  const deliveryImg = getDeliveryImage();
  const [hours, setHours] = React.useState(null);
  const [closedMsg, setClosedMsg] = React.useState('');

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
      if (!hours) { setClosedMsg(''); return; }
      const now = new Date();
      const dayIdx = now.getDay();
      const keys = ['sun','mon','tue','wed','thu','fri','sat'];
      const cfg = hours[keys[dayIdx]];
      if (!cfg) { setClosedMsg(''); return; }
      if (cfg.closed) {
        const openText = nextOpenText(hours, dayIdx);
        setClosedMsg(`We are currently closed for delivery.\nWe will open today at ${openText}. You can Pre-Order for later.`);
        return;
      }
      const [oh, om] = String(cfg.open || '10:00').split(':').map(Number);
      const [ch, cm] = String(cfg.close || '22:00').split(':').map(Number);
      const nowMin = now.getHours()*60 + now.getMinutes();
      const openMin = (oh||0)*60 + (om||0);
      const lastOrder = (ch||0)*60 + Math.max(0, (cm||0)-15);
      if (!(nowMin >= openMin && nowMin <= lastOrder)) {
        const openText = timeLabel(oh||10, om||0);
        setClosedMsg(`We are currently closed for delivery.\nWe will open today at ${openText}. You can Pre-Order for later.`);
      } else {
        setClosedMsg('');
      }
    } catch { setClosedMsg(''); }
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
          // If next day, still show time without date to match requirement
          return timeLabel(oh||10, om||0);
        }
      }
    } catch {}
    return '8:00 AM';
  }
  return (
    <Modal open={open} onClose={() => {}} title={null}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16 }}>
        <button
          onClick={() => onChoose('pickup')}
          style={{
            padding: 10,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ padding: 12, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Takeout</div>
            {pickupImg ? (
              <div style={{ height: 120, display: 'grid', placeItems: 'center' }}>
                <img src={pickupImg} alt="Takeout" loading="eager" decoding="async" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }} />
              </div>
            ) : (
              <div style={{ fontSize: 32 }}>🏪</div>
            )}
          </div>
        </button>
        <button
          onClick={() => onChoose('delivery')}
          style={{
            padding: 10,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--primary-600)',
            background: 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ padding: 12, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Delivery</div>
            {closedMsg ? (
              <div style={{ color: 'var(--danger)', whiteSpace: 'pre-line', fontSize: 12 }}>
                {closedMsg}
              </div>
            ) : null}
            {deliveryImg ? (
              <div style={{ height: 120, display: 'grid', placeItems: 'center' }}>
                <img src={deliveryImg} alt="Delivery" loading="eager" decoding="async" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }} />
              </div>
            ) : (
              <div style={{ fontSize: 32 }}>🚚</div>
            )}
          </div>
        </button>
      </div>
    </Modal>
  );
};

