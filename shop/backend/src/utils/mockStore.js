import fs from 'fs';
import path from 'path';

// Determines the JSON file used to persist mock data
const DEFAULT_FILE = process.env.MOCK_DB_FILE
	? path.resolve(process.env.MOCK_DB_FILE)
	: path.resolve(process.cwd(), 'data', 'mockData.json');

export function loadMockData() {
	try {
		const file = DEFAULT_FILE;
		if (!fs.existsSync(file)) return null;
		const text = fs.readFileSync(file, 'utf-8');
		const data = JSON.parse(text);
		if (!data || typeof data !== 'object') return null;
		// Basic shape guard
		if (!Array.isArray(data.sites) || !Array.isArray(data.categories) || !Array.isArray(data.products)) {
			return null;
		}
		if (!Array.isArray(data.orders)) data.orders = [];
		if (!Array.isArray(data.users)) data.users = [];
		return data;
	} catch (_err) {
		return null;
	}
}

export function saveMockData(data) {
	try {
		const file = DEFAULT_FILE;
		const dir = path.dirname(file);
		fs.mkdirSync(dir, { recursive: true });
		fs.writeFileSync(file, JSON.stringify(data, null, 2));
	} catch (_err) {
		// Swallow errors to avoid crashing in environments without writable FS
	}
}

