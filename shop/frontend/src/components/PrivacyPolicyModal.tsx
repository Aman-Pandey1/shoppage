import React from 'react';
import { Modal } from './Modal';

type PrivacyPolicyModalProps = {
  open: boolean;
  onAccept: () => void;
};

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ open, onAccept }) => {
  return (
    <Modal open={open} onClose={() => {}} title="Privacy Policy">
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
        <div style={{ fontSize: 22 }}>🔒</div>
        <p style={{ color: 'var(--text)', marginTop: 0 }}>
        We use necessary cookies to operate this shop and to remember your preferences.
        By clicking OK, you agree to our privacy policy.
        </p>
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
        <button onClick={onAccept} className="primary-btn" style={{ padding: '10px 14px', borderRadius: 8 }}>OK</button>
      </div>
    </Modal>
  );
};