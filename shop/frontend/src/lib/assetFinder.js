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

/**
 * Find the best-matching asset by checking if the filename contains
 * any of the provided keywords (case-insensitive). Returns the URL or undefined.
 */
export function findAssetByKeywords(keywords) {
  if (!Array.isArray(keywords) || keywords.length === 0) return undefined;
  const lowered = keywords.map((k) => String(k || '').toLowerCase());

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

/**
 * Convenience helpers for common images used in the app.
 */
export function getPickupImage() {
  return (
    findAssetByKeywords(['pickup', 'store', 'shop', 'takeout', 'image1', 'img1']) ||
    undefined
  );
}

export function getDeliveryImage() {
  return (
    findAssetByKeywords(['delivery', 'truck', 'van', 'courier', 'image2', 'img2']) ||
    undefined
  );
}

export function getSpiceBadge(level) {
  const lower = String(level || '').toLowerCase();
  if (lower.includes('extra'))
    return findAssetByKeywords(['extra', 'level4', 'lvl4', '4']);
  if (lower.includes('hot'))
    return findAssetByKeywords(['hot', 'level3', 'lvl3', '3']);
  if (lower.includes('medium') || lower.includes('spicy'))
    return findAssetByKeywords(['spicy', 'medium', 'level2', 'lvl2', '2']);
  // default/mild
  return findAssetByKeywords(['mild', 'level1', 'lvl1', '1']);
}

