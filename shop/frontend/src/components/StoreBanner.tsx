import React from 'react';
import { fetchJson } from '../lib/api';

type StoreBannerProps = { siteSlug: string; onCta?: () => void };

export const StoreBanner: React.FC<StoreBannerProps> = ({ siteSlug, onCta }: StoreBannerProps) => {
  const [storeName, setStoreName] = React.useState<string>('');
  const tagline = 'Fresh, fast & delicious';

  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const data = await fetchJson<{ name: string }>(`/api/shop/${siteSlug}/site`);
        if (!cancelled) setStoreName(data.name || 'Our Store');
      } catch {
      }
    }
    load();
    return () => { cancelled = true; };
  }, [siteSlug]);

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
            <div style={{ fontSize: 13, opacity: 0.9 }}>Delivery or Pickup</div>
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
            Start order
          </button>
        </div>
      </div>
    </section>
  );
};

