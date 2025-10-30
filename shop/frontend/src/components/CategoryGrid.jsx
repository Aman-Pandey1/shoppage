import React from 'react';
import { resolveAssetUrl } from '../lib/api';
import { useCategoriesQuery, useCategoryCountsQuery } from '../lib/queries';

export const CategoryGrid = ({ onSelect, siteSlug = 'default' }) => {
  const { data: categories = [], isLoading: loading, isError, error } = useCategoriesQuery(siteSlug);
  const counts = useCategoryCountsQuery(siteSlug, categories);

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" aria-label="Loading categories" />
    </div>
  );
  if (isError) return <div style={{ color: 'red' }}>Failed to load categories: {error?.message || 'Unknown error'}</div>;

  function getIcon(name) {
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
    <div className="category-grid">
      {categories.map((cat, idx) => (
        <button
          key={cat._id}
          onClick={() => onSelect(cat)}
          className="animate-fadeInUp"
          style={{
            border: 'none',
            borderRadius: 'var(--radius)',
            padding: 0,
            cursor: 'pointer',
            textAlign: 'left',
            background: 'transparent',
            color: 'var(--text)',
            transition: 'transform .15s ease',
            animationDelay: `${idx * 40}ms`,
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.transform = 'translateY(-2px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.transform = 'none';
          }}
          aria-label={`Open ${cat.name} category`}
        >
          {/* Image card with bold black border and shadow */}
          <div className="card" style={{ overflow: 'hidden', borderRadius: 'var(--radius)', padding: 0, border: '3px solid #111827', boxShadow: '0 6px 0 rgba(0,0,0,0.9)' }}>
            <div
              style={{
                width: '100%',
                aspectRatio: '1 / 1',
                background: 'linear-gradient(180deg, var(--primary-alpha-08), rgba(167,139,250,0.08))',
                overflow: 'hidden'
              }}
            >
              {cat.imageUrl ? (
                <img
                  src={resolveAssetUrl(cat.imageUrl)}
                  alt={cat.name}
                  className="img-cover"
                  loading="lazy"
                  onError={(e) => {
                    e.currentTarget.onerror = null;
                    const seed = encodeURIComponent(String(cat.name || 'category').toLowerCase());
                    e.currentTarget.src = `https://picsum.photos/seed/${seed}/400/400`;
                  }}
                />
              ) : (
                <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42 }}>{getIcon(cat.name)}</div>
              )}
            </div>
          </div>
          {/* Label bar to match screenshot */}
          <div
            style={{
              marginTop: 10,
              borderRadius: 14,
              border: '3px solid #111827',
              padding: 6,
              background: 'transparent'
            }}
          >
            <div
              style={{
                background: '#ffffff',
                borderRadius: 12,
                padding: '8px 10px',
                display: 'grid',
                gap: 2
              }}
            >
              <div style={{ fontWeight: 800, letterSpacing: '.01em' }}>{cat.name}</div>
              <div className="muted" style={{ fontSize: 12 }}>
                {typeof counts[cat._id] === 'number' ? `${counts[cat._id]} products` : 'Products'}
              </div>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
};

