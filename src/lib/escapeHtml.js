// ── HTML escaping ─────────────────────────────────────────────────────────
// Anything that ends up inside an HTML *string* (Leaflet popups/divIcons,
// `dangerouslySetInnerHTML`) must go through this first if any part of it
// can come from outside the codebase: waypoint/segment names and
// categories (student submissions, KML imports, OSM data), Nominatim's
// `display_name`, etc. Otherwise a name like `<img src=x onerror=…>` runs
// script in every visitor's browser — which can read their Supabase
// session out of localStorage.
//
// React text nodes (`{value}` in JSX) are already escaped by React and
// don't need this; it's only for the string-to-HTML paths.
const ESCAPES = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

export function escapeHtml(value) {
  return String(value ?? '').replace(/[&<>"']/g, (ch) => ESCAPES[ch]);
}
