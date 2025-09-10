import React from 'react';
import type { Category } from '../types';

export const CategoryChips: React.FC<{
  categories: Category[];
  currentId?: string;
  onSelect: (category: Category) => void;
}> = ({ categories, currentId, onSelect }) => {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 2px' }}>
      {categories.map((c) => {
        const active = currentId === c._id;
        return (
          <button
            key={c._id}
            onClick={() => onSelect(c)}
            className={active ? 'primary-btn' : ''}
            style={{ whiteSpace: 'nowrap' }}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
};

