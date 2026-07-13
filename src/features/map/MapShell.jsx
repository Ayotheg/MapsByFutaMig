import { useEffect, useRef } from 'react';
import L from 'leaflet';
import styles from './MapShell.module.css';

// ── Ported 1:1 from legacy app.js lines ~55–98 (feature/login2) ──────────
// Leaflet map init, OSM tile layer, zoom-state class toggling, and
// interaction start/end handling. No other legacy feature (markers,
// panels, search, etc.) is wired in here — those are separate slices.

const CAMPUS_BOUNDS = L.latLngBounds([7.2820, 5.1080], [7.3120, 5.1680]);
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

    // ── Base tile: CARTO Voyager — matches Google Maps' familiar look
    const baseMapLayer = L.tileLayer(
      IS_RETINA
        ? 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}@2x.png'
        : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}.png',
      {
        attribution:
          '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
        maxNativeZoom: 19,
        tileSize: IS_RETINA ? 512 : 256,
        zoomOffset: IS_RETINA ? -1 : 0,
        keepBuffer: IS_SAFARI_IOS ? 2 : 4,
        updateWhenIdle: IS_SAFARI_IOS,
        updateWhenZooming: false,
        crossOrigin: true,
      }
    ).addTo(map);

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