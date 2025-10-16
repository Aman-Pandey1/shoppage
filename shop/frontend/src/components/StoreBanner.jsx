import React from 'react';
import { fetchJson } from '../lib/api';

export const StoreBanner = ({ siteSlug, onCta }) => {
  const [storeName, setStoreName] = React.useState('');
  const tagline = 'Fresh, fast & delicious';
  const [hours, setHours] = React.useState(null);
  const [isOpen, setIsOpen] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJson(`/api/shop/${siteSlug}/site`);
        if (!cancelled) setStoreName(data.name || 'Our Store');
      } catch {}
    }
    async function loadHours() {
      try {
        const resp = await fetchJson(`/api/shop/${siteSlug}/hours`);
        if (!cancelled) setHours(resp?.hours || resp || null);
      } catch { if (!cancelled) setHours(null); }
    }
    load();
    loadHours();
    return () => { cancelled = true; };
  }, [siteSlug]);

  React.useEffect(() => {
    try {
      if (!hours) { setIsOpen(true); return; }
      const now = new Date();
      const dayKey = ['sun','mon','tue','wed','thu','fri','sat'][now.getDay()];
      const cfg = hours?.[dayKey];
      if (!cfg) { setIsOpen(true); return; }
      if (cfg.closed) { setIsOpen(false); return; }
      const [oh, om] = String(cfg.open || '10:00').split(':').map(Number);
      const [ch, cm] = String(cfg.close || '22:00').split(':').map(Number);
      const nowMin = now.getHours()*60 + now.getMinutes();
      const openMin = (oh||0)*60 + (om||0);
      const lastOrder = (ch||0)*60 + Math.max(0, (cm||0)-15);
      setIsOpen(nowMin >= openMin && nowMin <= lastOrder);
    } catch { setIsOpen(true); }
  }, [hours]);

  return (
    <section
      className="card animate-popIn"
      style={{
        borderRadius: 16,
        overflow: 'hidden',
        border: '1px solid var(--border)',
        marginBottom: 12,
        padding: 0,
        position: 'relative',
      }}
      aria-label="Store banner"
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 180,
          background:
            'url(https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1600&auto=format&fit=crop) center/cover',
        }}
      >
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background:
              'linear-gradient(180deg, rgba(2,6,23,0.15), rgba(2,6,23,0.45))',
          }}
        />
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '16px',
            color: '#fff',
          }}
        >
          <div style={{ display: 'grid', gap: 4 }}>
            <div style={{ fontSize: 13, opacity: 0.9 }}>Delivery or Takeout</div>
            <div style={{ fontWeight: 900, fontSize: 20, letterSpacing: '.01em' }}>{storeName}</div>
            <div style={{ fontSize: 13, opacity: 0.9 }}>{tagline}</div>
          </div>
          <button
            className="primary-btn"
            onClick={onCta}
            style={{
              padding: '10px 14px',
              borderRadius: 9999,
              background: 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))',
              border: '1px solid var(--primary-600)',
            }}
            aria-label="Start order"
          >
            {isOpen ? 'Order online' : 'Restaurant closed'}
          </button>
        </div>
      </div>
    </section>
  );
};

