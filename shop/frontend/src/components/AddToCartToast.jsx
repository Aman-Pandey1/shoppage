import React, { useEffect, useState } from 'react';
import { useCart } from '../store/CartContext';

export const AddToCartToast = () => {
  const { lastAdded, state } = useCart();
  const [visible, setVisible] = useState(false);
  const [msg, setMsg] = useState('');
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (lastAdded) {
      setMsg(`${lastAdded.quantity} × ${lastAdded.name} added to cart`);
      setVisible(true);
      setProgress(100);
      const hide = setTimeout(() => setVisible(false), 2600);
      const tickStart = Date.now();
      const timer = setInterval(() => {
        const elapsed = Date.now() - tickStart;
        const pct = Math.max(0, 100 - (elapsed / 2600) * 100);
        setProgress(pct);
      }, 60);
      return () => { clearTimeout(hide); clearInterval(timer); };
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
      <div className="card elevated" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr auto', alignItems: 'center', gap: 12, padding: 12, borderRadius: 14, minWidth: 320 }}>
        {lastAdded?.imageUrl ? (
          <img src={lastAdded.imageUrl} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
        ) : (
          <div style={{ width: 44, height: 44, borderRadius: 8, display: 'grid', placeItems: 'center', background: 'var(--primary-alpha-08)' }}>✅</div>
        )}
        <div style={{ display: 'grid', gap: 2 }}>
          <div style={{ fontWeight: 800, letterSpacing: '.01em' }}>{msg}</div>
          {lastAdded ? <div className="muted" style={{ fontSize: 12 }}>${lastAdded.price.toFixed(2)} each</div> : null}
          {lastAdded?.optionsSummary ? (
            <div className="muted" style={{ fontSize: 11, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{lastAdded.optionsSummary}</div>
          ) : null}
          <div style={{ height: 3, background: 'rgba(2,6,23,0.10)', borderRadius: 9999, overflow: 'hidden', marginTop: 6 }}>
            <div style={{ width: `${progress}%`, height: '100%', background: 'linear-gradient(90deg, var(--primary-alpha-25), var(--primary-alpha-12))' }} />
          </div>
        </div>
        <div style={{ display: 'grid', gap: 6, justifyItems: 'end' }}>
          <div style={{ fontWeight: 800 }}>🛒 {state.items.length}</div>
          <a href="#cart" style={{ fontSize: 12 }}>View cart</a>
        </div>
      </div>
    </div>
  );
};

