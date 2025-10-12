import React from 'react';
import { Modal } from './Modal';

export const AlertModal = ({
  open,
  onClose,
  title = 'Attention',
  message,
  confirmLabel = 'OK',
}) => {
  if (!open) return null;
  return (
    <Modal open={open} onClose={onClose} title={null}>
      <div style={{ display: 'grid', gap: 12 }}>
        <div
          style={{
            display: 'grid',
            gap: 8,
            justifyItems: 'center',
            textAlign: 'center',
            padding: 16,
            borderRadius: 14,
            border: '1px solid var(--danger)',
            background: 'linear-gradient(180deg, rgba(239,68,68,0.20), rgba(239,68,68,0.10))',
          }}
        >
          <div style={{ fontSize: 26 }}>⛔</div>
          <div style={{ fontWeight: 900, fontSize: 18, color: 'var(--text)' }}>{title}</div>
          {message ? (
            <div style={{ color: '#7f1d1d' }}>{message}</div>
          ) : null}
        </div>
        <div style={{ display: 'flex', justifyContent: 'center' }}>
          <button className="primary-btn" onClick={onClose}>{confirmLabel}</button>
        </div>
      </div>
    </Modal>
  );
};
