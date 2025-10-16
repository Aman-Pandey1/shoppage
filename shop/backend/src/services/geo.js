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
  async function geocodeViaNominatim(q) {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=1`;
    const userAgent = process.env.NOMINATIM_USER_AGENT || process.env.GEOCODE_USER_AGENT || 'BlueboxxShop/1.0 (+https://blueboxx.co/contact)';
    const res = await fetch(url, {
      headers: {
        // Identify the application per Nominatim usage policy
        'User-Agent': userAgent,
      }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) return null;
    const { lat, lon } = data[0] || {};
    return (lat && lon) ? { lat: Number(lat), lon: Number(lon) } : null;
  }
  async function geocodeViaGoogle(q) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;
    try {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(q)}&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const loc = data?.results?.[0]?.geometry?.location;
      if (loc && typeof loc.lat === 'number' && typeof loc.lng === 'number') {
        return { lat: Number(loc.lat), lon: Number(loc.lng) };
      }
      return null;
    } catch {
      return null;
    }
  }
  // Try full query first
  let point = await geocodeViaGoogle(query);
  if (!point) point = await geocodeViaNominatim(query);
  // Fallback: city + postal + country
  if (!point) {
    const city = (address.city || '').trim();
    const postal = (address.postalCode || '').trim();
    const country = (address.country || '').trim();
    const fallbackParts = [city, postal, country].filter(Boolean);
    if (fallbackParts.length) {
      point = await geocodeViaGoogle(fallbackParts.join(', '));
      if (!point) point = await geocodeViaNominatim(fallbackParts.join(', '));
    }
  }
  // Fallback 2: city + province + country
  if (!point) {
    const city = (address.city || '').trim();
    const province = (address.province || '').trim();
    const country = (address.country || '').trim();
    const fallbackParts = [city, province, country].filter(Boolean);
    if (fallbackParts.length) {
      point = await geocodeViaGoogle(fallbackParts.join(', '));
      if (!point) point = await geocodeViaNominatim(fallbackParts.join(', '));
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
  const [pickupPoint, dropoffPoint] = await Promise.all([
    geocodeAddress(pickupAddress),
    geocodeAddress(dropoffAddress),
  ]);

  const isValidPoint = (pt) => !!pt && typeof pt.lat === 'number' && typeof pt.lon === 'number' && isFinite(pt.lat) && isFinite(pt.lon);
  if (!isValidPoint(pickupPoint) || !isValidPoint(dropoffPoint)) return null;

  async function roadDistanceKmViaOsrm(a, b) {
    try {
      const userAgent = process.env.NOMINATIM_USER_AGENT || process.env.GEOCODE_USER_AGENT || 'BlueboxxShop/1.0 (+https://blueboxx.co/contact)';
      const url = `https://router.project-osrm.org/route/v1/driving/${a.lon},${a.lat};${b.lon},${b.lat}?overview=false&alternatives=false&steps=false`;
      const res = await fetch(url, { headers: { 'User-Agent': userAgent } });
      if (!res.ok) return null;
      const data = await res.json();
      const meters = data?.routes?.[0]?.distance;
      return (typeof meters === 'number' && isFinite(meters)) ? (meters / 1000) : null;
    } catch {
      return null;
    }
  }

  async function roadDistanceKmViaGoogle(a, b) {
    const apiKey = process.env.GOOGLE_MAPS_API_KEY;
    if (!apiKey) return null;
    try {
      const origins = `${a.lat},${a.lon}`;
      const destinations = `${b.lat},${b.lon}`;
      const url = `https://maps.googleapis.com/maps/api/distancematrix/json?units=metric&mode=driving&origins=${encodeURIComponent(origins)}&destinations=${encodeURIComponent(destinations)}&key=${encodeURIComponent(apiKey)}`;
      const res = await fetch(url);
      if (!res.ok) return null;
      const data = await res.json();
      const meters = data?.rows?.[0]?.elements?.[0]?.distance?.value;
      return (typeof meters === 'number' && isFinite(meters)) ? (meters / 1000) : null;
    } catch {
      return null;
    }
  }

  // Prefer by-road driving distance; fall back to straight-line if needed
  const byRoadOsrm = await roadDistanceKmViaOsrm(pickupPoint, dropoffPoint);
  if (typeof byRoadOsrm === 'number') return byRoadOsrm;

  const byRoadGoogle = await roadDistanceKmViaGoogle(pickupPoint, dropoffPoint);
  if (typeof byRoadGoogle === 'number') return byRoadGoogle;

  return haversineDistanceKm(pickupPoint, dropoffPoint);
}

export function calculateDistanceFeeCents(distanceKm, _ignored = 800) {
  // New pricing rule:
  // - Flat $8 for distances up to and including 8 km
  // - Then $1 per additional km beyond 8 km
  // - Distance is rounded up to the next whole kilometer
  // Notes:
  // - We intentionally ignore the previous per-km configuration parameter.
  // - If distance cannot be determined, default to the flat $8.
  const BASE_FLAT_CENTS = 800; // $8 up to 8 km
  const EXTRA_PER_KM_CENTS = 100; // $1 per km beyond 8 km

  if (typeof distanceKm !== 'number' || !isFinite(distanceKm) || distanceKm <= 0) {
    return BASE_FLAT_CENTS;
  }
  const roundedKm = Math.max(1, Math.ceil(distanceKm));
  if (roundedKm <= 8) return BASE_FLAT_CENTS;
  return BASE_FLAT_CENTS + (roundedKm - 8) * EXTRA_PER_KM_CENTS;
}

