import fetch from 'node-fetch';

// Simple in-memory cache for geocoding results to reduce external calls
const geocodeCache = new Map();

function normalizeAddressToQuery(addr) {
  if (!addr) return '';
  const streetLines = Array.isArray(addr.streetAddress) ? addr.streetAddress : [addr.streetAddress];
  const clean = (s) => (s == null ? '' : String(s).trim());
  const street = streetLines.filter(Boolean).map(clean).join(' ');
  // Some data mixes province/postal. Split if province contains a postal code
  let province = clean(addr.province);
  let postal = clean(addr.postalCode);
  const provinceHasPostal = /\b\d[\w\s-]*\d\b/.test(province) && !postal;
  if (provinceHasPostal) {
    // Attempt to extract last token as postal code (e.g., "BC V6Z 2H7")
    const tokens = province.split(/\s+/);
    if (tokens.length >= 2) {
      postal = tokens.slice(1).join(' ');
      province = tokens[0];
    }
  }
  const parts = [street, clean(addr.city), province, postal, clean(addr.country)].filter(Boolean);
  return parts.join(', ');
}

export async function geocodeAddress(address) {
  const query = normalizeAddressToQuery(address);
  if (!query) return null;
  const key = query.toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached) return cached;
  async function fetchOnce(q) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
    const res = await fetch(url, {
    headers: {
      // Identify the application per Nominatim usage policy
      'User-Agent': 'ShopApp/1.0 (+https://example.invalid/contact)'
    }
  });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const { lat, lon } = data[0] || {};
    return (lat && lon) ? { lat: Number(lat), lon: Number(lon) } : null;
  }
  // Try full query first
  let point = await fetchOnce(query);
  // Fallback: city + postal + country
  if (!point) {
    const city = (address.city || '').trim();
    const postal = (address.postalCode || '').trim();
    const country = (address.country || '').trim();
    const fallbackParts = [city, postal, country].filter(Boolean);
    if (fallbackParts.length) {
      point = await fetchOnce(fallbackParts.join(', '));
    }
  }
  // Fallback 2: city + province + country
  if (!point) {
    const city = (address.city || '').trim();
    const province = (address.province || '').trim();
    const country = (address.country || '').trim();
    const fallbackParts = [city, province, country].filter(Boolean);
    if (fallbackParts.length) {
      point = await fetchOnce(fallbackParts.join(', '));
    }
  }
  if (point) geocodeCache.set(key, point);
  return point;
}

export function haversineDistanceKm(a, b) {
  if (!a || !b || typeof a.lat !== 'number' || typeof a.lon !== 'number' || typeof b.lat !== 'number' || typeof b.lon !== 'number') return null;
  const R = 6371; // km
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(b.lat - a.lat);
  const dLon = toRad(b.lon - a.lon);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const sinDLat = Math.sin(dLat / 2);
  const sinDLon = Math.sin(dLon / 2);
  const h = sinDLat * sinDLat + Math.cos(lat1) * Math.cos(lat2) * sinDLon * sinDLon;
  const c = 2 * Math.atan2(Math.sqrt(h), Math.sqrt(1 - h));
  return R * c;
}

export async function distanceBetweenAddressesKm(pickupAddress, dropoffAddress) {
  const [p, d] = await Promise.all([
    geocodeAddress(pickupAddress),
    geocodeAddress(dropoffAddress),
  ]);
  return haversineDistanceKm(p, d);
}

export function calculateDistanceFeeCents(distanceKm) {
  if (typeof distanceKm !== 'number' || !isFinite(distanceKm) || distanceKm <= 0) {
    // Fallback to base fee when distance cannot be calculated
    return 800;
  }
  const roundedKm = Math.ceil(distanceKm);
  if (roundedKm <= 8) return 800;
  const extra = roundedKm - 8;
  return 800 + (extra * 100);
}

