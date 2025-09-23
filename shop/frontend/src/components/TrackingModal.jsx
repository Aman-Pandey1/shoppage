import React from 'react';
import { Modal } from './Modal';

export const TrackingModal = ({ open, onClose, trackingUrl, status }) => {
  const [canEmbed, setCanEmbed] = React.useState(true);
  React.useEffect(() => {
    setCanEmbed(true);
  }, [trackingUrl]);

  return (
    <Modal open={open} onClose={onClose} title="Live delivery tracking">
      {!trackingUrl ? (
        <div className="muted">Tracking URL not available yet. Current status: {status || 'unknown'}.</div>
      ) : (
        <div style={{ display: 'grid', gap: 10 }}>
          {canEmbed ? (
            <iframe
              src={trackingUrl}
              title="Uber tracking"
              style={{ width: '100%', height: '65vh', border: '1px solid var(--border-color)', borderRadius: 12 }}
              sandbox="allow-scripts allow-forms allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              referrerPolicy="no-referrer"
              onError={() => setCanEmbed(false)}
            />
          ) : (
            <div className="muted" style={{ fontSize: 14 }}>
              This provider cannot be embedded. Use the button below to open live tracking.
            </div>
          )}
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
            <a className="primary-btn" href={trackingUrl} target="_blank" rel="noreferrer noopener">Open in Uber</a>
          </div>
        </div>
      )}
    </Modal>
  );
};

