import { useEffect, useRef } from 'react';
import L from 'leaflet';
import styles from './MapShell.module.css';

// ── Ported 1:1 from legacy app.js lines ~55–98 (feature/login2) ──────────
// Leaflet map init, OSM tile layer, zoom-state class toggling, and
// interaction start/end handling. No other legacy feature (markers,
// panels, search, etc.) is wired in here — those are separate slices.

import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import { BASEMAP_STYLES, DEFAULT_BASEMAP_ID, getBasemapStyle } from './basemaps';

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

  useEffect(() => {
    if (mapRef.current) return; // guard against StrictMode double-invoke

    const map = L.map(containerRef.current, {
      center: initialView?.center || CAMPUS_CENTER,
      zoom: initialView?.zoom || 16,
      maxBounds: CAMPUS_BOUNDS,
      maxBoundsViscosity: 0.95,
      minZoom: 14,
      maxZoom: 19,

      preferCanvas: true,

      zoomAnimation: !IS_SAFARI_IOS,
      markerZoomAnimation: !IS_SAFARI_IOS,
    });
    mapRef.current = map;

    // ── Hide +/- zoom buttons on mobile (pinch-to-zoom is the native gesture)
    if (window.innerWidth <= 768) map.zoomControl.remove();

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
        crossOrigin: true,
      };
      // Leaflet's tileLayer defaults `subdomains` to 'abc' internally, but
      // only when the option is actually *absent* — passing an explicit
      // `subdomains: undefined` (Satellite has none) still overwrites that
      // default via `L.extend`, leaving `_getSubdomain` reading `.length`
      // off `undefined` and crashing on the very first tile request. Only
      // set the key when a style actually defines one.
      if (style.subdomains) options.subdomains = style.subdomains;
      return L.tileLayer(useRetina ? style.urlRetina : style.url, options);
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

    onMapReady?.(map);

    return () => {
      clearTimeout(interactTimeout);
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

  return <div ref={containerRef} className={styles.map} />;
}