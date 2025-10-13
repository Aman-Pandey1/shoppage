import React, { useEffect, useState } from 'react';
import { QuickAddModal } from './QuickAddModal';
import { fetchJson, resolveAssetUrl } from '../lib/api';

export const ProductList = ({ category, onAdd, onBack, siteSlug = 'default', vegFilter = 'all' }) => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState();
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);

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
          <div className="card animate-fadeInUp" style={{ padding: 14, borderRadius: 'var(--radius)', borderTop: '3px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} aria-label="Back" title="Back" style={{ fontWeight: 900, fontSize: 20, minWidth: 36 }}>←</button>
            <h3 style={{ margin: 0 }}>{category.name}</h3>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{products.length} items</div>
        </div>
      </div>

      {/* Category image banner - improved styling */}
      <div className="card animate-fadeInUp" style={{ padding: 0, overflow: 'hidden', borderLeft: '3px solid var(--primary)', position: 'relative' }}>
        <div style={{ width: '100%', height: 240, background: 'linear-gradient(180deg, var(--primary-alpha-08), var(--primary-alpha-04))', position: 'relative' }}>
          {category.imageUrl ? (
            <img
              src={resolveAssetUrl(category.imageUrl)}
              alt={category.name}
              className="img-cover"
              onError={(e) => {
                // Avoid retry loops and use a stable placeholder
                e.currentTarget.onerror = null;
                const seed = encodeURIComponent(String(category.name || 'category').toLowerCase());
                e.currentTarget.src = `https://picsum.photos/seed/${seed}/800/600`;
              }}
            />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 48 }}>🛍️</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.00), rgba(2,6,23,0.18))' }} />
          <div style={{ position: 'absolute', left: 12, bottom: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{category.name}</div>
            <div className="muted" style={{ fontSize: 12, color: '#fff', opacity: 0.95 }}>{products.length} items</div>
          </div>
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
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                </div>
                {p.description ? <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{p.description}</div> : null}
              </div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                <div style={{ fontWeight: 800, color: 'var(--primary-600)' }}>
                  {(() => {
                    const v0 = Array.isArray(p?.variants) && p.variants.length > 0 ? p.variants[0] : null;
                    const hasAbs = v0 && v0.price != null && Number.isFinite(Number(v0.price));
                    const display = hasAbs ? Number(v0.price) : Number(p.price || 0);
                    return `$${display.toFixed(2)}`;
                  })()}
                </div>
                <button
                  onClick={() => {
                    // If product requires spice selection, skip the quick-add popup and
                    // go straight into the add-to-cart flow; quantity will be chosen in the spice modal.
                    if (Array.isArray(p?.spiceLevels) && p.spiceLevels.length > 0) {
                      onAdd(p, 1);
                      return;
                    }
                    setActiveProduct(p);
                    setQuickAddOpen(true);
                  }}
                  className="primary-btn hover-float"
                  aria-label={`Add ${p.name}`}
                  title={`Add ${p.name}`}
                  style={{ borderRadius: 999, width: 38, height: 38, padding: 0, display: 'grid', placeItems: 'center' }}
                >+
                </button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Quick Add Modal */}
      {quickAddOpen && (
        <QuickAddModal
          open={quickAddOpen}
          product={activeProduct}
          onCancel={() => { setQuickAddOpen(false); setActiveProduct(null); }}
          onConfirm={(qty) => {
            const prod = activeProduct;
            setQuickAddOpen(false);
            setActiveProduct(null);
            onAdd(prod, Math.max(1, Math.min(99, Number(qty) || 1)));
          }}
        />
      )}
    </div>
  );
};

