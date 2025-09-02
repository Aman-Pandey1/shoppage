import React from 'react';

type ModalProps = {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
};

const overlayStyle: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(2,6,23,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(4px)'
};

const panelStyle: React.CSSProperties = {
  width: 'min(92vw, 640px)',
  background: 'var(--panel)',
  borderRadius: 12,
  border: '1px solid var(--border)',
  boxShadow: 'var(--shadow-soft)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--border)',
  fontWeight: 700,
  fontSize: 18,
  color: 'var(--text)'
};

const bodyStyle: React.CSSProperties = {
  padding: 20,
  color: 'var(--text)'
};

const footerStyle: React.CSSProperties = {
  padding: 16,
  borderTop: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const buttonStyle: React.CSSProperties = {
  padding: '10px 14px',
  borderRadius: 8,
  border: '1px solid var(--primary-600)',
  background: 'linear-gradient(180deg, rgba(14,165,233,0.16), rgba(14,165,233,0.10))',
  color: 'var(--text)',
  cursor: 'pointer',
};

export const Modal: React.FC<ModalProps> = ({ open, onClose, title, children, footer }) => {
  if (!open) return null;
  return (
    <div style={overlayStyle} onClick={onClose}>
      <div style={panelStyle} className="animate-popIn" onClick={(e) => e.stopPropagation()}>
        {title ? <div style={headerStyle}>{title}</div> : null}
        <div style={bodyStyle}>{children}</div>
        {footer ? <div style={footerStyle}>{footer}</div> : (
          <div style={footerStyle}>
            <button style={buttonStyle} onClick={onClose}>Close</button>
          </div>
        )}
      </div>
    </div>
  );
};