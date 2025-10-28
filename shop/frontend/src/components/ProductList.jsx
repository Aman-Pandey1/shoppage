import React, { useState } from 'react';
import { QuickAddModal } from './QuickAddModal';
import { resolveAssetUrl } from '../lib/api';
import { useProductsQuery } from '../lib/queries';

export const ProductList = ({ category, onAdd, onBack, siteSlug = 'default', vegFilter = 'all' }) => {
  const { data: products = [], isLoading: loading, isError, error } = useProductsQuery({ siteSlug, categoryId: category._id, vegFilter });
  const [quickAddOpen, setQuickAddOpen] = useState(false);
  const [activeProduct, setActiveProduct] = useState(null);
  

  if (loading) return (
    <div className="loading-center">
      <div className="spinner" aria-label="Loading products" />
    </div>
  );
  if (isError) return <div style={{ color: 'red' }}>Failed to load products: {error?.message || 'Unknown error'}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
      {/* Category header */}
          <div className="card animate-fadeInUp" style={{ padding: 14, borderRadius: 'var(--radius)', borderTop: '3px solid var(--primary)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <button onClick={onBack} aria-label="Back" title="Back" style={{ fontWeight: 900, fontSize: 20, minWidth: 36 }}>←</button>
            <h3 style={{ margin: 0 }}>{category.name}</h3>
          </div>
          <div className="muted" style={{ fontSize: 13 }}>{products.length} items</div>
        </div>
        {category?.pickupOnly ? (
          <div className="animate-fadeInUp" style={{ marginTop: 8, fontSize: 12, color: '#92400e', background: '#fef3c7', border: '1px solid #fde68a', padding: '6px 10px', borderRadius: 8 }}>
            This category is pickup only. Delivery is not available for these items.
          </div>
        ) : null}
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
      <div className="products-grid" style={{ display: 'grid', gap: 12, gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))' }}>
        {products.map((p, idx) => (
          <div key={p._id} className="card animate-fadeInUp" style={{ padding: 12, animationDelay: `${idx * 35}ms` }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, alignItems: 'start' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <div style={{ fontSize: 16 }}>{p.isVeg === false ? '🔴' : '🟢'}</div>
                <div style={{ fontWeight: 700 }}>{p.name}</div>
                </div>
                {p.description ? <div className="muted" style={{ fontSize: 13, marginTop: 4 }}>{p.description}</div> : null}
                {Array.isArray(p?.variants) && p.variants.length > 0 ? (
                  <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>
                    {(() => {
                      try {
                        const list = p.variants.slice(0, 3).map((v) => {
                          const price = Number(v?.price || 0);
                          return `${v?.label || v?.key || 'Variant'}${price ? ` (+$${price.toFixed(2)})` : ''}`;
                        });
                        const extra = p.variants.length > 3 ? ` +${p.variants.length - 3} more` : '';
                        return `Select Item: ${list.join(', ')}${extra}`;
                      } catch { return 'Select Item available'; }
                    })()}
                  </div>
                ) : null}
              </div>
              <div style={{ display: 'grid', justifyItems: 'end', gap: 6 }}>
                <div style={{ fontWeight: 800, color: 'var(--primary-600)' }}>
                  {`$${Number(p.price || 0).toFixed(2)}`}
                </div>
                <button
                  onClick={() => {
                    // Use the guided add-to-cart flow when product has variants, spice levels, or extras.
                    const hasVariants = Array.isArray(p?.variants) && p.variants.length > 0;
                    const hasSpice = Array.isArray(p?.spiceLevels) && p.spiceLevels.length > 0;
                    const hasExtras = Array.isArray(p?.extraOptionGroups) && p.extraOptionGroups.length > 0;
                    if (hasVariants || hasSpice || hasExtras) {
                      onAdd({ product: p, quantity: 1, pickupOnlyCategory: !!category?.pickupOnly });
                      return;
                    }
                    setActiveProduct(p);
                    setQuickAddOpen(true);
                  }}
                  className="primary-btn hover-float"
                  aria-label={(Array.isArray(p?.variants) && p.variants.length > 0) || (Array.isArray(p?.spiceLevels) && p.spiceLevels.length > 0) || (Array.isArray(p?.extraOptionGroups) && p.extraOptionGroups.length > 0) ? `Customize ${p.name}` : `Add ${p.name}`}
                  title={(Array.isArray(p?.variants) && p.variants.length > 0) || (Array.isArray(p?.spiceLevels) && p.spiceLevels.length > 0) || (Array.isArray(p?.extraOptionGroups) && p.extraOptionGroups.length > 0) ? `Customize ${p.name}` : `Add ${p.name}`}
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
            onAdd({ product: prod, quantity: Math.max(1, Math.min(99, Number(qty) || 1)), pickupOnlyCategory: !!category?.pickupOnly });
          }}
        />
      )}
    </div>
  );
};

