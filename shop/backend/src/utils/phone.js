export function normalizePhoneForCountry(raw, country) {
	try {
		const cleaned = String(raw || '').replace(/[^\d+]/g, '');
		const c = String(country || 'CA').toUpperCase();
		const ccMap = { CA: '1', US: '1', IN: '91', GB: '44', AU: '61' };
		const usesTrunkZero = new Set(['GB', 'IN', 'AU']);
		const defaultCc = ccMap[c] || '';
		if (!cleaned) return '';
		if (cleaned.startsWith('+')) {
			let withPlus = '+' + cleaned.replace(/\+/g, '');
			if (defaultCc && usesTrunkZero.has(c)) {
				const afterCcIdx = 1 + defaultCc.length;
				if (withPlus.slice(1, afterCcIdx) === defaultCc && withPlus[afterCcIdx] === '0') {
					withPlus = '+' + defaultCc + withPlus.slice(afterCcIdx + 1);
				}
			}
			return /^\+[1-9]\d{7,14}$/.test(withPlus) ? withPlus : '';
		}
		let national = cleaned;
		if (usesTrunkZero.has(c) && national.startsWith('0')) {
			national = national.replace(/^0+/, '');
		}
		if (defaultCc) {
			if (defaultCc === '1') {
				if (/^1\d{10}$/.test(national)) return '+' + national;
				if (/^\d{10}$/.test(national)) return '+1' + national;
			}
			const combined = '+' + defaultCc + national;
			return /^\+[1-9]\d{7,14}$/.test(combined) ? combined : '';
		}
		if (/^[1-9]\d{7,14}$/.test(national)) return '+' + national;
		return '';
	} catch {
		return '';
	}
}
