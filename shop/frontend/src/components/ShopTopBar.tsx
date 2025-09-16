import React from 'react';

export const ShopTopBar: React.FC<{
  vegFilter?: 'all' | 'veg' | 'nonveg';
  onVegChange?: (value: 'all' | 'veg' | 'nonveg') => void;
  onSearch?: (q: string) => void;
}> = ({ onSearch, vegFilter = 'all', onVegChange }) => {
  const [query, setQuery] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => onSearch && onSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, onSearch]);
  return (
    <div className="card" style={{ padding: 8, borderRadius: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select
          value={vegFilter}
          onChange={(e) => onVegChange && onVegChange(e.target.value as 'all' | 'veg' | 'nonveg')}
          style={{ padding: '10px 12px' }}
          aria-label="Filter by veg or non-veg"
        >
          <option value="all">All</option>
          <option value="veg">🟢 Veg</option>
          <option value="nonveg">🔴 Non-Veg</option>
        </select>
        <input
          placeholder="Search dishes..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <div className="muted" style={{ fontSize: 12 }}>Filters</div>
      </div>
    </div>
  );
};

