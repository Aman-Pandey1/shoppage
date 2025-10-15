import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Determine candidate JSON files used to persist mock data
// Priority:
// 1) Explicit MOCK_DB_FILE (absolute or relative)
// 2) Shared volume at /data/mockData.json (commonly mounted persistent path)
// 3) Stable path relative to backend (repo path)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function getCandidatePaths() {
  const envPath = process.env.MOCK_DB_FILE ? path.resolve(process.env.MOCK_DB_FILE) : null;
  const sharedPath = path.resolve('/', 'data', 'mockData.json');
  const repoPath = path.resolve(__dirname, '..', '..', 'data', 'mockData.json');
  const readCandidates = [envPath, sharedPath, repoPath].filter(Boolean);
  const writeTarget = envPath || sharedPath || repoPath;
  return { readCandidates, writeTarget };
}

export function loadMockData() {
	try {
		const { readCandidates } = getCandidatePaths();
		for (const candidate of readCandidates) {
			try {
				if (!fs.existsSync(candidate)) continue;
				const text = fs.readFileSync(candidate, 'utf-8');
				const data = JSON.parse(text);
				if (!data || typeof data !== 'object') continue;
				// Basic shape guard
				if (!Array.isArray(data.sites) || !Array.isArray(data.categories) || !Array.isArray(data.products)) {
					continue;
				}
				if (!Array.isArray(data.orders)) data.orders = [];
				if (!Array.isArray(data.users)) data.users = [];
				return data;
			} catch {
				// try next candidate
			}
		}
		return null;
	} catch (_err) {
		return null;
	}
}

export function saveMockData(data) {
	try {
		const { writeTarget } = getCandidatePaths();
		const attempts = [writeTarget];
		// Always include repoPath as a fallback write location to maximize persistence chances
		const repoPath = path.resolve(__dirname, '..', '..', 'data', 'mockData.json');
		if (!attempts.includes(repoPath)) attempts.push(repoPath);
		let wrote = false;
		for (const target of attempts) {
			try {
				const dir = path.dirname(target);
				fs.mkdirSync(dir, { recursive: true });
				fs.writeFileSync(target, JSON.stringify(data, null, 2));
				wrote = true;
				break;
			} catch {}
		}
		if (!wrote) {
			// As a last resort, try current working directory
			try {
				const cwdTarget = path.resolve(process.cwd(), 'data', 'mockData.json');
				fs.mkdirSync(path.dirname(cwdTarget), { recursive: true });
				fs.writeFileSync(cwdTarget, JSON.stringify(data, null, 2));
			} catch {}
		}
	} catch (_err) {
		// Swallow errors to avoid crashing in environments without writable FS
	}
}

