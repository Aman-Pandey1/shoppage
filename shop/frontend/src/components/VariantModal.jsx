import React, { useState } from 'react';
import { Modal } from './Modal';

export const VariantModal = ({ open, variants = [], onCancel, onConfirm, product }) => {
  const [selectedKey, setSelectedKey] = useState('');

  const selected = variants.find((v) => v.key === selectedKey) || null;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={null}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={onCancel} style={{ padding: '10px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel-2)' }}>Cancel</button>
          <button onClick={() => onConfirm(selected)} disabled={!selected} className="primary-btn" style={{ padding: '10px 14px', borderRadius: 10, minWidth: 140, opacity: selected ? 1 : 0.7 }}>OK</button>
        </div>
      )}
    >
      {product ? (
        <div style={{ position: 'relative', height: 160, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12 }}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="img-cover" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42, background: 'var(--primary-alpha-08)' }}>🧩</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.00), rgba(2,6,23,0.35))' }} />
          <div style={{ position: 'absolute', left: 12, bottom: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{product.name}</div>
            <div style={{ fontWeight: 900, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>${product.price.toFixed(2)}</div>
          </div>
        </div>
      ) : null}
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Select Variant</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 10 }}>
        {variants.map((v) => {
          const active = selectedKey === v.key;
          return (
            <button
              key={v.key}
              onClick={() => setSelectedKey(v.key)}
              className="image-choice"
              data-active={active}
              style={{ padding: 12, borderRadius: 12, border: active ? '2px solid var(--primary-600)' : '1px solid var(--border)', background: active ? 'rgba(14,165,233,0.12)' : 'var(--panel)' }}
            >
              <div style={{ fontWeight: 800 }}>{v.label}</div>
              <div className="muted" style={{ fontSize: 12 }}>{
                `$${Number(v?.price || 0).toFixed(2)}`
              }</div>
            </button>
          );
        })}
      </div>
    </Modal>
  );
};

