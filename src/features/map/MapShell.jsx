import { useEffect, useRef, useState } from 'react';
import { RefreshCw, TriangleAlert, X } from 'lucide-react';
import L from 'leaflet';
import styles from './MapShell.module.css';

// ── Ported 1:1 from legacy app.js lines ~55–98 (feature/login2) ──────────
// Leaflet map init, OSM tile layer, zoom-state class toggling, and
// interaction start/end handling. No other legacy feature (markers,
// panels, search, etc.) is wired in here — those are separate slices.

import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import { BASEMAP_STYLES, DEFAULT_BASEMAP_ID, getBasemapStyle } from './basemaps';
import { watchTileLayer } from './tileHealth';

const CAMPUS_CENTER = [7.2980, 5.1380];

const IS_SAFARI_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const IS_RETINA = window.devicePixelRatio > 1;

/**
 * MapShell — owns the Leaflet map instance imperatively via useRef.
 * Deliberately not react-leaflet, per CLAUDE.md, to preserve the
 * existing canvas-marker performance approach used by later slices.
 *
 * onMapReady(map) fires once after init so sibling/child features
 * (waypoints, legend, search, etc. — later slices) can attach to the
 * same instance without reaching for window globals.
 */
export default function MapShell({ onMapReady, initialView, onViewChange }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const onViewChangeRef = useRef(onViewChange);
  onViewChangeRef.current = onViewChange;
  // Shown when the tile layer is clearly not loading (see tileHealth.js) —
  // asks the person to refresh. Stays until dismissed, refreshed, or (if it
  // was only a slow network) tiles start arriving.
  const [tileAlert, setTileAlert] = useState(false);

  useEffect(() => {
    if (mapRef.current) return; // guard against StrictMode double-invoke

    const map = L.map(containerRef.current, {
      center: initialView?.center || CAMPUS_CENTER,
      zoom: initialView?.zoom || 16,
      // Deliberately NOT constrained to CAMPUS_BOUNDS here. The campus
      // rectangle drawn below (`campusBoundaryRect`) stays exactly the
      // same size/position as before — it's still shown as a reference
      // overlay and still used everywhere else in the app (search bias,
      // KML/waypoint validation, OSM annotation filtering — see
      // `lib/campusBounds.js`). What's removed is *only* the hard drag/
      // pan restriction, so students traveling in from other states can
      // pan/zoom out to natural, real-world map context (their state,
      // route into town, etc.) instead of being clamped to the campus
      // box the moment they leave it.
      minZoom: 5,
      maxZoom: 19,

      preferCanvas: true,

      zoomAnimation: !IS_SAFARI_IOS,
      markerZoomAnimation: !IS_SAFARI_IOS,
    });
    mapRef.current = map;

    // ── Hide +/- zoom buttons on mobile (pinch-to-zoom is the native gesture)
    if (window.innerWidth <= 768) map.zoomControl.remove();

    // Tile retry + "map isn't loading" alert — see tileHealth.js.
    const tileDisposers = new Set();
    const watchTiles = (layer) => {
      const dispose = watchTileLayer(layer, {
        onProblem: () => setTileAlert(true),
        onRecovered: () => setTileAlert(false),
      });
      tileDisposers.add(dispose);
      layer.once('remove', () => tileDisposers.delete(dispose));
    };

    // ── Base tile: built from the style catalogue in `basemaps.js` so the
    // Layers panel (features/legend/LayersPanel.jsx) can switch between
    // Light/Dark/Satellite/Terrain without MapShell knowing about the UI.
    // `buildBaseLayer` mirrors the exact tileLayer options the original
    // hardcoded Voyager layer shipped with (Slice 1) — retina/@2x
    // handling, Safari iOS buffer tuning — just parameterized per style
    // instead of only ever building the one CARTO Voyager URL.
    const buildBaseLayer = (styleId) => {
      const style = getBasemapStyle(styleId);
      const useRetina = IS_RETINA && style.retina && style.urlRetina;
      const options = {
        attribution: style.attribution,
        maxZoom: style.maxZoom,
        maxNativeZoom: style.maxNativeZoom,
        tileSize: useRetina ? 512 : 256,
        zoomOffset: useRetina ? -1 : 0,
        keepBuffer: IS_SAFARI_IOS ? 2 : 4,
        updateWhenIdle: IS_SAFARI_IOS,
        updateWhenZooming: false,
        // No `crossOrigin`: nothing here reads tile pixels back (no canvas
        // export), so forcing CORS mode only adds a way for a tile request
        // to fail (server without CORS headers) and puts tiles in a
        // different connection pool than a plain <img> load.
      };
      // Leaflet's tileLayer defaults `subdomains` to 'abc' internally, but
      // only when the option is actually *absent* — passing an explicit
      // `subdomains: undefined` (Satellite has none) still overwrites that
      // default via `L.extend`, leaving `_getSubdomain` reading `.length`
      // off `undefined` and crashing on the very first tile request. Only
      // set the key when a style actually defines one.
      if (style.subdomains) options.subdomains = style.subdomains;
      const layer = L.tileLayer(useRetina ? style.urlRetina : style.url, options);
      watchTiles(layer);
      return layer;
    };

    let baseMapLayer = buildBaseLayer(DEFAULT_BASEMAP_ID).addTo(map);
    map._basemapId = DEFAULT_BASEMAP_ID;

    // Exposed for the Layers panel's "Base Map Style" picker — same
    // imperative-Leaflet, hang-it-off-the-map-instance pattern already
    // used for `_campusBoundaryLayer` below, so switching styles doesn't
    // need React Context or a prop threaded through every intermediate
    // component between MapPage and LayersPanel.
    map._setBasemap = (styleId) => {
      if (styleId === map._basemapId) return;
      if (!BASEMAP_STYLES.some((s) => s.id === styleId)) return;
      // Capture the outgoing layer by value *before* `baseMapLayer` gets
      // reassigned below — both the 'load' handler and the setTimeout
      // fallback are async and would otherwise close over the shared
      // `baseMapLayer` binding, which by the time either fires has
      // already been reassigned to `nextLayer` itself. That bug meant
      // the "old" layer being removed was actually the brand-new one
      // (removing a layer mid-render is exactly what throws Leaflet's
      // "this._map is null" in `_tileReady`), while the real old layer
      // was silently leaked underneath it.
      setTileAlert(false); // fresh layer, fresh chance — its own watcher re-raises if needed
      const oldLayer = baseMapLayer;
      const nextLayer = buildBaseLayer(styleId).addTo(map);
      nextLayer.once('load', () => {
        if (map.hasLayer(oldLayer)) map.removeLayer(oldLayer);
      });
      // Fallback in case the new layer's tiles are already cached and
      // 'load' never fires (Leaflet only fires it for tiles actually
      // fetched over the network) — swap on the next tick regardless.
      setTimeout(() => {
        if (map.hasLayer(oldLayer)) map.removeLayer(oldLayer);
      }, 300);
      baseMapLayer = nextLayer;
      map._basemapId = styleId;
    };

    // ── Zoom-class stamped on the container — CSS uses this to show/hide
    // label chips at different zoom levels (consumed by later slices).
    const updateZoomClass = () => {
      const z = map.getZoom();
      const el = containerRef.current;
      if (!el) return;
      el.dataset.zoom = z;
      el.classList.remove('zoom-far', 'zoom-mid', 'zoom-near', 'zoom-close');
      if (z <= 14) el.classList.add('zoom-far');
      else if (z <= 15) el.classList.add('zoom-mid');
      else if (z <= 17) el.classList.add('zoom-near');
      else el.classList.add('zoom-close');
    };
    map.on('zoomend', updateZoomClass);
    const saveView = () => onViewChangeRef.current?.({ center: map.getCenter(), zoom: map.getZoom() });
    map.on('moveend', saveView);
    updateZoomClass();

    // ── Interaction start/end — pauses animations mid-gesture. Consumed
    // by later slices (GPS dot, nav HUD) via map._userInteracting.
    map._userInteracting = false;
    let interactTimeout = null;
    const onInteractStart = () => {
      map._userInteracting = true;
      clearTimeout(interactTimeout);
    };
    const onInteractEnd = () => {
      clearTimeout(interactTimeout);
      interactTimeout = setTimeout(() => {
        map._userInteracting = false;
      }, 4000);
    };
    map.on('dragstart mousedown touchstart', onInteractStart);
    map.on('dragend mouseup touchend', onInteractEnd);

    const campusBoundaryRect = L.rectangle(CAMPUS_BOUNDS, {
      color: '#00c896',
      weight: 2,
      dashArray: '6 4',
      fillOpacity: 0.04,
    }).addTo(map);

    // Exposed for Slice 3's legend "Campus Bounds" toggle + zoom-to button
    // (features/legend/LayersPanel.jsx) — same imperative-Leaflet pattern
    // as legacy's plain top-level `campusBoundaryRect` var, just hung off
    // the map instance instead of module scope so it travels with
    // `onMapReady` rather than needing a second callback prop.
    map._campusBoundaryLayer = campusBoundaryRect;

    // ── Map is "ready" as soon as the Leaflet instance exists — NOT when
    // the first tiles finish. This used to wait for the base layer's
    // 'load' event, which only fires once every visible tile has loaded
    // or failed. On a slow/stalled connection to the tile server that
    // could take a very long time, and since `map` state gates
    // WaypointLayer, OSMAnnotationLayer, GPS, navigation and the loading
    // screen's own "Continue with saved data" escape hatch (HomeRoute's
    // `canContinueAnyway` needs mapReady), a slow tile server blocked the
    // entire app. Tiles now stream in behind an already-usable map.
    //
    // Deferred one tick (and cancelled in cleanup) so React StrictMode's
    // mount → cleanup → mount double-invoke never hands consumers a map
    // instance that's about to be removed.
    const readyTimer = setTimeout(() => {
      if (mapRef.current === map) onMapReady?.(map);
    }, 0);

    return () => {
      clearTimeout(readyTimer);
      clearTimeout(interactTimeout);
      [...tileDisposers].forEach((d) => d());
      map.off('zoomend', updateZoomClass);
      map.off('moveend', saveView);
      map.off('dragstart mousedown touchstart', onInteractStart);
      map.off('dragend mouseup touchend', onInteractEnd);
      map.removeLayer(campusBoundaryRect);
      map.removeLayer(baseMapLayer);
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <>
      <div ref={containerRef} className={styles.map} />
      {tileAlert && (
        <div className={styles.tileAlert} role="alert">
          <TriangleAlert size={16} className={styles.tileAlertIcon} />
          <span>The map isn't loading properly. Check your connection, then refresh the page.</span>
          <button type="button" className={styles.tileAlertRefresh} onClick={() => window.location.reload()}>
            <RefreshCw size={12} /> Refresh
          </button>
          <button
            type="button"
            className={styles.tileAlertClose}
            aria-label="Dismiss"
            onClick={() => setTileAlert(false)}
          >
            <X size={14} />
          </button>
        </div>
      )}
    </>
  );
}