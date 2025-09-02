import React from 'react';
import { useCart } from '../store/CartContext';

export const CartSidebar: React.FC = () => {
  const { state, removeItem, updateQuantity, clearCart, getCartTotal } = useCart();

  return (
    <aside style={{
      position: 'fixed',
      top: 0,
      left: 0,
      bottom: 0,
      width: 320,
      background: '#ffffff',
      borderRight: '1px solid #e5e7eb',
      padding: 16,
      overflowY: 'auto',
      zIndex: 10,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <h3 style={{ margin: 0 }}>Cart</h3>
        <button onClick={clearCart} style={{ padding: '6px 10px', borderRadius: 6, border: '1px solid #ddd', background: '#f8fafc' }}>Clear</button>
      </div>

      {state.items.length === 0 ? (
        <div style={{ color: '#6b7280' }}>Your cart is empty.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {state.items.map((item) => (
            <div key={item.id} style={{ border: '1px solid #eee', borderRadius: 8, padding: 10 }}>
              <div style={{ display: 'flex', gap: 10 }}>
                {item.imageUrl ? <img src={item.imageUrl} alt={item.name} style={{ width: 60, height: 60, objectFit: 'cover', borderRadius: 6 }} /> : null}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 600 }}>{item.name}</div>
                  {item.spiceLevel ? <div style={{ fontSize: 12, color: '#6b7280' }}>Spice: {item.spiceLevel}</div> : null}
                  {item.selectedOptions.length > 0 ? (
                    <ul style={{ paddingLeft: 18, margin: '6px 0', color: '#374151' }}>
                      {item.selectedOptions.map((opt) => (
                        <li key={`${opt.groupKey}:${opt.optionKey}`}>{opt.optionKey}{opt.priceDelta ? ` (+$${opt.priceDelta.toFixed(2)})` : ''}</li>
                      ))}
                    </ul>
                  ) : null}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <button onClick={() => updateQuantity(item.id, Math.max(1, item.quantity - 1))} style={{ padding: '4px 10px' }}>-</button>
                    <span>{item.quantity}</span>
                    <button onClick={() => updateQuantity(item.id, item.quantity + 1)} style={{ padding: '4px 10px' }}>+</button>
                    <div style={{ marginLeft: 'auto', fontWeight: 600 }}>${item.totalPrice.toFixed(2)}</div>
                  </div>
                </div>
                <button onClick={() => removeItem(item.id)} style={{ border: 'none', background: 'transparent', cursor: 'pointer', color: '#ef4444' }}>✕</button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{ marginTop: 12, borderTop: '1px solid #eee', paddingTop: 12, display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
        <span>Total</span>
        <span>${getCartTotal().toFixed(2)}</span>
      </div>
    </aside>
  );
};