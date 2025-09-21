import React, { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';

export const ProductList = ({ category, onAdd, onBack, siteSlug = 'default', vegFilter = 'all' }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();

  useEffect(() => {
    let mounted = true;
    const params = new URLSearchParams({ categoryId: String(category._id) });
    if (vegFilter === 'veg') params.set('veg', 'veg');
    if (vegFilter === 'nonveg') params.set('veg', 'nonveg');
    fetchJson(`/api/shop/${siteSlug}/products?${params.toString()}`)
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
      {/* Category header */}
      <div className="card animate-fadeInUp" style={{ padding: 14, borderRadius: 'var(--radius)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} aria-label="Back" title="Back">←</button>
            <h3 style={{ margin: 0 }}>{category.name}</h3>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{products.length} items</div>
        </div>
      </div>

      {/* Category image banner */}
      <div className="card animate-fadeInUp" style={{ padding: 0, overflow: 'hidden' }}>
        <div style={{ width: '100%', height: 220, background: 'linear-gradient(180deg, var(--primary-alpha-08), rgba(167,139,250,0.08))' }}>
          {category.imageUrl ? (
            <img src={category.imageUrl} alt={category.name} className="img-cover" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42 }}>🛍️</div>
          )}
        </div>
      </div>

      {/* Text-only items grid (2–3 per row responsive) */}
      <div className="products-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))' }}>
        {products.map((p, idx) => (
          <div key={p._id} className="card animate-fadeInUp" style={{ padding: 12, animationDelay: `${idx * 35}ms` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 16 }}>{p.isVeg === false ? '🔴' : '🟢'}</div>
                  <div style={{ fontWeight: 800 }}>{p.name}</div>
                </div>
                {p.description ? <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{p.description}</div> : null}
              </div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                <div style={{ fontWeight: 900, color: 'var(--primary-600)' }}>${p.price.toFixed(2)}</div>
                <button onClick={() => onAdd(p)} className="primary-btn" aria-label={`Add ${p.name}`} title={`Add ${p.name}`} style={{ borderRadius: 999, width: 36, height: 36, padding: 0, display: 'grid', placeItems: 'center' }}>+</button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

