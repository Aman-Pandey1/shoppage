import React from 'react';
import { fetchJson } from '../lib/api';

export const StoreHeader: React.FC<{ siteSlug: string }> = ({ siteSlug }) => {
  const [name, setName] = React.useState<string>('');
  const [brandColor, setBrandColor] = React.useState<string>('#0ea5e9');
  const [loading, setLoading] = React.useState<boolean>(true);
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchJson<{ name: string; brandColor?: string }>(`/api/shop/${siteSlug}/site`);
        if (!cancelled) {
          setName(data.name || '');
          if (data.brandColor) setBrandColor(data.brandColor);
          try {
            const base = data.brandColor || '#0ea5e9';
            document.documentElement.style.setProperty('--primary', base);
            document.documentElement.style.setProperty('--primary-600', base);
            // Compute alpha variants via CSS color-mix fallback using rgba
            // Simple approach: reuse base with fixed alphas by setting vars
            const rgba = (hex: string, a: number) => {
              const h = hex.replace('#','');
              const bigint = parseInt(h, 16);
              const r = (bigint >> 16) & 255;
              const g = (bigint >> 8) & 255;
              const b = bigint & 255;
              return `rgba(${r},${g},${b},${a})`;
            };
            document.documentElement.style.setProperty('--primary-alpha-04', rgba(base, 0.04));
            document.documentElement.style.setProperty('--primary-alpha-08', rgba(base, 0.08));
            document.documentElement.style.setProperty('--primary-alpha-12', rgba(base, 0.12));
            document.documentElement.style.setProperty('--primary-alpha-18', rgba(base, 0.18));
            document.documentElement.style.setProperty('--primary-alpha-22', rgba(base, 0.22));
            document.documentElement.style.setProperty('--primary-alpha-25', rgba(base, 0.25));
          } catch {}
        }
      } catch {
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [siteSlug]);

  return (
    <header
      className="card animate-popIn"
      style={{
        padding: 0,
        borderRadius: 'var(--radius)',
        overflow: 'hidden',
        border: '1px solid var(--border)'
      }}
    >
      <div
        style={{
          height: 180,
          background:
            'linear-gradient(120deg, rgba(14,165,233,0.35), rgba(167,139,250,0.35)), url(https://images.unsplash.com/photo-1544025162-d76694265947?q=80&w=2000&auto=format&fit=crop) center/cover no-repeat'
        }}
      />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14 }}>
        <div style={{ width: 56, height: 56, borderRadius: 12, background: '#fff', display: 'grid', placeItems: 'center', border: '2px solid var(--primary)' }}>
          <span style={{ fontSize: 26 }}>🛍️</span>
        </div>
        <div>
          <div style={{ fontWeight: 900, fontSize: 20 }}>{loading ? 'Loading…' : (name || 'Store')}</div>
          <div className="muted" style={{ fontSize: 12 }}>Powered by your brand · Fast delivery</div>
        </div>
      </div>
    </header>
  );
};

