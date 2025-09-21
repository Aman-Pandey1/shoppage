import React from 'react';
import { useParams } from 'react-router-dom';
import { fetchJson, getAuthToken } from '../lib/api';
import { LoginModal } from '../components/LoginModal';

export const MyOrdersPage = () => {
  const params = useParams();
  const siteSlug = params.siteSlug;
  const [orders, setOrders] = React.useState([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState();
  const [query, setQuery] = React.useState('');
  const [loginOpen, setLoginOpen] = React.useState(false);
  const [tab, setTab] = React.useState('all'); // all | pickup | delivery

  React.useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        setLoading(true);
        if (!getAuthToken()) {
          setLoginOpen(true);
          setLoading(false);
          return;
        }
        const data = await fetchJson(`/api/shop/${siteSlug}/orders/mine`);
        if (mounted) setOrders(data);
      } catch (e) {
        const msg = String(e?.message || '');
        if (/401|403/.test(msg)) {
          if (mounted) {
            setLoginOpen(true);
            setError(undefined);
          }
        } else {
          if (mounted) setError(e.message || 'Failed to load orders');
        }
      } finally {
        if (mounted) setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, [siteSlug]);

  if (loading) return <div>Loading orders…</div>;
  if (error) return <div style={{ color: 'red' }}>{error}</div>;

  const filtered = React.useMemo(() => {
    let list = orders;
    if (tab !== 'all') list = list.filter((o) => (o.fulfillmentType || '').toLowerCase() === tab);
    if (!query.trim()) return list;
    const q = query.toLowerCase();
    return list.filter((o) =>
      o._id.toLowerCase().includes(q) ||
      o.items.some((it) => it.name.toLowerCase().includes(q))
    );
  }, [orders, query, tab]);

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <div className="card" style={{ padding: 12, marginBottom: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div style={{ fontWeight: 900, fontSize: 18 }}>My Orders</div>
        <div style={{ display: 'flex', gap: 8 }}>
          <button className={tab === 'all' ? 'primary-btn' : ''} onClick={() => setTab('all')}>All</button>
          <button className={tab === 'pickup' ? 'primary-btn' : ''} onClick={() => setTab('pickup')}>Pickup</button>
          <button className={tab === 'delivery' ? 'primary-btn' : ''} onClick={() => setTab('delivery')}>Delivery</button>
        </div>
      </div>
      <div className="card" style={{ padding: 8, borderRadius: 12, marginBottom: 10 }}>
        <input placeholder="Search my orders by item or order #" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <div className="muted">No orders yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 12 }}>
          {filtered.map((o) => (
            <div key={o._id} className="card" style={{ padding: 12, borderTop: `3px solid ${o.fulfillmentType === 'delivery' ? 'var(--primary)' : 'var(--green-600)'}` }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <div style={{ fontSize: 18 }}>{o.fulfillmentType === 'delivery' ? '🚚' : '🏪'}</div>
                  <div style={{ fontWeight: 800 }}>#{o._id.slice(-6)}</div>
                </div>
                <div className="muted" style={{ fontSize: 12, color: 'var(--primary-600)' }}>{new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <div className="muted" style={{ fontSize: 12, marginTop: 4 }}>{o.fulfillmentType === 'delivery' ? 'Delivery' : 'Pickup'}</div>
              <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
                {o.items.map((it, idx) => (
                  <li key={idx}>{it.name} × {it.quantity}</li>
                ))}
              </ul>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 900, color: 'var(--primary-600)' }}>${(o.totalCents/100).toFixed(2)}</div>
                {o.fulfillmentType === 'delivery' && o.dropoff?.address ? (
                  <div className="muted" style={{ fontSize: 12, textAlign: 'right' }}>
                    {o.dropoff.address.city}
                  </div>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      )}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => { setLoginOpen(false); }} mode="user" />
    </div>
  );
};

