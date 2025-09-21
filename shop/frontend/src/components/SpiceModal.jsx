import React, { useState } from 'react';
import { Modal } from './Modal';
import chilliGreen from '../assets/chilli-green.svg';
import chilliOrange from '../assets/chilli-orange.svg';
import chilliRed from '../assets/chilli-red.svg';

export const SpiceModal = ({ open, spiceLevels, onCancel, onConfirm, product }) => {
  const [selected, setSelected] = useState(undefined);
  const levels = spiceLevels && spiceLevels.length > 0 ? spiceLevels : ['Mild', 'Medium', 'Hot'];

  return (
    <Modal open={open} onClose={onCancel} title={null}>
      {product ? (
        <div style={{ position: 'relative', height: 160, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12 }}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="img-cover" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42, background: 'var(--primary-alpha-08)' }}>🌶️</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.00), rgba(2,6,23,0.35))' }} />
          <div style={{ position: 'absolute', left: 12, bottom: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{product.name}</div>
            <div style={{ fontWeight: 900, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>${product.price.toFixed(2)}</div>
          </div>
        </div>
      ) : null}
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Choose spice level</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        {levels.map((lvl) => {
          const lower = String(lvl || '').toLowerCase();
          const imgSrc = lower.includes('hot') ? chilliRed : (lower.includes('medium') ? chilliOrange : chilliGreen);
          const active = selected === lvl;
          return (
            <button
              key={lvl}
              onClick={() => setSelected(lvl)}
              style={{
                padding: '12px 16px',
                borderRadius: 999,
                border: active ? '2px solid var(--primary-600)' : '1px solid var(--border)',
                background: active ? 'var(--primary-alpha-12)' : 'var(--panel-2)',
                cursor: 'pointer',
                display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, minWidth: 120
              }}
            >
              <img src={imgSrc} alt={`${lvl} chilli`} style={{ width: 28, height: 28 }} />
              <div style={{ fontWeight: 700 }}>{lvl}</div>
            </button>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
        <button onClick={onCancel} className="hover-float" style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel-2)' }}>Cancel</button>
        <button onClick={() => onConfirm(selected)} className="primary-btn hover-float" style={{ padding: '12px 16px', borderRadius: 12, minWidth: 140 }}>OK</button>
      </div>
    </Modal>
  );
}

