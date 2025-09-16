import React from 'react';
import { fetchJson } from '../lib/api';

export const StoreHeader: React.FC<{ siteSlug: string }> = ({ siteSlug }) => {
  const [name, setName] = React.useState<string>('');
  const [loading, setLoading] = React.useState<boolean>(true);
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        setLoading(true);
        const data = await fetchJson<{ name: string; brandColor?: string }>(`/api/shop/${siteSlug}/site`);
        if (!cancelled) {
          setName(data.name || '');
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
    <header className="animate-popIn" style={{ padding: '8px 0 12px' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <div style={{ width: 44, height: 44, borderRadius: 8, background: '#fff', display: 'grid', placeItems: 'center', border: '1px solid var(--border)' }}>
          <span style={{ fontSize: 22 }}>🛍️</span>
        </div>
        <div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>{loading ? 'Loading…' : (name || 'Store')}</div>
          <div className="muted" style={{ fontSize: 12 }}>Open · 10:00 AM – 10:00 PM</div>
        </div>
      </div>
    </header>
  );
};

