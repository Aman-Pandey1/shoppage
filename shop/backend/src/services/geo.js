import fetch from 'node-fetch';

// Simple in-memory cache for geocoding results to reduce external calls
const geocodeCache = new Map();

function normalizeAddressToQuery(addr) {
  if (!addr) return '';
  const lines = Array.isArray(addr.streetAddress) ? addr.streetAddress : [addr.streetAddress];
  const parts = [
    ...lines.filter(Boolean).map((s) => String(s).trim()),
    addr.city,
    addr.province,
    addr.postalCode,
    addr.country,
  ].filter(Boolean);
  return parts.join(', ');
}

export async function geocodeAddress(address) {
  const query = normalizeAddressToQuery(address);
  if (!query) return null;
  const key = query.toLowerCase();
  const cached = geocodeCache.get(key);
  if (cached) return cached;
  const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
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
  const point = (lat && lon) ? { lat: Number(lat), lon: Number(lon) } : null;
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

