// leaflet-rotate patches the global `L`, so it must exist before that
// import runs. Imported first in MapShell.jsx for that reason.
import L from 'leaflet';

window.L = L;
