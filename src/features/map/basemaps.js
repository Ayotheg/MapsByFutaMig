// ── Base map style catalogue ───────────────────────────────────────────
// Single source of truth for every tile layer the user can pick between,
// consumed by both `MapShell` (which owns the actual Leaflet tile layer)
// and `LayersPanel` (which renders the "Base Map Style" picker under the
// legend). Kept as plain data — no Leaflet import here — so it's cheap
// to reference from the panel without pulling Leaflet into that module.
//
// `Light` is the original CARTO Voyager tile MapShell already shipped
// (Slice 1); CLAUDE.md flagged that legacy's JS referenced a second
// "Dark" CartoDB DarkMatter style with no matching swatch in the HTML to
// select it. This adds that Dark style for real, plus two further
// options (Satellite, Terrain) so there's an actual choice to make, all
// from tile providers that don't require an API key.

export const BASEMAP_STYLES = [
  {
    id: 'light',
    label: 'Light',
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    url: 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png',
    retina: false,
    subdomains: 'abc',
    maxZoom: 20,
    maxNativeZoom: 19,
  },
  {
    id: 'dark',
    label: 'Dark',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://hot.openstreetmap.org/">HOT</a>',
    url: 'https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png',
    retina: false,
    subdomains: 'abc',
    maxZoom: 20,
    maxNativeZoom: 19,
  },
  {
    id: 'satellite',
    label: 'Satellite',
    attribution:
      'Tiles &copy; <a href="https://www.esri.com/">Esri</a> — Esri, Maxar, Earthstar Geographics',
    url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    // No real @2x asset — reusing the 256px URL at 512px tile size
    // (the `retina: true` trick) would just stretch every tile and
    // blur the whole layer, so this stays a plain 256px source at any
    // pixel density.
    retina: false,
    // Esri's imagery coverage is inconsistent outside major Western
    // cities — campuses like FUTA often run out of native resolution
    // well before zoom 19, which Esri serves as a "no imagery" grey
    // tile rather than the next zoom level down. Capping
    // `maxNativeZoom` below the map's own max zoom (19, set in
    // MapShell) means Leaflet over-zooms (upscales) the last
    // available tile past this point instead of requesting tiles that
    // don't exist — a bit soft at max zoom, but never a blank/"not
    // available" tile.
    maxZoom: 19,
    maxNativeZoom: 15,
  },
  {
    id: 'terrain',
    label: 'Terrain',
    attribution:
      '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors, SRTM &copy; <a href="https://opentopomap.org/">OpenTopoMap</a> (CC-BY-SA)',
    url: 'https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png',
    retina: false,
    subdomains: 'abc',
    // OpenTopoMap's own tile server tops out at native zoom 17 — same
    // over-zoom reasoning as Satellite above: `maxZoom` matches the
    // map's global max (19) so zooming past 17 stretches the last
    // real tile instead of leaving gaps.
    maxZoom: 19,
    maxNativeZoom: 17,
  },
];

export const DEFAULT_BASEMAP_ID = 'light';

export function getBasemapStyle(id) {
  return BASEMAP_STYLES.find((style) => style.id === id) || BASEMAP_STYLES[0];
}
