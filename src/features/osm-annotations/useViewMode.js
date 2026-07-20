import { useCallback, useEffect, useState } from 'react';

/**
 * INFO / RAW map view-mode toggle. Ported from legacy's `_infoMode` +
 * `applyViewMode` (app.js ~3249–3294). Default is INFO mode, matching
 * legacy's `let _infoMode = true`.
 *
 * Deviation, flagged: legacy hides markers entirely in RAW mode, via (a) a
 * CSS kill-switch (`body.raw-mode .gm-pin-wrap { display:none }`) and (b) an
 * imperative batched `map.removeLayer()` pass over `window._waypointLayers`
 * (a single array legacy pushes ALL waypoint/KML/OSM markers into). This
 * port originally used (a) only, verbatim. In practice that hid every real
 * (named) marker — waypoints, OSM POIs, named KML points — leaving the map
 * looking empty rather than "raw," since almost none of this app's actual
 * content falls into legacy's narrow "unnamed GPS dot" category. Changed at
 * the person's explicit direction: the CSS rule now hides only each pin's
 * inline `.gm-pin-label`, keeping `.gm-pin-dot` (and its click target)
 * visible — RAW mode declutters text, it doesn't blank the map. See
 * waypointMarkers.css for the actual rule.
 */
export function useViewMode() {
  const [viewMode, setViewMode] = useState('info'); // 'info' | 'raw'

  useEffect(() => {
    document.body.classList.toggle('raw-mode', viewMode === 'raw');
    return () => document.body.classList.remove('raw-mode');
  }, [viewMode]);

  const toggle = useCallback(() => {
    setViewMode((m) => (m === 'info' ? 'raw' : 'info'));
  }, []);

  // Direct setter — Slice 9's navigation feature needs to force RAW mode
  // when navigation starts and restore whatever mode was active before,
  // matching legacy's `window._prevInfoMode = _infoMode; _infoMode = false;`
  // / restore-on-stop (app.js ~5059–5061, ~5160–5161). `toggle()` alone
  // can't express "set to a specific mode."
  return { viewMode, toggle, setViewMode };
}