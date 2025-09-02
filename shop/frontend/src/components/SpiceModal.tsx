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
        {levels.map((lvl) => (
          <button
            key={lvl}
            onClick={() => setSelected(lvl)}
            style={{
              padding: '10px 12px',
              borderRadius: 8,
              border: selected === lvl ? '2px solid #0ea5e9' : '1px solid #ddd',
              background: selected === lvl ? '#e0f2fe' : '#fff',
              cursor: 'pointer',
            }}
          >
            {lvl}
          </button>
        ))}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd' }}>Cancel</button>
        <button onClick={() => onConfirm(selected)} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #0ea5e9', background: '#0ea5e9', color: '#fff' }}>OK</button>
      </div>
    </Modal>
  );
};