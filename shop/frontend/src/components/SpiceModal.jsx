import React, { useState } from 'react';
import { Modal } from './Modal';
import { getSpiceBadge, findAssetByKeywords, normalizeSpiceLevel } from '../lib/assetFinder';

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
      <div className="image-choice-grid">
        {levels.map((lvl) => {
          const canonical = normalizeSpiceLevel(lvl);
          const imgSrc = getSpiceBadge(canonical) || findAssetByKeywords([canonical, 'spice', 'chilli', 'pepper']);
          const active = normalizeSpiceLevel(selected) === canonical;
          return (
            <button
              key={lvl}
              onClick={() => setSelected(canonical)}
              aria-label={canonical}
              className="image-choice"
              data-active={active}
            >
              <div className="image-square">
                {imgSrc ? (
                  <img
                    src={imgSrc}
                    alt={`${canonical} spice`}
                    loading="eager"
                    decoding="async"
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

