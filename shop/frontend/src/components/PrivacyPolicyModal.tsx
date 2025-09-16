import React from 'react';
import { Modal } from './Modal';

type PrivacyPolicyModalProps = {
  open: boolean;
  onAccept: () => void;
};

export const PrivacyPolicyModal: React.FC<PrivacyPolicyModalProps> = ({ open, onAccept }) => {
  return (
    <Modal open={open} onClose={() => {}} title="We respect your privacy">
      <div style={{ display: 'grid', gap: 14 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
          <div style={{ width: 56, height: 56, borderRadius: 16, display: 'grid', placeItems: 'center', background: 'linear-gradient(180deg, var(--primary-alpha-25), var(--primary-alpha-12))', border: '1px solid var(--primary-600)' }}>🔒</div>
          <div style={{ fontWeight: 800, fontSize: 18 }}>Privacy & cookies</div>
        </div>
        <div className="muted" style={{ textAlign: 'center' }}>
          We use essential cookies to keep the cart working and to improve your experience.
          By tapping Accept, you agree to our privacy policy and terms.
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', gap: 10 }}>
          <a href="#privacy" style={{ fontSize: 13 }}>View policy</a>
          <span className="muted" style={{ fontSize: 13 }}>·</span>
          <a href="#terms" style={{ fontSize: 13 }}>Terms</a>
        </div>
        <div style={{ display: 'flex', justifyContent: 'center', marginTop: 6 }}>
          <button onClick={onAccept} className="primary-btn" style={{ padding: '12px 16px', borderRadius: 12, minWidth: 200 }}>Accept & continue</button>
        </div>
      </div>
    </Modal>
  );
};