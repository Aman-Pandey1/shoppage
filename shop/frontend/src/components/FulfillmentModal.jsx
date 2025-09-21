import React from 'react';
import { Modal } from './Modal';

export const FulfillmentModal = ({ open, onChoose }) => {
  return (
    <Modal open={open} onClose={() => {}} title="Choose your order type">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <button
          onClick={() => onChoose('pickup')}
          style={{
            padding: 0,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--border)',
            background: 'linear-gradient(180deg, rgba(255,255,255,0.55), rgba(255,255,255,0.35))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ height: 120, background: 'url(https://images.unsplash.com/photo-1504754524776-8f4f37790ca0?q=80&w=1200&auto=format&fit=crop) center/cover' }} />
          <div style={{ padding: 14, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>🏪</div>
            <div style={{ fontWeight: 800 }}>Pickup</div>
            <div className="muted" style={{ fontSize: 12 }}>Choose by location or city</div>
          </div>
        </button>
        <button
          onClick={() => onChoose('delivery')}
          style={{
            padding: 0,
            borderRadius: 16,
            overflow: 'hidden',
            border: '1px solid var(--primary-600)',
            background: 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))',
          }}
          className="animate-fadeInUp"
        >
          <div style={{ height: 120, background: 'url(https://images.unsplash.com/photo-1562967914-608f82629710?q=80&w=1200&auto=format&fit=crop) center/cover' }} />
          <div style={{ padding: 14, display: 'grid', gap: 6, textAlign: 'center' }}>
            <div style={{ fontSize: 24 }}>🚚</div>
            <div style={{ fontWeight: 800 }}>Delivery</div>
            <div className="muted" style={{ fontSize: 12 }}>Enter your address</div>
          </div>
        </button>
      </div>
    </Modal>
  );
};

