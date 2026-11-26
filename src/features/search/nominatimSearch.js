// Viewbox covering FUTA campus and Akure metro in Nominatim's left,top,right,bottom order.
const AKURE_VIEWBOX = '5.05,7.38,5.30,7.18';
const MAX_CACHE_ENTRIES = 60;
const nominatimCache = new Map();

function mapNominatimResults(data) {
  return (data || [])
    .map((d) => {
      const parts = String(d.display_name || '').split(',');
      return {
        lat: parseFloat(d.lat),
        lng: parseFloat(d.lon),
        name: (parts[0] || '').trim(),
        desc: parts.slice(1, 3).join(',').trim(),
        type: 'osm',
        subtype: 'osm',
        source: 'osm',
      };
    })
    .filter((r) => Number.isFinite(r.lat) && Number.isFinite(r.lng) && r.name);
}

async function runNominatimQuery(qStr, { limit, bounded, signal }) {
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(qStr)}` +
    `&viewbox=${AKURE_VIEWBOX}&bounded=${bounded ? 1 : 0}&countrycodes=ng&limit=${limit}`;

  const res = await fetch(url, { headers: { 'Accept-Language': 'en' }, signal });
  if (!res.ok) throw new Error(`Nominatim responded ${res.status}`);
  const data = await res.json();
  return mapNominatimResults(data);
}

/**
 * Shared Nominatim (OpenStreetMap) geocoding helper with session caching,
 * request cancellation (`signal`), and Akure-first regional bounding.
 */
export async function fetchNominatim(query, { limit = 4, signal } = {}) {
  const q = String(query || '').trim();
  if (!q) return [];

  const cacheKey = `${q.toLowerCase()}|${limit}`;
  if (nominatimCache.has(cacheKey)) {
    const cached = nominatimCache.get(cacheKey);
    nominatimCache.delete(cacheKey);
    nominatimCache.set(cacheKey, cached);
    return cached.slice();
  }

  const hasRegionHint = /\b(futa|akure|ondo|nigeria)\b/i.test(q);
  let results;
  if (hasRegionHint) {
    results = await runNominatimQuery(q, { limit, bounded: false, signal });
  } else {
    results = await runNominatimQuery(q, { limit, bounded: true, signal });
    if (results.length === 0) {
      results = await runNominatimQuery(`${q} Akure`, { limit, bounded: false, signal });
    }
  }

  if (nominatimCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = nominatimCache.keys().next().value;
    if (oldestKey !== undefined) nominatimCache.delete(oldestKey);
  }
  nominatimCache.set(cacheKey, results);
  return results.slice();
}

/**
 * Reverse-geocode a lat/lng via the same Nominatim (OSM) service
 * `fetchNominatim` above already talks to — no new API, no key. Used by
 * the "Find my location" speech announcement (see
 * `features/navigation/announceLocation.js`) to turn a raw GPS fix into
 * a road name + surrounding town/state, for students traveling in from
 * other states who need "which expressway/town am I on" more than a
 * coordinate pair.
 */
export async function reverseGeocode(lat, lng) {
  const url =
    `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}` +
    `&zoom=17&addressdetails=1`;

  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();
  if (!data || data.error) return null;

  return {
    displayName: data.display_name || '',
    address: data.address || {},
  };
}
