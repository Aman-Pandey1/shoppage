import React from 'react';

const overlayStyle = {
  position: 'fixed',
  inset: 0,
  background:
    'radial-gradient(800px 500px at 10% -10%, rgba(236,100,70,0.18), transparent 40%),\
     radial-gradient(800px 600px at 110% 10%, rgba(228,76,60,0.18), transparent 46%),\
     rgba(2,6,23,0.55)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 1000,
  backdropFilter: 'blur(4px)'
};

const panelStyle = {
  width: 'min(92vw, 640px)',
  maxHeight: '86vh',
  background: 'linear-gradient(180deg, rgba(255,255,255,0.90), rgba(255,255,255,0.70))',
  borderRadius: 20,
  border: '1px solid var(--border)',
  boxShadow: '0 24px 80px rgba(2,6,23,0.30), 0 0 0 1px rgba(255,255,255,0.6) inset',
  position: 'relative',
  overflow: 'visible',
  display: 'flex',
  flexDirection: 'column',
  backdropFilter: 'saturate(160%) blur(12px)'
};

const headerStyle = {
  padding: '16px 20px',
  borderBottom: '1px solid var(--border)',
  fontWeight: 800,
  fontSize: 20,
  color: 'var(--text)'
};

const bodyStyle = {
  padding: 20,
  color: 'var(--text)',
  overflow: 'auto'
};

const footerStyle = {
  padding: 16,
  borderTop: '1px solid var(--border)',
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 12,
};

const buttonStyle = {
  padding: '10px 14px',
  borderRadius: 10,
  border: '1px solid var(--primary-600)',
  background: 'linear-gradient(180deg, var(--primary-alpha-22), var(--primary-alpha-12))',
  color: 'var(--text)',
  cursor: 'pointer',
};

export const Modal = ({ open, onClose, title, children, footer }) => {
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

