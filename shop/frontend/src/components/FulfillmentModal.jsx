import React from 'react';
import { Modal } from './Modal';
import { getPickupImage, getDeliveryImage } from '../lib/assetFinder';

export const FulfillmentModal = ({ open, onChoose }) => {
  const pickupImg = getPickupImage();
  const deliveryImg = getDeliveryImage();
  return (
    <Modal open={open} onClose={() => {}} title={null}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <button
          onClick={() => onChoose('pickup')}
          style={{
            padding: 10,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ padding: 12, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Pickup</div>
            {pickupImg ? (
              <div style={{ height: 120, display: 'grid', placeItems: 'center' }}>
                <img src={pickupImg} alt="Pickup" loading="eager" decoding="async" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }} />
              </div>
            ) : (
              <div style={{ fontSize: 32 }}>🏪</div>
            )}
          </div>
        </button>
        <button
          onClick={() => onChoose('delivery')}
          style={{
            padding: 10,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--primary-600)',
            background: 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ padding: 12, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontWeight: 800 }}>Delivery</div>
            {deliveryImg ? (
              <div style={{ height: 120, display: 'grid', placeItems: 'center' }}>
                <img src={deliveryImg} alt="Delivery" loading="eager" decoding="async" style={{ maxWidth: '85%', maxHeight: '85%', objectFit: 'contain', filter: 'drop-shadow(0 1px 2px rgba(0,0,0,0.12))' }} />
              </div>
            ) : (
              <div style={{ fontSize: 32 }}>🚚</div>
            )}
          </div>
        </button>
      </div>
    </Modal>
  );
};

