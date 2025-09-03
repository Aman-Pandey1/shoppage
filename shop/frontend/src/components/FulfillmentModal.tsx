import React from 'react';
import { Modal } from './Modal';
import type { FulfillmentType } from '../types';

type FulfillmentModalProps = {
  open: boolean;
  onChoose: (type: FulfillmentType) => void;
};

export const FulfillmentModal: React.FC<FulfillmentModalProps> = ({ open, onChoose }) => {
  return (
    <Modal open={open} onClose={() => {}} title="How would you like to receive your order?">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <button
          onClick={() => onChoose('pickup')}
          className="primary-btn"
          style={{ padding: '14px 16px', borderRadius: 12, minWidth: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
        >
          <div style={{ fontSize: 26 }}>🏪</div>
          <div style={{ fontWeight: 800 }}>Pickup</div>
          <div className="muted" style={{ fontSize: 12 }}>Collect from store</div>
        </button>
        <button
          onClick={() => onChoose('delivery')}
          className="primary-btn"
          style={{ padding: '14px 16px', borderRadius: 12, minWidth: 160, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 }}
        >
          <div style={{ fontSize: 26 }}>🚚</div>
          <div style={{ fontWeight: 800 }}>Delivery</div>
          <div className="muted" style={{ fontSize: 12 }}>Bring it to me</div>
        </button>
      </div>
    </Modal>
  );
};