import L from 'leaflet';
import { wpColor } from './wpTypeMeta';

// ── Google Maps-style teardrop-free pin: coloured dot + inline label ────────
// Ported from legacy app.js `_buildGmStyleIcon` (lines ~2532–2544).
//
// IMPORTANT: this HTML string is injected by Leaflet via L.divIcon, not
// rendered by React — so its classes (`gm-pin-wrap`, `gm-pin-dot`,
// `gm-pin-label`) MUST be plain global CSS, not CSS Modules. CSS Modules
// hash class names at build time; a hashed name would never match this
// raw string. See waypointMarkers.css (a plain .css file, not .module.css)
// and its zoom-tier rules, which target these same global class names.
//
// Zoom-tier visuals (dot-only vs dot+label) are driven entirely by the
// `.zoom-far/.zoom-mid/.zoom-near/.zoom-close` classes MapShell already
// stamps onto the map container — no per-marker JS needed for that part.
function buildGmStyleIcon(name, type) {
  const color = wpColor(type);
  const label = name || '';

  const html = `
    <div class="gm-pin-wrap" style="--pin-color:${color}">
      <div class="gm-pin-dot"></div>
      <span class="gm-pin-label"></span>
    </div>`;

  const icon = L.divIcon({
    className: '',
    html,
    iconSize: null,
    iconAnchor: [7, 7],
    popupAnchor: [0, -7],
  });

  // Label text is set via textContent after creation rather than interpolated
  // into the HTML string above, to avoid any waypoint name (user-editable via
  // the admin panel in a later slice) being interpreted as HTML.
  icon._labelText = label;
  return icon;
}

/**
 * Builds a Leaflet marker for a single waypoint. Mirrors legacy
 * `buildWaypointMarker(lat, lng, name, type)` — same signature, same
 * zIndexOffset, same anchor.
 */
export function buildWaypointMarker(lat, lng, name, type) {
  const icon = buildGmStyleIcon(name, type);
  const marker = L.marker([lat, lng], {
    icon,
    zIndexOffset: 100,
  });
  marker._wpName = name;
  marker._wpType = type;

  // Fill in the label text once Leaflet has actually created the DOM node
  // (divIcon HTML isn't in the document until the marker is added to the map).
  marker.on('add', () => {
    const el = marker.getElement();
    const labelEl = el?.querySelector('.gm-pin-label');
    if (labelEl) labelEl.textContent = icon._labelText;
  });

  return marker;
}
