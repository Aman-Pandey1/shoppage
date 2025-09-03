import React, { useState } from 'react';
import { Modal } from './Modal';

export const SpiceModal: React.FC<{
  open: boolean;
  spiceLevels?: string[];
  onCancel: () => void;
  onConfirm: (spice?: string) => void;
}> = ({ open, spiceLevels, onCancel, onConfirm }) => {
  const [selected, setSelected] = useState<string | undefined>(undefined);
  const levels = spiceLevels && spiceLevels.length > 0 ? spiceLevels : ['Mild', 'Medium', 'Hot'];

  return (
    <Modal open={open} onClose={onCancel} title="Choose spice level">
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12 }}>
        {levels.map((lvl) => {
          const icon = lvl.toLowerCase().includes('hot') ? '🌶️🌶️' : lvl.toLowerCase().includes('medium') ? '🌶️' : '🫑';
          const active = selected === lvl;
          return (
            <button
              key={lvl}
              onClick={() => setSelected(lvl)}
              style={{
                padding: '12px 14px',
                borderRadius: 12,
                border: active ? '2px solid var(--primary-600)' : '1px solid var(--border)',
                background: active ? 'rgba(14,165,233,0.12)' : 'var(--panel-2)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 110
              }}
            >
              <div style={{ fontSize: 22 }}>{icon}</div>
              <div style={{ fontWeight: 700 }}>{lvl}</div>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel-2)' }}>Cancel</button>
        <button onClick={() => onConfirm(selected)} className="primary-btn" style={{ padding: '10px 14px', borderRadius: 8 }}>OK</button>
      </div>
    </Modal>
  );
};