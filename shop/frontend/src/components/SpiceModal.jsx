import React, { useState } from 'react';
import { Modal } from './Modal';
import { getSpiceBadge, findAssetByKeywords } from '../lib/assetFinder';

export const SpiceModal = ({ open, spiceLevels, onCancel, onConfirm, product }) => {
  const [selected, setSelected] = useState(undefined);
  const levels = spiceLevels && spiceLevels.length > 0 ? spiceLevels : ['Mild', 'Medium', 'Hot'];

  return (
    <Modal open={open} onClose={onCancel} title={null}>
      {product ? (
        <div style={{ position: 'relative', height: 160, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12 }}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="img-cover" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42, background: 'var(--primary-alpha-08)' }}>🌶️</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.00), rgba(2,6,23,0.35))' }} />
          <div style={{ position: 'absolute', left: 12, bottom: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{product.name}</div>
            <div style={{ fontWeight: 900, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>${product.price.toFixed(2)}</div>
          </div>
        </div>
      ) : null}
      {/* Label removed per request: show images only */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {levels.map((lvl) => {
          const lower = String(lvl || '').toLowerCase();
          const imgSrc = getSpiceBadge(lvl) || findAssetByKeywords(['extra-hot', 'hot', 'medium', 'mild', 'spice', 'chilli', 'pepper']);
          const active = selected === lvl;
          return (
            <button
              key={lvl}
              onClick={() => setSelected(lvl)}
              aria-label={lvl}
              style={{
                padding: 10,
                borderRadius: 16,
                border: active ? '2px solid var(--primary-600)' : '1px solid var(--border)',
                background: active ? 'var(--primary-alpha-12)' : 'var(--panel-2)',
                cursor: 'pointer',
                display: 'grid', placeItems: 'center'
              }}
            >
              <div style={{
                width: 120,
                height: 120,
                display: 'grid',
                placeItems: 'center',
                background: 'linear-gradient(180deg, rgba(255,255,255,0.85), rgba(255,255,255,0.70))',
                borderRadius: 14,
                border: '1px solid var(--border)'
              }}>
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={`${lvl} spice`}
                    loading="eager"
                    decoding="async"
                    style={{ maxWidth: '80%', maxHeight: '80%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }}
                  />
                ) : (
                  <div style={{ fontSize: 42 }}>🌶️</div>
                )}
              </div>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
        <button onClick={onCancel} className="hover-float" style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel-2)' }}>Cancel</button>
        <button onClick={() => onConfirm(selected)} className="primary-btn hover-float" style={{ padding: '12px 16px', borderRadius: 12, minWidth: 140 }}>OK</button>
      </div>
    </Modal>
  );
}

