import React, { useEffect, useMemo, useState } from 'react';
import { Modal } from './Modal';
import { resolveAssetUrl } from '../lib/api';

// Import spice images from assets folder
import mildImage from '../assets/mild.png';
import mediumImage from '../assets/medium.png';
import hotImage from '../assets/Hot.png';
import extraHotImage from '../assets/extra hot.png';

export const SpiceModal = ({ open, spiceLevels, onCancel, onConfirm, product, siteLogoSrc, initialQuantity = 1 }) => {
  const [selected, setSelected] = useState(undefined);
  const variants = Array.isArray(product?.variants) ? product.variants : [];
  const [selectedVariantKey, setSelectedVariantKey] = useState('');
  const [qty, setQty] = useState(() => {
    const n = Number(initialQuantity) || 1;
    return Math.max(1, Math.min(99, n));
  });
  const [bump, setBump] = useState(false);

  // Reset selection and quantity every time the modal opens or product changes
  useEffect(() => {
    if (open) {
      setSelected(undefined);
      const n = Number(initialQuantity) || 1;
      setQty(Math.max(1, Math.min(99, n)));
      setBump(false);
      setSelectedVariantKey(() => {
        // Autoselect the single variant if only one is available
        if (Array.isArray(product?.variants) && product.variants.length === 1) {
          return product.variants[0].key || '';
        }
        return '';
      });
    }
  }, [open, product, initialQuantity]);

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
  const selectedVariant = variants.find((v) => v.key === selectedVariantKey) || null;
  const hasVariants = variants.length > 0;
  const spiceRequired = Array.isArray(product?.spiceLevels) && (product.spiceLevels.length > 0);
  const canConfirm = (!spiceRequired || !!selected) && (!hasVariants || !!selectedVariant) && qty >= 1;

  return (
    <Modal
      open={open}
      onClose={onCancel}
      title={(product && product.name) ? product.name : 'Select Spice Level'}
      footer={(
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, width: '100%' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              border: '2px solid #e2e8f0',
              background: '#f7fafc',
              fontWeight: 600,
              color: '#4a5568',
              cursor: 'pointer',
            }}
          >Cancel</button>
          <button
            onClick={() => onConfirm({ spice: selected, variant: selectedVariant || undefined, quantity: qty })}
            disabled={!canConfirm}
            style={{
              padding: '12px 24px',
              borderRadius: 12,
              minWidth: 160,
              fontWeight: 600,
              background: canConfirm ? '#ff4444' : '#cbd5e0',
              color: 'white',
              border: 'none',
              cursor: canConfirm ? 'pointer' : 'not-allowed',
            }}
          >{`Add ${qty}`}</button>
        </div>
      )}
    >
      {/* No standalone logo at the top; we'll show it inside the product box */}
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
          {product?.imageUrl ? (
            <img
              src={resolveAssetUrl(product.imageUrl)}
              alt={product.name}
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
          ) : (
            <div
              style={{
                width: '100%',
                height: '100%',
                background: 'rgba(14, 165, 233, 0.06)',
                display: 'grid',
                placeItems: 'center'
              }}
            >
              {siteLogoSrc ? (
                <img
                  src={siteLogoSrc}
                  alt="logo"
                  style={{ width: 140, height: 140, objectFit: 'contain', opacity: 0.98 }}
                />
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
          {product ? (
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
          ) : null}
        </div>
      )}

      {/* Variant dropdown */}
      {hasVariants ? (
        <div style={{ display: 'grid', gap: 6, marginTop: 4, marginBottom: 10 }}>
          <div style={{ fontWeight: 800 }}>Select Varrient</div>
          <select
            value={selectedVariantKey}
            onChange={(e) => setSelectedVariantKey(e.target.value)}
            style={{ padding: 10, borderRadius: 10, border: '1px solid var(--border)', background: 'var(--panel)' }}
          >
            {selectedVariantKey === '' ? <option value="" disabled>Select Varrient</option> : null}
            {variants.map((v) => {
              const displayPrice = Number(product?.price || 0) + Number(v?.priceDelta || 0);
              return (
                <option key={v.key} value={v.key}>{`${v.label} — $${displayPrice.toFixed(2)}`}</option>
              );
            })}
          </select>
        </div>
      ) : null}

      {/* Spice level label just above icons */}
      {spiceRequired ? (
        <div style={{ marginTop: 4, marginBottom: 6, fontWeight: 800 }}>Spice Level</div>
      ) : null}

      {/* Spice Options */}
      {spiceRequired ? (
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
      ) : null}

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

    </Modal>
  );
};