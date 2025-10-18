import React from 'react';
import { fetchJson, resolveAssetUrl } from '../lib/api';

export const StoreBanner = ({ siteSlug, onCta }) => {
  const [storeName, setStoreName] = React.useState('');
  const [tagline, setTagline] = React.useState('');
  const [bannerUrl, setBannerUrl] = React.useState('');
  const [hours, setHours] = React.useState(null);
  const [isOpen, setIsOpen] = React.useState(true);

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJson(`/api/shop/${siteSlug}/site`);
        if (!cancelled) {
          setStoreName(data.name || 'Our Store');
          setTagline(typeof data?.tagline === 'string' ? data.tagline : '');
          setBannerUrl(resolveAssetUrl(data?.bannerImageUrl || ''));
        }
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

  const backgroundImage = bannerUrl
    ? `url(${bannerUrl}) center/cover`
    : 'url(https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?q=80&w=1600&auto=format&fit=crop) center/cover';

  return (
    <section
      className="animate-popIn"
      style={{
        borderRadius: 0,
        overflow: 'hidden',
        border: 'none',
        marginBottom: 12,
        padding: 0,
        position: 'relative',
        width: '100vw',
        marginLeft: '50%',
        transform: 'translateX(-50%)',
      }}
      aria-label="Store banner"
    >
      <div
        style={{
          position: 'relative',
          width: '100%',
          height: 'var(--banner-height, 240px)',
          background: backgroundImage,
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
            padding: '16px',
            color: '#fff',
            display: 'grid',
            gridTemplateRows: '1fr auto',
          }}
        >
          <div style={{ alignSelf: 'center', textAlign: 'center', display: 'grid', gap: 10 }}>
            <img alt="logo" src={resolveAssetUrl('') || undefined} style={{ display: 'none' }} />
            <div style={{ fontWeight: 900, fontSize: 18, letterSpacing: '.01em' }}>{storeName}</div>
            {tagline ? <div style={{ fontSize: 13, opacity: 0.9 }}>{tagline}</div> : null}
          </div>
          <div
            style={{
              alignSelf: 'end',
              justifySelf: 'center',
              marginBottom: 12,
              fontWeight: 900,
              letterSpacing: '.08em',
              fontSize: 18,
              textTransform: 'uppercase'
            }}
            onClick={onCta}
            role="button"
            aria-label="Order online"
          >
            Order Online
          </div>
        </div>
      </div>
    </section>
  );
};

