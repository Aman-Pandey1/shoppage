import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';

function groupKey(groupIndex) {
  return `g_${groupIndex}`;
}

export const ExtrasModal = ({ open, groups = [], onCancel, onConfirm, product }) => {
  const [selected, setSelected] = useState({});

  const constraints = useMemo(() => {
    const result = {};
    groups.forEach((g, idx) => {
      result[groupKey(idx)] = {
        min: g.minSelect ?? 0,
        max: g.maxSelect ?? g.options.length,
      };
    });
    return result;
  }, [groups]);

  function toggle(groupIdx, optionKey) {
    const gk = groupKey(groupIdx);
    setSelected((prev) => {
      const set = new Set(prev[gk] || []);
      const { max } = constraints[gk] || { min: 0, max: Infinity };
      if (set.has(optionKey)) {
        set.delete(optionKey);
      } else {
        if (set.size >= max) return prev;
        set.add(optionKey);
      }
      return { ...prev, [gk]: set };
    });
  }

  function canConfirm() {
    for (let idx = 0; idx < groups.length; idx++) {
      const gk = groupKey(idx);
      const set = selected[gk] || new Set();
      const { min } = constraints[gk] || { min: 0, max: Infinity };
      if (set.size < min) return false;
    }
    return true;
  }

  function handleConfirm() {
    const list = [];
    groups.forEach((g, idx) => {
      const gk = groupKey(idx);
      const set = selected[gk] || new Set();
      g.options.forEach((opt) => {
        if (set.has(opt.key)) list.push({ groupKey: g.groupKey, optionKey: opt.key, priceDelta: opt.priceDelta });
      });
    });
    onConfirm(list);
  }

  return (
    <Modal open={open} onClose={onCancel} title={null}>
      {product ? (
        <div style={{ position: 'relative', height: 160, borderRadius: 14, overflow: 'hidden', border: '1px solid var(--border)', marginBottom: 12 }}>
          {product.imageUrl ? (
            <img src={product.imageUrl} alt={product.name} className="img-cover" />
          ) : (
            <div style={{ width: '100%', height: '100%', display: 'grid', placeItems: 'center', fontSize: 42, background: 'var(--primary-alpha-08)' }}>➕</div>
          )}
          <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(180deg, rgba(2,6,23,0.00), rgba(2,6,23,0.35))' }} />
          <div style={{ position: 'absolute', left: 12, bottom: 12, right: 12, display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div style={{ fontWeight: 900, fontSize: 18, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>{product.name}</div>
            <div style={{ fontWeight: 900, color: '#fff', textShadow: '0 1px 2px rgba(0,0,0,0.3)' }}>${product.price.toFixed(2)}</div>
          </div>
        </div>
      ) : null}
      <div style={{ fontWeight: 800, marginBottom: 6 }}>Choose extras</div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((group, gIdx) => {
          const gk = groupKey(gIdx);
          const set = selected[gk] || new Set();
          const min = group.minSelect ?? 0;
          const max = group.maxSelect ?? group.options.length;
          return (
            <div key={group.groupKey} style={{ border: '1px solid var(--border)', borderRadius: 12, padding: 12, background: 'var(--panel-2)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
                <div style={{ fontSize: 18 }}>➕</div>
                <div style={{ fontWeight: 700 }}>
                  {group.groupLabel} {min > 0 ? `(choose at least ${min})` : ''} {max > 0 ? `(up to ${max})` : ''}
                </div>
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {group.options.map((opt) => {
                  const active = set.has(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => toggle(gIdx, opt.key)}
                      style={{
                        padding: '10px 12px',
                        borderRadius: 10,
                        border: active ? '2px solid var(--primary-600)' : '1px solid var(--border)',
                        background: active ? 'rgba(14,165,233,0.12)' : 'var(--panel)',
                        cursor: 'pointer',
                        display: 'flex', alignItems: 'center', gap: 8
                      }}
                    >
                      <span>✨</span>
                      <span>{opt.label}{opt.priceDelta ? ` (+$${opt.priceDelta.toFixed(2)})` : ''}</span>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: '10px 14px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--panel-2)' }}>Cancel</button>
        <button disabled={!canConfirm()} onClick={handleConfirm} className="primary-btn" style={{ padding: '10px 14px', borderRadius: 8, opacity: canConfirm() ? 1 : 0.7 }}>Add</button>
      </div>
    </Modal>
  );
};

