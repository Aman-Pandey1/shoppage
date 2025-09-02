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
      <button onClick={onBack} style={{ alignSelf: 'flex-start', marginBottom: 4 }}>← Back to categories</button>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(240px, 1fr))', gap: 16 }}>
        {products.map((p) => (
          <div key={p._id} style={{ border: '1px solid #eee', borderRadius: 10, padding: 12, background: '#fff' }}>
            <div style={{ width: '100%', aspectRatio: '4 / 3', borderRadius: 8, overflow: 'hidden', background: '#f3f4f6', marginBottom: 8 }}>
              {p.imageUrl ? (
                <img src={p.imageUrl} alt={p.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
              ) : null}
            </div>
            <div style={{ fontWeight: 700 }}>{p.name}</div>
            {p.description ? <div style={{ color: '#6b7280', fontSize: 14, marginTop: 4 }}>{p.description}</div> : null}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 8 }}>
              <div style={{ fontWeight: 600 }}>${p.price.toFixed(2)}</div>
              <button onClick={() => onAdd(p)} style={{ padding: '8px 12px', borderRadius: 8, border: '1px solid #0ea5e9', background: '#0ea5e9', color: '#fff', cursor: 'pointer' }}>Add to cart</button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};