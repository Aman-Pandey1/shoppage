import React from 'react';
import { useParams } from 'react-router-dom';
import { fetchJson, getAuthToken } from '../lib/api';
import { LoginModal } from '../components/LoginModal';

type Order = {
  _id: string;
  totalCents: number;
  createdAt: string;
  items: { name: string; quantity: number; priceCents: number }[];
};

export const MyOrdersPage: React.FC = () => {
  const params = useParams();
  const siteSlug = params.siteSlug as string;
  const [orders, setOrders] = React.useState<Order[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | undefined>();
  const [query, setQuery] = React.useState('');
  const [loginOpen, setLoginOpen] = React.useState(false);

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
        const data = await fetchJson<Order[]>(`/api/shop/${siteSlug}/orders/mine`);
        if (mounted) setOrders(data);
      } catch (e: any) {
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
    if (!query.trim()) return orders;
    const q = query.toLowerCase();
    return orders.filter((o) =>
      o._id.toLowerCase().includes(q) ||
      o.items.some((it) => it.name.toLowerCase().includes(q))
    );
  }, [orders, query]);

  return (
    <div className="container" style={{ paddingTop: 20 }}>
      <h2 style={{ marginTop: 0 }}>My Orders</h2>
      <div className="card" style={{ padding: 8, borderRadius: 12, marginBottom: 10 }}>
        <input placeholder="Search my orders by item or order #" value={query} onChange={(e) => setQuery(e.target.value)} />
      </div>
      {filtered.length === 0 ? (
        <div className="muted">No orders yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 12 }}>
          {filtered.map((o) => (
            <div key={o._id} className="card" style={{ padding: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                <div style={{ fontWeight: 800 }}>#{o._id.slice(-6)}</div>
                <div className="muted" style={{ fontSize: 12 }}>{new Date(o.createdAt).toLocaleString()}</div>
              </div>
              <ul style={{ margin: '8px 0', paddingLeft: 18 }}>
                {o.items.map((it, idx) => (
                  <li key={idx}>{it.name} × {it.quantity}</li>
                ))}
              </ul>
              <div style={{ fontWeight: 900 }}>${(o.totalCents/100).toFixed(2)}</div>
            </div>
          ))}
        </div>
      )}
      <LoginModal open={loginOpen} onClose={() => setLoginOpen(false)} onSuccess={() => { setLoginOpen(false); }} mode="user" />
    </div>
  );
};

