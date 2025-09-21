import React, { useState } from 'react';
import { Modal } from './Modal';

export const QuickAddModal = ({ open, product, onCancel, onConfirm }) => {
  const [qty, setQty] = useState(1);
  if (!product) return null;

  function dec() { setQty((q) => Math.max(1, q - 1)); }
  function inc() { setQty((q) => Math.min(99, q + 1)); }

  return (
    <Modal open={open} onClose={onCancel} title={null}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div style={{ position: 'relative', height: 180, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="img-cover" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42, background: 'var(--primary-alpha-08)' }}>🛍️</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.00), rgba(2,6,23,0.35))' }} />
          <div style={{ position: 'absolute', left: 12, bottom: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{product.name}</div>
            <div style={{ fontWeight: 900, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>${product.price.toFixed(2)}</div>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr auto', alignItems: 'center', gap: 12 }}>
          <div className="muted" style={{ fontSize: 13 }}>{product.description || 'Add this to your order'}</div>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 999, padding: 6, background: 'var(--panel-2)' }}>
            <button onClick={dec} aria-label="Decrease" title="Decrease" style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center' }}>–</button>
            <div style={{ minWidth: 24, textAlign: 'center', fontWeight: 800 }}>{qty}</div>
            <button onClick={inc} aria-label="Increase" title="Increase" style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center' }}>+</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-2)' }}>Cancel</button>
          <button onClick={() => onConfirm(qty)} className="primary-btn" style={{ padding: '10px 16px', borderRadius: 10, minWidth: 140 }}>Add to cart</button>
        </div>
      </div>
    </Modal>
  );
};

