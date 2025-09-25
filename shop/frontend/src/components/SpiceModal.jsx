import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { getSpiceBadge, findAssetByKeywords, normalizeSpiceLevel } from '../lib/assetFinder';
// Explicit imports for spice level images (preferred usage)
// If these files are removed/renamed, the code will gracefully fall back to dynamic lookup
import mildImg from '../assets/mild.png';
import mediumImg from '../assets/medium.png';
import hotImg from '../assets/Hot.png';
import extraHotImg from '../assets/extra hot.png';

export const SpiceModal = ({ open, spiceLevels, onCancel, onConfirm, product }) => {
  const [selected, setSelected] = useState(undefined);
  const baseDefaults = ['Mild', 'Medium', 'Hot'];
  // Dedupe by canonical name and keep a stable order (single set of options)
  const levels = useMemo(() => {
    const input = Array.isArray(spiceLevels) && spiceLevels.length > 0 ? spiceLevels : baseDefaults;
    const canonicalSet = new Set(input.map((lvl) => normalizeSpiceLevel(lvl)));
    // Ensure we ALWAYS show the four standard levels regardless of backend config
    const ordered = ['mild', 'medium', 'hot', 'extra-hot'];
    for (const std of ordered) canonicalSet.add(std);
    const result = [];
    for (const key of ordered) {
      if (canonicalSet.has(key)) result.push(key);
    }
    for (const key of canonicalSet) {
      if (!ordered.includes(key)) result.push(key);
    }
    return result;
  }, [spiceLevels]);

  const importedSpiceImages = {
    'mild': mildImg,
    'medium': mediumImg,
    'hot': hotImg,
    'extra-hot': extraHotImg,
  };

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={null}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'center', gap: 12 }}>
          <button onClick={onCancel} className="hover-float" style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel-2)' }}>Cancel</button>
          <button onClick={() => onConfirm(selected)} disabled={!selected} className="primary-btn hover-float" style={{ padding: '12px 16px', borderRadius: 12, minWidth: 140, opacity: selected ? 1 : 0.7 }}>OK</button>
        </div>
      )}
    >
      {product ? (
        <div style={{ position: 'relative', height: 200, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12 }}>
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
      <div className="image-choice-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 14 }}>
        {levels.map((canonical) => {
          const imgSrc = importedSpiceImages[canonical] || getSpiceBadge(canonical) || findAssetByKeywords([canonical, 'spice', 'chilli', 'pepper']);
          const active = normalizeSpiceLevel(selected) === canonical;
          return (
            <button
              key={canonical}
              onClick={() => setSelected(canonical)}
              aria-label={canonical}
              className="image-choice"
              data-active={active}
            >
              <div className="image-square" style={{ width: '100%', height: 200 }}>
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
    </Modal>
  );
}

