// leaflet-rotate patches the global `L`, so it must exist before that
// import runs. Imported first in MapShell.jsx for that reason (and kept in
// the 'leaflet' chunk by vite.config.js so the order survives the build).
import L from 'leaflet';

window.L = L;

// leaflet-rotate replaces L.Map.TouchZoom with its own pinch handler, but
// Leaflet has already registered the original one, so both would run on
// every pinch. MapShell disables instances of this original after init.
export const LeafletTouchZoom = L.Map.TouchZoom;
