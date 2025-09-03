import React, { useEffect, useState } from 'react';
import { useCart } from '../store/CartContext';

export const AddToCartToast: React.FC = () => {
  const { lastAdded, state } = useCart();
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    if (lastAdded) {
      setMsg(`${lastAdded.quantity} × ${lastAdded.name} added to cart`);
      setVisible(true);
      const t = setTimeout(() => setVisible(false), 2200);
      return () => clearTimeout(t);
    }
  }, [lastAdded]);

  return (
    <div
      style={{
        position: 'fixed',
        right: 16,
        bottom: 16,
        zIndex: 60,
        transform: visible ? 'translateY(0)' : 'translateY(16px)',
        opacity: visible ? 1 : 0,
        transition: 'all .25s ease',
      }}
      aria-live="polite"
      aria-atomic="true"
    >
      <div className="card elevated" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 12, borderRadius: 12 }}>
        <div style={{ fontSize: 22 }}>✅</div>
        <div style={{ fontWeight: 700 }}>{msg}</div>
        <div style={{ marginLeft: 'auto', fontWeight: 800 }}>🛒 {state.items.length}</div>
      </div>
    </div>
  );
};

