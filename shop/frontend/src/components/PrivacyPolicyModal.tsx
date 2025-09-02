import React from 'react';
import { Modal } from './Modal';

type PrivacyPolicyModalProps = {
  open: boolean;
  onAccept: () => void;
};

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ open, onAccept }) => {
  return (
    <Modal open={open} onClose={() => {}} title="Privacy Policy">
      <p>
        We use necessary cookies to operate this shop and to remember your preferences.
        By clicking OK, you agree to our privacy policy.
      </p>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 12 }}>
        <button onClick={onAccept} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd', background: '#0ea5e9', color: '#fff' }}>OK</button>
      </div>
    </Modal>
  );
};