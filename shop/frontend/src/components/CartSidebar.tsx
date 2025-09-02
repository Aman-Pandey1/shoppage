import React from 'react';
import { useCart } from '../store/CartContext';

export const CartSidebar: React.FC = () => {
  const { state, removeItem, updateQuantity, clearCart, getCartTotal } = useCart();

  return (
    <aside style={{
      position: 'fixed',
      top: 16,
      left: 16,
      bottom: 16,
      width: 320,
      background: 'var(--panel)',
      border: '1px solid var(--border)',
      borderRadius: 'var(--radius)',
      padding: 16,
      overflowY: 'auto',
      zIndex: 10,
      boxShadow: 'var(--shadow-soft)'
    }} className="animate-slideInLeft cart-sidebar">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0, letterSpacing: '.02em' }}>Cart</h3>
        <button onClick={clearCart} className="primary-btn" style={{ padding: '6px 10px', borderRadius: 8 }}>Clear</button>
      </div>

      {state.items.length === 0 ? (
        <div className="card animate-fadeInUp" style={{
          textAlign: 'center',
          padding: 18,
          borderRadius: 'var(--radius)',
          border: '1px dashed var(--border)',
          background: 'linear-gradient(180deg, rgba(255,255,255,0.02), rgba(255,255,255,0.01))',
          color: 'var(--muted)'
        }}>
          <div style={{ fontSize: 36, marginBottom: 6, color: 'var(--accent)' }}>🛒</div>
          <div style={{ fontWeight: 700, marginBottom: 4 }}>Your cart is empty</div>
          <div style={{ fontSize: 13 }}>Browse categories and add delicious items!</div>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.items.map((item) => (
            <div key={item.id} className="card animate-fadeInUp" style={{ borderRadius: 'var(--radius-sm)', padding: 10 }}>
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

      <div className="card" style={{ marginTop: 12, borderRadius: 'var(--radius-sm)', padding: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 700 }}>
        <span>Total</span>
        <span>${getCartTotal().toFixed(2)}</span>
      </div>
    </aside>
  );
};