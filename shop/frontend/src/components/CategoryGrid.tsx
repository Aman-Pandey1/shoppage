import React, { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../lib/api';
import type { Category, Product } from '../types';

export const CategoryGrid: React.FC<{
  onSelect: (category: Category) => void;
  siteSlug?: string;
}> = ({ onSelect, siteSlug = 'default' }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();
  const [counts, setCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    let mounted = true;
    fetchJson<Category[]>(`/api/shop/${siteSlug}/categories`)
      .then((data) => {
        if (mounted) {
          setCategories(data);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (mounted) {
          setError(err.message);
          setLoading(false);
        }
      });
    return () => {
      mounted = false;
    };
  }, [siteSlug]);

  // Load product counts per category to display "x products"
  useEffect(() => {
    let cancelled = false;
    async function loadCounts() {
      try {
        const results = await Promise.all(
          categories.map(async (c) => {
            const list = await fetchJson<Product[]>(`/api/shop/${siteSlug}/products?categoryId=${encodeURIComponent(String(c._id))}`);
            return [String(c._id), list.length] as [string, number];
          })
        );
        if (!cancelled) {
          const next: Record<string, number> = {};
          for (const [id, count] of results) next[id] = count;
          setCounts(next);
        }
      } catch {
        // ignore counts failure; UI falls back to no number
      }
    }
    if (categories.length > 0) loadCounts();
    return () => { cancelled = true; };
  }, [categories, siteSlug]);

  if (loading) return <div>Loading categories...</div>;
  if (error) return <div style={{ color: 'red' }}>Failed to load categories: {error}</div>;

  function getIcon(name: string): string {
    const n = name.toLowerCase();
    if (/(drink|beverage|juice|soda|shake)/.test(n)) return '🥤';
    if (/(pizza)/.test(n)) return '🍕';
    if (/(burger)/.test(n)) return '🍔';
    if (/(dessert|sweet|ice|cake)/.test(n)) return '🍰';
    if (/(salad|veg|vegetable)/.test(n)) return '🥗';
    if (/(noodle|pasta)/.test(n)) return '🍜';
    if (/(rice|biryani)/.test(n)) return '🍛';
    if (/(chicken|meat|grill)/.test(n)) return '🍗';
    if (/(seafood|fish|shrimp)/.test(n)) return '🦐';
    if (/(breakfast|brunch|egg)/.test(n)) return '🍳';
    return '🛍️';
  }

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))',
        gap: 20,
        alignItems: 'start'
      }}
    >
      {categories.map((cat, idx) => (
        <button
          key={cat._id}
          onClick={() => onSelect(cat)}
          className="animate-fadeInUp"
          style={{
            border: '1px solid var(--border)',
            borderRadius: 'var(--radius)',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
            background: '#fff',
            color: 'var(--text)',
            boxShadow: 'var(--shadow-soft)',
            transition: 'transform .15s ease, box-shadow .2s ease, border-color .2s ease',
            animationDelay: `${idx * 40}ms`,
            overflow: 'hidden'
          }}
          onMouseEnter={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'translateY(-2px)';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-pop)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--primary)';
          }}
          onMouseLeave={(e) => {
            (e.currentTarget as HTMLButtonElement).style.transform = 'none';
            (e.currentTarget as HTMLButtonElement).style.boxShadow = 'var(--shadow-soft)';
            (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border)';
          }}
          aria-label={`Open ${cat.name} category`}
        >
          <div
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              background: 'linear-gradient(180deg, var(--primary-alpha-08), rgba(167,139,250,0.08))',
            }}
          >
            {cat.imageUrl ? (
              <img src={cat.imageUrl} alt={cat.name} className="img-cover" loading="lazy" />
            ) : (
              <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42 }}>{getIcon(cat.name)}</div>
            )}
          </div>
          <div style={{ padding: 12 }}>
            <div style={{ fontWeight: 800, letterSpacing: '.01em' }}>{cat.name}</div>
            <div className="muted" style={{ fontSize: 13, marginTop: 2 }}>
              {typeof counts[cat._id] === 'number' ? `${counts[cat._id]} products` : 'Products'}
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};