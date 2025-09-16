import React from 'react';

export const ShopTopBar: React.FC<{
  onSearch?: (q: string) => void;
}> = ({ onSearch }) => {
  const [query, setQuery] = React.useState('');
  React.useEffect(() => {
    const t = setTimeout(() => onSearch && onSearch(query), 250);
    return () => clearTimeout(t);
  }, [query, onSearch]);
  return (
    <div className="card" style={{ padding: 8, borderRadius: 12, marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <select defaultValue="all" style={{ padding: '10px 12px' }}>
          <option value="all">Order details</option>
          <option value="veg">Veg</option>
          <option value="nonveg">Non-Veg</option>
        </select>
        <input
          placeholder="Select an order type"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          style={{ flex: 1 }}
        />
        <select defaultValue="today" style={{ padding: '10px 12px' }}>
          <option value="today">Today</option>
          <option value="tomorrow">Tomorrow</option>
        </select>
      </div>
    </div>
  );
};

