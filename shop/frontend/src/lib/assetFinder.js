// Small helper to locate images in src/assets by filename keywords.
// Works with Vite via import.meta.glob and returns the asset URL or undefined.

// Eagerly import all image assets so we can synchronously search them
// Supported formats can be extended if needed.
const allAssetModules = import.meta.glob(
  '../assets/**/*.{png,jpg,jpeg,svg,webp,gif}',
  { eager: true, as: 'url' }
);

// Build a normalized list we can search repeatedly without extra work
const allAssets = Object.entries(allAssetModules).map(([path, url]) => ({
  path,
  url,
  filename: path.split('/').pop()?.toLowerCase() || '',
}));

// Direct name map for exact lookups (improves matching when user renames files exactly)
const filenameToUrl = (() => {
  const map = new Map();
  for (const asset of allAssets) {
    map.set(asset.filename, asset.url);
  }
  return map;
})();

/**
 * Find the best-matching asset by checking if the filename contains
 * any of the provided keywords (case-insensitive). Returns the URL or undefined.
 */
export function findAssetByKeywords(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return undefined;
  const lowered = keywords.map((k) => String(k || '').toLowerCase());

  // 1) Prefer exact filename matches for common names
  //    Accept both with and without extension, and allow spaces/underscores/hyphens
  const preferredNames = new Set();
  for (const key of lowered) {
    if (!key) continue;
    const normalized = key.replace(/\s+/g, ' ').trim();
    const variants = [
      normalized,
      normalized.replace(/\s+/g, '_'),
      normalized.replace(/\s+/g, '-'),
      normalized.replace(/-/g, ' '),
      normalized.replace(/_/g, ' '),
    ];
    for (const base of variants) {
      for (const ext of ['.png', '.jpg', '.jpeg', '.svg', '.webp', '.gif']) {
        preferredNames.add(`${base}${ext}`);
      }
    }
  }
  for (const name of preferredNames) {
    const hit = filenameToUrl.get(name);
    if (hit) return hit;
  }

  // Score assets: number of matched keywords, break ties by longer filename match
  let best = undefined;
  let bestScore = 0;
  for (const asset of allAssets) {
    let score = 0;
    for (const key of lowered) {
      if (!key) continue;
      if (asset.filename.includes(key)) score += 1;
    }
    if (score > bestScore) {
      best = asset;
      bestScore = score;
    }
  }
  return best?.url;
}

// --- Fuzzy helpers for robust spice detection ---
function levenshtein(a, b) {
  const s = String(a || '');
  const t = String(b || '');
  const m = s.length;
  const n = t.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp = new Array(n + 1);
  for (let j = 0; j <= n; j++) dp[j] = j;
  for (let i = 1; i <= m; i++) {
    let prev = i - 1;
    dp[0] = i;
    for (let j = 1; j <= n; j++) {
      const temp = dp[j];
      const cost = s[i - 1] === t[j - 1] ? 0 : 1;
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + cost
      );
      prev = temp;
    }
  }
  return dp[n];
}

function isFuzzyEqual(input, target, maxDistance = 1) {
  const a = String(input || '').toLowerCase();
  const b = String(target || '').toLowerCase();
  return levenshtein(a, b) <= maxDistance;
}

function containsFuzzyToken(input, candidates, maxDistance = 1) {
  const normalized = String(input || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ');
  const tokens = normalized.split(' ').filter(Boolean);
  for (const tok of tokens) {
    for (const cand of candidates) {
      if (isFuzzyEqual(tok, cand, maxDistance)) return true;
    }
  }
  return false;
}

export function normalizeSpiceLevel(level) {
  const raw = String(level || '').toLowerCase();
  const digits = raw.match(/[0-9]/g) || [];
  const normalized = raw.replace(/[^a-z0-9]+/g, ' ');
  const hasExtra = containsFuzzyToken(normalized, ['extra', 'xtra', 'x-hot', 'xhot', 'very'], 2) || /x-?hot|xtra/i.test(raw);
  const isHot = containsFuzzyToken(normalized, ['hot', 'spicy'], 1) || /🔥|🌶️/.test(raw);
  const isMedium = containsFuzzyToken(normalized, ['medium', 'med', 'moderate'], 2);
  const isMild = containsFuzzyToken(normalized, ['mild', 'low', 'none', 'no'], 1);

  if (digits.includes('4')) return 'extra-hot';
  if (digits.includes('3')) return 'hot';
  if (digits.includes('2')) return 'medium';
  if (digits.includes('1')) return 'mild';

  if (hasExtra && isHot) return 'extra-hot';
  if (isHot) return 'hot';
  if (isMedium) return 'medium';
  if (isMild) return 'mild';
  // Default to mild if unclear
  return 'mild';
}

/**
 * Convenience helpers for common images used in the app.
 */
export function getPickupImage() {
  return (
    // Try exact names first
    filenameToUrl.get('pickup.png') || filenameToUrl.get('pickup.svg') ||
    findAssetByKeywords(['pickup', 'pick-up', 'counter', 'store', 'shop', 'takeout', 'carryout', 'collection', 'takeaway', 'take-away']) ||
    undefined
  );
}

export function getDeliveryImage() {
  return (
    filenameToUrl.get('delivery.png') || filenameToUrl.get('delivery.svg') ||
    findAssetByKeywords(['delivery', 'deliver', 'courier', 'rider', 'driver', 'bike', 'scooter', 'truck', 'van']) ||
    undefined
  );
}

export function getSpiceBadge(level) {
  const canonical = normalizeSpiceLevel(level);
  if (canonical === 'extra-hot')
    return (
      filenameToUrl.get('extra hot.png') || filenameToUrl.get('extra-hot.png') || filenameToUrl.get('extra_hot.png') ||
      findAssetByKeywords(['extra-hot', 'extra hot', 'extra_hot', 'xhot', 'x-hot', 'very-hot', 'veryhot', 'extra', 'level4', 'lvl4', '4', 'spice'])
    );
  if (canonical === 'hot')
    return (
      filenameToUrl.get('hot.png') ||
      findAssetByKeywords(['hot', 'spicy', 'level3', 'lvl3', '3', 'spice'])
    );
  if (canonical === 'medium')
    return (
      filenameToUrl.get('medium.png') ||
      findAssetByKeywords(['medium', 'moderate', 'level2', 'lvl2', '2', 'spice'])
    );
  // default/mild
  return (
    filenameToUrl.get('mild.png') ||
    findAssetByKeywords(['mild', 'low', 'level1', 'lvl1', '1', 'spice'])
  );
}

