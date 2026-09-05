import { CAMPUS_BOUNDS } from '../../lib/campusBounds';

/**
 * Shared Nominatim (OpenStreetMap) geocoding helper.
 *
 * Legacy duplicates this exact fetch 4 times near-verbatim — once each in
 * the sidebar's `handleSearchInput`/`doSearch` (app.js ~781–889, dead code,
 * see DesktopSearchBar.jsx's header comment), the desktop floating bar's
 * `deskHandleInput`/`deskDoSearch` (~999–1111), the mobile full-screen
 * overlay (~5901–5936), and `bindRouteInput` (~1166–1186, also dead — see
 * same note). Since none of those are copy-pasted vanilla-JS IIFEs here,
 * this is a single shared pure function instead — same fetch, same query
 * shape, same result mapping, called from DesktopSearchBar.jsx and
 * MobileSearchOverlay.jsx.
 *
 * Result shape matches a `useSearchIndex` entry: { lat, lng, name, desc,
 * type: 'osm', subtype: 'osm', source: 'osm' }.
 */
export async function fetchNominatim(query, { limit = 4 } = {}) {
  const vb = `${CAMPUS_BOUNDS.getWest()},${CAMPUS_BOUNDS.getSouth()},${CAMPUS_BOUNDS.getEast()},${CAMPUS_BOUNDS.getNorth()}`;
  const url =
    `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query + ' FUTA Akure Nigeria')}` +
    `&viewbox=${vb}&bounded=0&limit=${limit}`;

  const res = await fetch(url, { headers: { 'Accept-Language': 'en' } });
  const data = await res.json();

  return (data || []).map((d) => ({
    lat: parseFloat(d.lat),
    lng: parseFloat(d.lon),
    name: d.display_name.split(',')[0].trim(),
    desc: d.display_name.split(',').slice(1, 3).join(',').trim(),
    type: 'osm',
    subtype: 'osm',
    source: 'osm',
  }));
}

/**
 * Reverse-geocode a lat/lng via the same Nominatim (OSM) service
 * `fetchNominatim` above already talks to — no new API, no key. Used by
 * the "Find my location" speech announcement (see
 * `features/navigation/announceLocation.js`) to turn a raw GPS fix into
 * a road name + surrounding town/state, for students traveling in from
 * other states who need "which expressway/town am I on" more than a
 * coordinate pair.
 *
 * `zoom: 17` asks Nominatim for street-level detail (vs. the default
 * ~city-level) so `address.road` is populated whenever OSM has the
 * road/highway tagged, which is the specific detail the announcement
 * leads with.
 *
 * Returns `null` (not a throw) on a malformed/error response so the
 * caller's fallback logic doesn't need its own try/catch just to read
 * `.address` — same "never block on geolocation" posture as
 * `useOneShotLocation.js`/`chipConfig.js`.
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
