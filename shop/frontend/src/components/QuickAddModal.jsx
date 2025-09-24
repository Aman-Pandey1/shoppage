import React, { useEffect, useState } from 'react';
import { Modal } from './Modal';
import { resolveAssetUrl } from '../lib/api';

export const QuickAddModal = ({ open, product, onCancel, onConfirm }) => {
  const [qty, setQty] = useState(1);
  const [bump, setBump] = useState(false);
  if (!product) return null;

  function triggerBump() {
    setBump(true);
    // Reset after animation
    setTimeout(() => setBump(false), 200);
  }
  function dec() { setQty((q) => { const next = Math.max(1, q - 1); if (next !== q) triggerBump(); return next; }); }
  function inc() { setQty((q) => { const next = Math.min(99, q + 1); if (next !== q) triggerBump(); return next; }); }

  return (
    <Modal open={open} onClose={onCancel} title={null}>
      <div style={{ display: 'grid', gap: 12 }} className="animate-popIn">
        <div style={{ position: 'relative', height: 180, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)' }}>
          {product.imageUrl ? (
            <img src={resolveAssetUrl(product.imageUrl)} alt={product.name} className="img-cover" />
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
            <button onClick={dec} aria-label="Decrease" title="Decrease" className="hover-float" style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center' }}>–</button>
            <div className={bump ? 'animate-bump' : ''} style={{ minWidth: 24, textAlign: 'center', fontWeight: 800 }}>{qty}</div>
            <button onClick={inc} aria-label="Increase" title="Increase" className="hover-float" style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center' }}>+</button>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
          <button onClick={onCancel} className="hover-float" style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-2)' }}>Cancel</button>
          <button onClick={() => onConfirm(qty)} className="primary-btn hover-float" style={{ padding: '10px 16px', borderRadius: 10, minWidth: 140 }}>Add to cart</button>
        </div>
      </div>
    </Modal>
  );
};

