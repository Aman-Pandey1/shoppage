import React from 'react';
import { useCart } from '../store/CartContext';

export const CartSidebar = ({ open, onClose, onCheckout, readyAt }) => {
  const { state, removeItem, updateQuantity, clearCart, getCartTotal } = useCart();
  const [now, setNow] = React.useState(Date.now());
  React.useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const timeString = React.useMemo(() => readyAt ? new Date(readyAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—', [readyAt]);
  const eta = React.useMemo(() => {
    if (!readyAt) return '';
    const diffMs = new Date(readyAt).getTime() - now;
    const mins = Math.max(0, Math.round(diffMs / 60000));
    return `(in ${mins} min)`;
  }, [readyAt, now]);

  return (
    <aside
      style={{
        position: 'fixed',
        top: 88,
        right: 16,
        bottom: 16,
        width: 360,
        background: '#fff',
        border: '1px solid var(--border)',
        borderRadius: 'var(--radius)',
        padding: 16,
        overflowY: 'auto',
      }}
      className="animate-slideInRight cart-sidebar"
      data-open={open ? 'true' : 'false'}
    >
      <div className="card" style={{ padding: 14, borderRadius: 12, marginBottom: 12, borderTop: '3px solid var(--primary)' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontSize: 12 }} className="muted">ORDER READY FOR</div>
            <div style={{ fontSize: 20, fontWeight: 800 }}>{timeString}</div>
            <div style={{ fontSize: 12 }} className="muted">{eta}</div>
          </div>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontSize: 12 }} className="muted">TOTAL</div>
            <div style={{ fontWeight: 800 }}>${getCartTotal().toFixed(2)}</div>
          </div>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, letterSpacing: '.02em' }}>Your order</h3>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {state.items.length > 0 ? <button onClick={clearCart} className="primary-btn" style={{ padding: '6px 10px', borderRadius: 8 }}>Clear</button> : null}
          <button onClick={onClose} aria-label="Close cart" title="Close" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} className="danger hide-desktop">✕</button>
        </div>
      </div>

      {state.items.length === 0 ? (
        <div className="card animate-fadeInUp" style={{ textAlign: 'center', padding: 22, borderRadius: 'var(--radius)', border: '1px dashed var(--primary-600)', background: 'var(--primary-alpha-04)', color: 'var(--muted)' }}>
          <div style={{ fontSize: 36, marginBottom: 6, color: 'var(--accent)' }}>🧾</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Your order is empty</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.items.map((item) => (
            <div key={item.id} className="card animate-fadeInUp" style={{ borderRadius: 'var(--radius-sm)', padding: 10, borderLeft: '3px solid var(--primary)' }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 8 }} /> : null}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700 }}>{item.name}</div>
                  {item.spiceLevel ? <div style={{ fontSize: 12, color: 'var(--muted)' }}>Spice: {item.spiceLevel}</div> : null}
                  {item.selectedOptions.length > 0 ? (
                    <ul style={{ paddingLeft: 18, margin: '6px 0', color: 'var(--text)' }}>
                      {item.selectedOptions.map((opt) => (
                        <li key={`${opt.groupKey}:${opt.optionKey}`}>{opt.optionKey}{opt.priceDelta ? ` (+$${opt.priceDelta.toFixed(2)})` : ''}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)}>+</button>
                    <div style={{ marginLeft: 'auto', fontWeight: 700 }}>${item.totalPrice.toFixed(2)}</div>
                  </div>
                </div>
                <button onClick={() => removeItem(item.id)} title="Remove" style={{ border: 'none', background: 'transparent', cursor: 'pointer' }} className="danger">✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="card" style={{ marginTop: 12, borderRadius: 'var(--radius-sm)', padding: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, marginBottom: 10 }}>
          <span>Total</span>
          <span>${getCartTotal().toFixed(2)}</span>
        </div>
        <button
          className="primary-btn"
          style={{ width: '100%', padding: '12px 16px', borderRadius: 12 }}
          disabled={state.items.length === 0}
          onClick={onCheckout}
        >
          Confirm →
        </button>
      </div>
    </aside>
  );
};

