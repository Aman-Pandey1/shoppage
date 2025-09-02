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
      <div style={{ display: 'flex', gap: 16, justifyContent: 'center' }}>
        <button onClick={() => onChoose('pickup')} className="primary-btn" style={{ padding: '12px 16px', borderRadius: 10, minWidth: 160 }}>Pickup</button>
        <button onClick={() => onChoose('delivery')} className="primary-btn" style={{ padding: '12px 16px', borderRadius: 10, minWidth: 160 }}>Delivery</button>
      </div>
    </Modal>
  );
};