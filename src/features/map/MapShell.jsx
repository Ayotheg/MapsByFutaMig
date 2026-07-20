import { useEffect, useRef } from 'react';
import L from 'leaflet';
import styles from './MapShell.module.css';

// ── Ported 1:1 from legacy app.js lines ~55–98 (feature/login2) ──────────
// Leaflet map init, OSM tile layer, zoom-state class toggling, and
// interaction start/end handling. No other legacy feature (markers,
// panels, search, etc.) is wired in here — those are separate slices.

import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import { DEFAULT_BASEMAP_ID, getBasemapStyle } from './basemaps';

const CAMPUS_CENTER = [7.2980, 5.1380];

const IS_SAFARI_IOS =
  /iPad|iPhone|iPod/.test(navigator.userAgent) ||
  (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);

const IS_RETINA = window.devicePixelRatio > 1;

// ── Shared tile-layer options, independent of which style is active —
// same perf tuning (buffer/update behavior) MapShell already used for
// the single Voyager layer, now applied uniformly whenever the user
// switches styles via the legend's "Base Map Style" picker.
function buildTileLayer(style) {
  const useRetina = style.retina && IS_RETINA;
  return L.tileLayer(useRetina ? style.urlRetina : style.url, {
    attribution: style.attribution,
    subdomains: style.subdomains || 'abc',
    maxZoom: style.maxZoom,
    maxNativeZoom: style.maxNativeZoom,
    tileSize: useRetina ? 512 : 256,
    zoomOffset: useRetina ? -1 : 0,
    keepBuffer: IS_SAFARI_IOS ? 2 : 4,
    updateWhenIdle: IS_SAFARI_IOS,
    updateWhenZooming: false,
    crossOrigin: true,
  });
}

/**
 * MapShell — owns the Leaflet map instance imperatively via useRef.
 * Deliberately not react-leaflet, per CLAUDE.md, to preserve the
 * existing canvas-marker performance approach used by later slices.
 *
 * onMapReady(map) fires once after init so sibling/child features
 * (waypoints, legend, search, etc. — later slices) can attach to the
 * same instance without reaching for window globals.
 */
export default function MapShell({ onMapReady }) {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (mapRef.current) return; // guard against StrictMode double-invoke

    const map = L.map(containerRef.current, {
      center: CAMPUS_CENTER,
      zoom: 16,
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

    // ── Base tile: CARTO Voyager by default — matches Google Maps'
    // familiar look. Swappable at runtime via `map.setBaseMapStyle(id)`,
    // called by the legend's "Base Map Style" picker
    // (features/legend/LayersPanel.jsx) — same imperative-Leaflet
    // pattern as `map._campusBoundaryLayer` above: hung off the map
    // instance so it travels with `onMapReady` instead of needing a
    // second prop/callback threaded through Sidebar/MobileSheet.
    let baseMapLayer = buildTileLayer(getBasemapStyle(DEFAULT_BASEMAP_ID)).addTo(map);
    map._baseMapStyleId = DEFAULT_BASEMAP_ID;
    map.setBaseMapStyle = (styleId) => {
      if (styleId === map._baseMapStyleId) return;
      const style = getBasemapStyle(styleId);
      const nextLayer = buildTileLayer(style).addTo(map);
      // Add-before-remove avoids a blank flash while the new provider's
      // tiles are still loading in.
      const prevLayer = baseMapLayer;
      baseMapLayer = nextLayer;
      map._baseMapStyleId = style.id;
      map.removeLayer(prevLayer);
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