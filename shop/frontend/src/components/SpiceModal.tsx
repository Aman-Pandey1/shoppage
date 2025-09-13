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
			<div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
				{levels.map((lvl) => {
					const icon = lvl.toLowerCase().includes('hot') ? '🌶️🌶️' : lvl.toLowerCase().includes('medium') ? '🌶️' : '🫑';
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
							<div style={{ fontSize: 22 }}>{icon}</div>
							<div style={{ fontWeight: 700 }}>{lvl}</div>
						</button>
					);
				})}
			</div>
			<div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginTop: 16 }}>
				<button onClick={onCancel} style={{ padding: '12px 16px', borderRadius: 12, border: '1px solid var(--border)', background: 'var(--panel-2)' }}>Cancel</button>
				<button onClick={() => onConfirm(selected)} className="primary-btn" style={{ padding: '12px 16px', borderRadius: 12, minWidth: 140 }}>OK</button>
			</div>
		</Modal>
	);
}