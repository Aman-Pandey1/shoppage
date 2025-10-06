import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';

// Import spice images from assets folder
import mildImage from '../assets/mild.png';
import mediumImage from '../assets/medium.png';
import hotImage from '../assets/Hot.png';
import extraHotImage from '../assets/extra hot.png';

export const SpiceModal = ({ open, spiceLevels, onCancel, onConfirm, product, siteLogoSrc }) => {
  const [selected, setSelected] = useState(undefined);
  const [qty, setQty] = useState(() => {
    const n = Number(initialQuantity) || 1;
    return Math.max(1, Math.min(99, n));
  });
  const [bump, setBump] = useState(false);

  const levels = useMemo(() => {
    // Always show full set to ensure consistency across products
    return ['mild', 'medium', 'hot', 'extra-hot'];
  }, []);

  // Direct image mapping from imported assets
  const getSpiceImage = (level) => {
    const imageMap = {
      'mild': mildImage,
      'medium': mediumImage,
      'hot': hotImage,
      'extra-hot': extraHotImage
    };
    return imageMap[level] || siteLogoSrc || '';
  };

  const handleSelect = (level) => setSelected(level);

  return (
    <Modal open={open} onClose={onCancel} title="Select Spice Level">
      {product && (
        <div
          style={{
            position: 'relative',
            height: 160,
            borderRadius: 14,
            overflow: 'hidden',
            border: '1px solid #e2e8f0',
            marginBottom: 12,
          }}
        >
          {product.imageUrl ? (
            <img
              src={product.imageUrl}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                display: 'grid',
                placeItems: 'center',
                background: 'rgba(14, 165, 233, 0.06)',
              }}
            >
              {siteLogoSrc ? (
                <img src={siteLogoSrc} alt="logo" style={{ width: 96, height: 96, objectFit: 'contain', opacity: 0.85 }} />
              ) : null}
            </div>
          )}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(180deg, rgba(2,6,23,0.00), rgba(2,6,23,0.35))',
            }}
          />
          <div
            style={{
              position: 'absolute',
              left: 12,
              bottom: 12,
              right: 12,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: 18,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              {product.name}
            </div>
            <div
              style={{
                fontWeight: 900,
                color: '#fff',
                textShadow: '0 1px 2px rgba(0,0,0,0.3)',
              }}
            >
              ${product.price.toFixed(2)}
            </div>
          </div>
        </div>
      )}

      {/* Spice Options */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(4, 1fr)',
          gap: 16,
          margin: '10px 0',
        }}
      >
        {levels.map((canonical) => {
          const imgSrc = getSpiceImage(canonical);
          const active = selected === canonical;
          const displayName = canonical
            .split('-')
            .map((w) => w[0].toUpperCase() + w.slice(1))
            .join(' ');

          return (
            <button
              key={canonical}
              onClick={() => handleSelect(canonical)}
              aria-label={canonical}
              style={{
                border: active ? '3px solid #ff4444' : '2px solid transparent',
                borderRadius: '12px',
                background: 'transparent',
                transition: 'all 0.2s ease',
                cursor: 'pointer',
                outline: 'none',
                height: 180,
                padding: 0,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {/* IMAGE FROM ASSETS FOLDER */}
              {imgSrc ? (
                <img
                  src={imgSrc}
                  alt={`${canonical} spice level`}
                  style={{
                    width: '140px',
                    height: '140px',
                    objectFit: 'contain',
                    background: 'transparent',
                    borderRadius: 12,
                    filter: active ? 'none' : 'grayscale(25%)',
                    transition: 'all 0.2s ease',
                  }}
                />
              ) : (
                <div style={{ width: 140, height: 140 }} />
              )}
              {/* TEXT */}
              <div
                style={{
                  marginTop: 8,
                  fontSize: '16px',
                  fontWeight: 600,
                  color: active ? '#ff4444' : '#4a5568',
                }}
              >
                {displayName}
              </div>
            </button>
          );
        })}
      </div>

      {/* Quantity controls */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 12, marginTop: 8 }}>
        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, border: '1px solid var(--border)', borderRadius: 999, padding: 6, background: 'var(--panel-2)' }}>
          <button
            onClick={() => setQty((q) => { const next = Math.max(1, q - 1); if (next !== q) { setBump(true); setTimeout(() => setBump(false), 200); } return next; })}
            aria-label="Decrease"
            title="Decrease"
            className="hover-float"
            style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center' }}
          >
            –
          </button>
          <div className={bump ? 'animate-bump' : ''} style={{ minWidth: 24, textAlign: 'center', fontWeight: 800 }}>{qty}</div>
          <button
            onClick={() => setQty((q) => { const next = Math.min(99, q + 1); if (next !== q) { setBump(true); setTimeout(() => setBump(false), 200); } return next; })}
            aria-label="Increase"
            title="Increase"
            className="hover-float"
            style={{ width: 32, height: 32, borderRadius: 999, display: 'grid', placeItems: 'center' }}
          >
            +
          </button>
        </div>
      </div>

      {/* Buttons */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: 12,
          marginTop: 24,
        }}
      >
        <button
          onClick={onCancel}
          style={{
            padding: '12px 24px',
            borderRadius: 12,
            border: '2px solid #e2e8f0',
            background: '#f7fafc',
            fontWeight: '600',
            color: '#4a5568',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          Cancel
        </button>
        <button
          onClick={() => onConfirm(selected, qty)}
          style={{
            padding: '12px 24px',
            borderRadius: 12,
            minWidth: 160,
            fontWeight: '600',
            background: selected ? '#ff4444' : '#cbd5e0',
            color: 'white',
            border: 'none',
            cursor: selected ? 'pointer' : 'not-allowed',
            transition: 'all 0.2s ease',
          }}
          disabled={!selected}
        >
          {selected
            ? `Add ${qty} • ${selected.charAt(0).toUpperCase() + selected.slice(1)}`
            : 'Select Spice Level'}
        </button>
      </div>
    </Modal>
  );
};