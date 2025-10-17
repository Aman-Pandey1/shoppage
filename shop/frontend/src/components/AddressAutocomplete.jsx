import React from 'react';
import { fetchJson } from '../lib/api';

// Lightweight Google Places autocomplete input with dropdown suggestions.
// Loads the Places JS library on demand using the site's public config key.
export const AddressAutocomplete = ({ siteSlug, placeholder = 'Address', value, onChange, onSelect, country = 'CA', biasKm = 30 }) => {
  const [apiReady, setApiReady] = React.useState(false);
  const [input, setInput] = React.useState(value || '');
  const [predictions, setPredictions] = React.useState([]);
  const [open, setOpen] = React.useState(false);
  const svcRef = React.useRef(null);
  const detailsSvcRef = React.useRef(null);
  const geocoderRef = React.useRef(null);
  const sessionTokenRef = React.useRef(null);
  const [biasCenter, setBiasCenter] = React.useState(null); // { lat, lng }
  const containerRef = React.useRef(null);

  React.useEffect(() => { setInput(value || ''); }, [value]);

  // Load Google script once
  React.useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        if (window.google && window.google.maps && window.google.maps.places) {
          if (!cancelled) initServices();
          return;
        }
        const { googleMapsApiKey } = await fetchJson(`/api/shop/${siteSlug}/public-config`);
        const key = googleMapsApiKey || '';
        if (!key) { if (!cancelled) setApiReady(false); return; }
        await injectScriptOnce(`https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(key)}&libraries=places&v=weekly&region=CA&language=en`);
        if (!cancelled) initServices();
      } catch {
        if (!cancelled) setApiReady(false);
      }
    }
    load();
    function initServices() {
      try {
        // eslint-disable-next-line no-undef
        svcRef.current = new google.maps.places.AutocompleteService();
        // eslint-disable-next-line no-undef
        detailsSvcRef.current = new google.maps.places.PlacesService(document.createElement('div'));
        // eslint-disable-next-line no-undef
        geocoderRef.current = new google.maps.Geocoder();
        // eslint-disable-next-line no-undef
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
        setApiReady(true);
      } catch { setApiReady(false); }
    }
    return () => { cancelled = true; };
  }, [siteSlug]);

  // Establish a sensible location bias: prefer user's current location; otherwise bias to pickup/restaurant
  React.useEffect(() => {
    let cancelled = false;
    async function resolveBias() {
      if (!apiReady) return;
      // 1) Try browser geolocation (user vicinity)
      try {
        await new Promise((resolve) => {
          if (!navigator.geolocation) return resolve();
          navigator.geolocation.getCurrentPosition((pos) => {
            if (!pos || !pos.coords) return resolve();
            if (!cancelled) setBiasCenter({ lat: pos.coords.latitude, lng: pos.coords.longitude });
            resolve();
          }, () => resolve(), { enableHighAccuracy: false, maximumAge: 600000, timeout: 1500 });
        });
      } catch {}
      if (cancelled || biasCenter) return;
      // 2) Bias to first pickup/restaurant location
      try {
        const list = await fetchJson(`/api/shop/${siteSlug}/locations`);
        const first = Array.isArray(list) && list.length ? list[0] : null;
        const addr = first?.address;
        if (!addr || !geocoderRef.current) return;
        const line = [
          ...(Array.isArray(addr.streetAddress) ? addr.streetAddress : [addr.streetAddress]).filter(Boolean),
          addr.city,
          addr.province,
          addr.postalCode,
          addr.country,
        ].filter(Boolean).join(', ');
        // eslint-disable-next-line no-undef
        geocoderRef.current.geocode({ address: line }, (results, status) => {
          try {
            // eslint-disable-next-line no-undef
            if (status === google.maps.GeocoderStatus.OK && Array.isArray(results) && results[0]) {
              const loc = results[0].geometry?.location;
              if (loc && !cancelled) setBiasCenter({ lat: loc.lat(), lng: loc.lng() });
            }
          } catch {}
        });
      } catch {}
    }
    resolveBias();
    return () => { cancelled = true; };
  }, [apiReady, siteSlug]);

  React.useEffect(() => {
    function onDocClick(e) {
      if (!containerRef.current) return;
      if (!containerRef.current.contains(e.target)) setOpen(false);
    }
    document.addEventListener('click', onDocClick);
    return () => document.removeEventListener('click', onDocClick);
  }, []);

  // Debounced fetch predictions
  const debouncedFetch = React.useMemo(() => {
    let t = null;
    return (q) => {
      if (!apiReady || !svcRef.current) { setPredictions([]); return; }
      if (t) clearTimeout(t);
      t = setTimeout(() => {
        try {
          const countries = Array.isArray(country) ? country : [country];
          const req = {
            input: q,
            componentRestrictions: { country: countries.map((c) => String(c).toUpperCase()) },
            types: ['address'],
          };
          // Prefer nearby results using a circular bias around the chosen center
          if (biasCenter && window.google && window.google.maps) {
            // eslint-disable-next-line no-undef
            const center = new google.maps.LatLng(biasCenter.lat, biasCenter.lng);
            req.location = center;
            req.origin = center;
            req.radius = Math.max(1000, Math.round((biasKm || 30) * 1000));
            // Newer API supports locationBias; harmless if ignored
            // eslint-disable-next-line no-undef
            req.locationBias = { center, radius: req.radius };
            if (sessionTokenRef.current) req.sessionToken = sessionTokenRef.current;
          }
          svcRef.current.getPlacePredictions(req, (list) => {
            setPredictions(Array.isArray(list) ? list.slice(0, 6) : []);
          });
        } catch { setPredictions([]); }
      }, 120);
    };
  }, [apiReady, country, biasCenter, biasKm]);

  function handleInputChange(e) {
    const val = e.target.value;
    setInput(val);
    onChange && onChange(val);
    if (val && val.length >= 1) { setOpen(true); debouncedFetch(val); } else { setOpen(false); setPredictions([]); }
  }

  function parseAddressComponents(components) {
    const byType = (t) => components.find((c) => (c.types || []).includes(t));
    const streetNumber = byType('street_number')?.long_name || '';
    const route = byType('route')?.long_name || '';
    const city = (byType('locality') || byType('sublocality') || byType('postal_town'))?.long_name || '';
    const province = (byType('administrative_area_level_1')?.short_name) || '';
    const postalCode = byType('postal_code')?.long_name || '';
    const country = byType('country')?.short_name || '';
    const line1 = [streetNumber, route].filter(Boolean).join(' ');
    return {
      streetAddress: [line1].filter(Boolean),
      city,
      province,
      postalCode,
      country,
    };
  }

  function selectPrediction(pred) {
    try {
      if (!detailsSvcRef.current) { finalizeSelection({ formatted: pred.description }); return; }
      // Request geometry and place_id so callers can persist precise coordinates
      detailsSvcRef.current.getDetails({ placeId: pred.place_id, fields: ['formatted_address', 'address_components', 'geometry', 'place_id'] }, (res) => {
        if (!res || res.status === 'ZERO_RESULTS') { finalizeSelection({ formatted: pred.description }); return; }
        const addr = parseAddressComponents(res.address_components || []);
        try {
          const loc = res.geometry && res.geometry.location;
          if (loc) {
            // eslint-disable-next-line no-undef
            const lat = typeof loc.lat === 'function' ? loc.lat() : loc.lat;
            // eslint-disable-next-line no-undef
            const lng = typeof loc.lng === 'function' ? loc.lng() : loc.lng;
            if (typeof lat === 'number' && typeof lng === 'number') {
              addr.lat = lat;
              addr.lon = lng;
            }
          }
          if (res.place_id) addr.placeId = res.place_id;
        } catch {}
        const summary = res.formatted_address || pred.description || '';
        finalizeSelection({ address: addr, summary });
      });
    } catch {
      finalizeSelection({ formatted: pred.description });
    }
  }

  function finalizeSelection({ address, summary, formatted }) {
    const text = summary || formatted || '';
    setInput(text);
    setOpen(false);
    setPredictions([]);
    // Reset the Places session token for the next search session
    try {
      if (window.google && window.google.maps && window.google.maps.places) {
        // eslint-disable-next-line no-undef
        sessionTokenRef.current = new google.maps.places.AutocompleteSessionToken();
      }
    } catch {}
    if (onSelect) {
      const parsed = address || parseSummaryToAddress(text);
      onSelect(parsed, text);
    }
  }

  function parseSummaryToAddress(text) {
    const parts = String(text || '').split(',').map((s) => s.trim());
    const country = parts[parts.length - 1] || '';
    const province = parts.length >= 3 ? parts[parts.length - 2].split(' ')[0] : '';
    const city = parts.length >= 3 ? parts[parts.length - 3] : '';
    const streetAddress = [parts.slice(0, Math.max(1, parts.length - 3)).join(', ')].filter(Boolean);
    return { streetAddress, city, province, postalCode: '', country };
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <input
        value={input}
        onChange={handleInputChange}
        placeholder={placeholder}
        onFocus={() => { if (input) { setOpen(true); debouncedFetch(input); } }}
        aria-autocomplete="list"
        aria-expanded={open ? 'true' : 'false'}
        style={{ width: '100%' }}
      />
      {open && predictions.length > 0 ? (
        <div role="listbox" style={{ position: 'absolute', zIndex: 20, left: 0, right: 0, top: '100%', background: '#fff', border: '1px solid var(--border)', borderRadius: 8, marginTop: 4, maxHeight: 240, overflow: 'auto' }}>
          {predictions.map((p) => (
            <button
              type="button"
              key={p.place_id}
              role="option"
              onClick={() => selectPrediction(p)}
              style={{ display: 'flex', width: '100%', textAlign: 'left', padding: '8px 10px', border: 'none', background: 'transparent', cursor: 'pointer' }}
            >
              <span style={{ marginRight: 8 }}>📍</span>
              <span>{p.description}</span>
            </button>
          ))}
          <div style={{ fontSize: 10, color: '#6b7280', padding: '6px 10px', borderTop: '1px solid var(--border)', textAlign: 'right' }}>powered by Google</div>
        </div>
      ) : null}
    </div>
  );
};

// Ensure we only add the Google script once across the app.
const pendingLoads = new Map();
function injectScriptOnce(src) {
  if (pendingLoads.has(src)) return pendingLoads.get(src);
  const existing = Array.from(document.querySelectorAll('script')).find((s) => (s.src || '').includes('maps.googleapis.com/maps/api/js'));
  if (existing) {
    const hasPlaces = (existing.src || '').includes('libraries=places');
    if (hasPlaces) {
      if (window.google && window.google.maps && window.google.maps.places) return Promise.resolve();
      return new Promise((resolve, reject) => {
        existing.addEventListener('load', () => resolve());
        existing.addEventListener('error', (e) => reject(e));
      });
    }
    // If an existing script lacks Places, proceed to inject a new one that includes it
  }
  const p = new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.async = true;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = (e) => reject(e);
    document.head.appendChild(s);
  });
  pendingLoads.set(src, p);
  return p;
}
