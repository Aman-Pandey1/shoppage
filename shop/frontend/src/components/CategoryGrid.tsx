import React, { useEffect, useState } from 'react';
import { fetchJson } from '../lib/api';
import type { Category } from '../types';

export const CategoryGrid: React.FC<{
  onSelect: (category: Category) => void;
}> = ({ onSelect }) => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | undefined>();

  useEffect(() => {
    let mounted = true;
    fetchJson<Category[]>('/api/categories')
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
  }, []);

  if (loading) return <div>Loading categories...</div>;
  if (error) return <div style={{ color: 'red' }}>Failed to load categories: {error}</div>;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
      {categories.map((cat) => (
        <button key={cat._id} onClick={() => onSelect(cat)} style={{ border: '1px solid #eee', borderRadius: 10, padding: 10, cursor: 'pointer', textAlign: 'left', background: '#fff' }}>
          <div style={{ width: '100%', aspectRatio: '1 / 1', borderRadius: 8, overflow: 'hidden', background: '#f3f4f6', marginBottom: 8 }}>
            <img src={cat.imageUrl} alt={cat.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </div>
          <div style={{ fontWeight: 600 }}>{cat.name}</div>
        </button>
      ))}
    </div>
  );
};