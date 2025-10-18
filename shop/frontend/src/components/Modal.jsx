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
  backdropFilter: 'blur(4px)',
  overscrollBehavior: 'contain',
  touchAction: 'none',
};

const panelStyle = {
  // Width is overridden via prop; this is a safe default
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
  overflow: 'auto',
  overflowX: 'hidden',
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

export const Modal = ({ open, onClose, title, children, footer, maxWidth = 640, closeOnOverlayClick = true }) => {
  // Lock background scroll and pause background animations while modal is open
  React.useEffect(() => {
    if (!open) return;
    const body = document.body;
    const prevOverflow = body.style.overflow;
    const prevPaddingRight = body.style.paddingRight;
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth;
    // Maintain a simple modal open counter so nested modals don't fight
    const currentCount = Number(body.dataset.modalCount || '0');
    body.dataset.modalCount = String(currentCount + 1);
    if (currentCount === 0) {
      body.style.overflow = 'hidden';
      if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;
      body.classList.add('modal-active');
    }
    return () => {
      const nextCount = Math.max(0, Number(body.dataset.modalCount || '1') - 1);
      body.dataset.modalCount = String(nextCount);
      if (nextCount === 0) {
        body.style.overflow = prevOverflow;
        body.style.paddingRight = prevPaddingRight;
        body.classList.remove('modal-active');
      }
    };
  }, [open]);
  if (!open) return null;
  const mergedPanelStyle = { ...panelStyle, width: `min(92vw, ${Number(maxWidth) || 640}px)`, maxWidth: '100%' };
  return (
    <div
      style={overlayStyle}
      onClick={(e) => {
        if (!closeOnOverlayClick) return;
        if (typeof onClose === 'function') onClose(e);
      }}
    >
      <div style={mergedPanelStyle} className="modal animate-popIn" onClick={(e) => e.stopPropagation()}>
        {title ? <div style={headerStyle}>{title}</div> : null}
        <div style={bodyStyle} className="modal__body">{children}</div>
        {footer ? <div style={footerStyle}>{footer}</div> : null}
      </div>
    </div>
  );
};

