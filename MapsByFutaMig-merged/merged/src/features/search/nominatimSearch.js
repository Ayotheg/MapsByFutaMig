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
