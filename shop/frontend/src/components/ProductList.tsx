import React, { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';
import type { Category, Product } from '../types';

export const ProductList: React.FC<{
  category: Category;
  onAdd: (product: Product) => void;
  onBack: () => void;
}> = ({ category, onAdd, onBack }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    fetchJson<Product[]>(`/api/products?categoryId=${category._id}`)
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
  }, [category._id]);

  if (loading) return <div>Loading products...</div>;
  if (error) return <div style={{ color: 'red' }}>Failed to load products: {error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        onClick={onBack}
        className="animate-fadeInUp"
        style={{
          alignSelf: 'flex-start',
          marginBottom: 4,
          borderRadius: 10,
          border: '1px solid var(--border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.04), rgba(255,255,255,0.02))'
        }}
      >
        ← Back to categories
      </button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(260px, 1fr))', gap: 20 }}>
        {products.map((p) => (
          <div
            key={p._id}
            className="card animate-fadeInUp"
            style={{ borderRadius: 'var(--radius)', padding: 12 }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'translateY(-2px)';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-pop)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--primary)';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLDivElement).style.transform = 'none';
              (e.currentTarget as HTMLDivElement).style.boxShadow = 'var(--shadow-soft)';
              (e.currentTarget as HTMLDivElement).style.borderColor = 'var(--border)';
            }}
          >
            <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 'calc(var(--radius) - 6px)', overflow: 'hidden', background: 'linear-gradient(180deg, rgba(34,211,238,0.08), rgba(167,139,250,0.08))', marginBottom: 10 }}>
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} className="img-cover" />
              ) : null}
            </div>
            <div style={{ fontWeight: 800, letterSpacing: '.01em' }}>{p.name}</div>
            {p.description ? <div className="muted" style={{ fontSize: 14, marginTop: 4 }}>{p.description}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 10 }}>
              <div style={{ fontWeight: 700 }}>${p.price.toFixed(2)}</div>
              <button onClick={() => onAdd(p)} className="primary-btn" style={{ padding: '10px 12px', borderRadius: 10 }}>Add to cart</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};