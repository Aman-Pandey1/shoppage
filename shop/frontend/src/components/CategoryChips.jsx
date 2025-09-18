import React from 'react';

export const CategoryChips = ({ categories, currentId, onSelect }) => {
  return (
    <div style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '8px 2px' }}>
      {categories.map((c) => {
        const active = currentId === c._id;
        return (
          <button
            key={c._id}
            onClick={() => onSelect(c)}
            className={active ? 'primary-btn' : ''}
            style={{ whiteSpace: 'nowrap', borderRadius: 999, padding: '10px 14px' }}
          >
            {c.name}
          </button>
        );
      })}
    </div>
  );
};

