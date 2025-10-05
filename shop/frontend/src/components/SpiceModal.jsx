import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import { getSpiceBadge, normalizeSpiceLevel } from '../lib/assetFinder';

// Show the site's logo instead of chilli icons for spice options
export const SpiceModal = ({ open, spiceLevels, onCancel, onConfirm, product, siteLogoSrc }) => {
  const [selected, setSelected] = useState(undefined);

  const levels = useMemo(() => {
    const defaults = ['mild', 'medium', 'hot', 'extra-hot'];
    try {
      const raw = Array.isArray(spiceLevels) ? spiceLevels : Array.isArray(product?.spiceLevels) ? product.spiceLevels : [];
      const canonical = raw.map((lvl) => normalizeSpiceLevel(lvl));
      const unique = Array.from(new Set(canonical)).filter(Boolean);
      return unique.length ? unique : defaults;
    } catch { return defaults; }
  }, [spiceLevels, product && product.spiceLevels && product.spiceLevels.length]);

  // Resolve per-level image from assets; fallback to site's logo if provided
  const getSpiceImage = (level) => {
    try {
      return getSpiceBadge(level) || siteLogoSrc || '';
    } catch {
      return siteLogoSrc || '';
    }
  };

  const handleSelect = (level) => setSelected(level);

  // Unused now that we always show logo, kept for compatibility
  const importedSpiceImages = {};

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
              {/* IMAGE BIG + CENTER (logo) */}
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
          onClick={() => onConfirm(selected)}
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
            ? `Select ${selected.charAt(0).toUpperCase() + selected.slice(1)}`
            : 'Select Spice Level'}
        </button>
      </div>
    </Modal>
  );
};
