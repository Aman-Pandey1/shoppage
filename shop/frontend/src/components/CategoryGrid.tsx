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
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))',
        gap: 20,
        alignItems: 'start'
      }}
    >
      {categories.map((cat) => (
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
        >
          <div
            style={{
              width: '100%',
              aspectRatio: '1 / 1',
              borderRadius: 'calc(var(--radius) - 6px)',
              overflow: 'hidden',
              background: 'linear-gradient(180deg, rgba(34,211,238,0.08), rgba(167,139,250,0.08))',
              marginBottom: 10,
              position: 'relative',
            }}
          >
            <img src={cat.imageUrl} alt={cat.name} className="img-cover animate-popIn" />
            <div
              style={{
                position: 'absolute',
                inset: 0,
                background: 'linear-gradient(180deg, rgba(0,0,0,0) 60%, rgba(0,0,0,0.35))',
              }}
            />
          </div>
          <div style={{ fontWeight: 700, letterSpacing: '.01em' }}>{cat.name}</div>
        </button>
      ))}
    </div>
  );
};