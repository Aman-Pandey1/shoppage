import React, { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';
import type { Category } from '../types';

export const CategoryGrid: React.FC<{
  onSelect: (category: Category) => void;
  siteSlug?: string;
}> = ({ onSelect, siteSlug = 'default' }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

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
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
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
            padding: 12,
            cursor: 'pointer',
            textAlign: 'left',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.03), rgba(255,255,255,0.02))',
            color: 'var(--text)',
            boxShadow: 'var(--shadow-soft)',
            transition: 'transform .15s ease, box-shadow .2s ease, border-color .2s ease',
            animationDelay: `${idx * 40}ms`,
            position: 'relative'
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
              borderRadius: 'calc(var(--radius) - 6px)',
              overflow: 'hidden',
              background: 'linear-gradient(180deg, var(--primary-alpha-08), rgba(167,139,250,0.08))',
              marginBottom: 10,
              position: 'relative',
            }}
          >
            {cat.imageUrl ? (
              <img src={cat.imageUrl} alt={cat.name} className="img-cover animate-popIn" />
            ) : (
              <div style={{
                width: '100%', height: '100%', display: 'grid', placeItems: 'center',
                fontSize: 42
              }} className="animate-popIn">{getIcon(cat.name)}</div>
            )}
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35))',
              }}
            />
            <div style={{ position: 'absolute', top: 8, left: 8, background: 'rgba(255,255,255,0.9)', borderRadius: 9999, padding: '6px 10px', display: 'inline-flex', alignItems: 'center', gap: 6, border: '1px solid var(--border)' }}>
              <span style={{ fontSize: 16 }}>{getIcon(cat.name)}</span>
              <span style={{ fontWeight: 700, fontSize: 12 }}>Category</span>
            </div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 800, letterSpacing: '.01em' }}>{cat.name}</div>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--muted)', fontSize: 13 }}>
              <span>Explore</span>
              <span className="animate-slideInRight">➡️</span>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};