import React from 'react';
import { Modal } from './Modal';

type PrivacyPolicyModalProps = {
  open: boolean;
  onAccept: () => void;
};

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ open, onAccept }) => {
  return (
    <Modal open={open} onClose={() => {}} title="Privacy Policy">
      <div style={{ display: 'grid', placeItems: 'center', textAlign: 'center', gap: 10 }}>
        <div style={{ fontSize: 40 }}>🔒</div>
        <div style={{ color: 'var(--text)' }}>
          We use necessary cookies to run this store and improve your experience. By continuing,
          you agree to our privacy policy and terms.
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: 12 }}>
        <button onClick={onAccept} className="primary-btn" style={{ padding: '12px 16px', borderRadius: 12, minWidth: 180 }}>OK</button>
      </div>
    </Modal>
  );
};