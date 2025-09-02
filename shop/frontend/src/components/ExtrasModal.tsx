import React, { useMemo, useState } from 'react';
import { Modal } from './Modal';
import type { ExtraOptionGroup, SelectedOption } from '../types';

function groupKey(groupIndex: number) {
  return `g_${groupIndex}`;
}

export const ExtrasModal: React.FC<{
  open: boolean;
  groups?: ExtraOptionGroup[];
  onCancel: () => void;
  onConfirm: (selected: SelectedOption[]) => void;
}> = ({ open, groups = [], onCancel, onConfirm }) => {
  const [selected, setSelected] = useState<Record<string, Set<string>>>({});

  const constraints = useMemo(() => {
    const result: Record<string, { min: number; max: number }> = {};
    groups.forEach((g, idx) => {
      result[groupKey(idx)] = {
        min: g.minSelect ?? 0,
        max: g.maxSelect ?? g.options.length,
      };
    });
    return result;
  }, [groups]);

  function toggle(groupIdx: number, optionKey: string) {
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

  function canConfirm(): boolean {
    return groups.every((g, idx) => {
      const gk = groupKey(idx);
      const set = selected[gk] || new Set<string>();
      const { min } = constraints[gk] || { min: 0, max: Infinity };
      return set.size >= min;
    });
  }

  function handleConfirm() {
    const list: SelectedOption[] = [];
    groups.forEach((g, idx) => {
      const gk = groupKey(idx);
      const set = selected[gk] || new Set<string>();
      g.options.forEach((opt) => {
        if (set.has(opt.key)) list.push({ groupKey: g.groupKey, optionKey: opt.key, priceDelta: opt.priceDelta });
      });
    });
    onConfirm(list);
  }

  return (
    <Modal open={open} onClose={onCancel} title="Choose extras">
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {groups.map((group, gIdx) => {
          const gk = groupKey(gIdx);
          const set = selected[gk] || new Set<string>();
          const min = group.minSelect ?? 0;
          const max = group.maxSelect ?? group.options.length;
          return (
            <div key={group.groupKey} style={{ border: '1px solid #eee', borderRadius: 8, padding: 12 }}>
              <div style={{ fontWeight: 600, marginBottom: 8 }}>
                {group.groupLabel} {min > 0 ? `(choose at least ${min})` : ''} {max > 0 ? `(up to ${max})` : ''}
              </div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 10 }}>
                {group.options.map((opt) => {
                  const active = set.has(opt.key);
                  return (
                    <button
                      key={opt.key}
                      onClick={() => toggle(gIdx, opt.key)}
                      style={{
                        padding: '8px 10px',
                        borderRadius: 6,
                        border: active ? '2px solid #0ea5e9' : '1px solid #ddd',
                        background: active ? '#e0f2fe' : '#fff',
                        cursor: 'pointer',
                      }}
                    >
                      {opt.label}{opt.priceDelta ? ` (+$${opt.priceDelta.toFixed(2)})` : ''}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, marginTop: 16 }}>
        <button onClick={onCancel} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #ddd' }}>Cancel</button>
        <button disabled={!canConfirm()} onClick={handleConfirm} style={{ padding: '10px 14px', borderRadius: 6, border: '1px solid #0ea5e9', background: canConfirm() ? '#0ea5e9' : '#93c5fd', color: '#fff' }}>Add</button>
      </div>
    </Modal>
  );
};