import React, { useEffect, useMemo, useState } from 'react';
import { fetchJson } from '../lib/api';
import type { Category, Product } from '../types';

export const ProductList: React.FC<{
  category: Category;
  onAdd: (product: Product) => void;
  onBack: () => void;
  siteSlug?: string;
  vegFilter?: 'all' | 'veg' | 'nonveg';
}> = ({ category, onAdd, onBack, siteSlug = 'default', vegFilter = 'all' }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams({ categoryId: String(category._id) });
    if (vegFilter === 'veg') params.set('veg', 'veg');
    if (vegFilter === 'nonveg') params.set('veg', 'nonveg');
    fetchJson<Product[]>(`/api/shop/${siteSlug}/products?${params.toString()}`)
      .then((data) => {
        if (mounted) {
          setProducts(data);
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
  }, [category._id, siteSlug, vegFilter]);

  if (loading) return <div>Loading products...</div>;
  if (error) return <div style={{ color: 'red' }}>Failed to load products: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className="card animate-fadeInUp" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} aria-label="Back" title="Back">←</button>
            <h3 style={{ margin: 0 }}>{category.name}</h3>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{products.length} items</div>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {products.map((p, idx) => (
          <div
            key={p._id}
            className="card animate-fadeInUp"
            style={{ borderRadius: 'var(--radius)', padding: 12, animationDelay: `${idx * 40}ms`, border: '1px solid var(--border)', background: '#fff' }}
          >
            <div style={{ display: 'grid', gridTemplateColumns: '160px 1fr auto', alignItems: 'center', gap: 14 }}>
              <div style={{ width: 160, height: 110, borderRadius: 10, overflow: 'hidden', background: 'linear-gradient(180deg, var(--primary-alpha-08), rgba(167,139,250,0.08))' }}>
                {p.imageUrl ? (
                  <img src={p.imageUrl} alt={p.name} className="img-cover" loading="lazy" />
                ) : (
                  <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42 }}>🍽️</div>
                )}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 18 }}>{p.isVeg === false ? '🔴' : '🟢'}</div>
                  <div style={{ fontWeight: 800, letterSpacing: '.01em' }}>{p.name}</div>
                </div>
                {p.description ? <div className="muted" style={{ fontSize: 14 }}>{p.description}</div> : null}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 8 }}>
                <div style={{ fontWeight: 800 }}>${p.price.toFixed(2)}</div>
                <button onClick={() => onAdd(p)} className="primary-btn" style={{ padding: '10px 12px', borderRadius: 10, display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  <span>+</span>
                  <span>Add</span>
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};