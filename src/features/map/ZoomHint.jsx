import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import L from 'leaflet';
import styles from './ZoomHint.module.css';
import { setTawkHidden } from '../../lib/tawk';

const DISMISSED_KEY = 'mbf_zoom_hint_dismissed';
const FADE_MS = 280;
// Matches MapShell's `zoom-close` tier (waypointMarkers.css) — once the
// person is this zoomed in, dots already have inline labels and the
// hint has nothing left to teach.
const ZOOM_CLOSE_THRESHOLD = 18;

/**
 * First-visit "zoom in to see places" coach overlay.
 *
 * At the app's default entry zoom (16, MapShell's `zoom-near` tier)
 * waypoint dots have no label yet, so first-time visitors land on what
 * looks like a nearly empty map. This dims the whole map and shows a
 * large looping gesture in the middle: two fingertips spreading apart
 * with outward arrows on touch screens, a mouse wheel with an up arrow on
 * desktop (chosen by `pointer: coarse`, so tablets get the pinch).
 *
 * Portalled into the Leaflet container, so it covers the map only — the
 * search bar, sidebar and sheets stay above it. The dim layer ignores
 * pointer events, so the person can pinch the map straight through it;
 * only the "Got it" button is clickable (and doesn't leak clicks to the
 * map).
 *
 * No timeout: it stays until the person zooms in (any zoom-in, not only
 * to the close tier) or taps "Got it" — both remember it in localStorage.
 * It also leaves, without remembering, once they're already zoomed close.
 *
 * `onDone` fires once per load when the hint is out of the way: after it
 * fades on a first visit, or straight away when it isn't shown at all
 * (MapPage opens Explore from it).
 */
export default function ZoomHint({ map, onDone }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const buttonRef = useRef(null);
  // Ref so a new callback identity doesn't re-run the zoomend effect below.
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  const dismissedRef = useRef(false);

  const dismiss = useCallback(() => {
    // Several zoomends can land during the fade; act on the first.
    if (dismissedRef.current) return;
    dismissedRef.current = true;
    setLeaving(true);
    setTimeout(() => {
      setVisible(false);
      // After the fade, so Explore opens once the overlay is gone.
      onDoneRef.current?.();
    }, FADE_MS);
    try {
      window.localStorage?.setItem(DISMISSED_KEY, '1');
    } catch {
      // Private-mode/storage-disabled browsers just see the hint again
      // next visit -- not worth failing over for.
    }
  }, []);

  useEffect(() => {
    if (!map) return undefined;

    let alreadySeen = false;
    try {
      alreadySeen = !!window.localStorage?.getItem(DISMISSED_KEY);
    } catch {
      alreadySeen = false;
    }
    if (alreadySeen || map.getZoom() >= ZOOM_CLOSE_THRESHOLD) {
      onDoneRef.current?.();
      return undefined;
    }

    dismissedRef.current = false;
    setVisible(true);
    setLeaving(false);

    let lastZoom = map.getZoom();
    const onZoomEnd = () => {
      const z = map.getZoom();
      if (z > lastZoom || z >= ZOOM_CLOSE_THRESHOLD) dismiss();
      lastZoom = z;
    };
    map.on('zoomend', onZoomEnd);

    return () => map.off('zoomend', onZoomEnd);
  }, [map, dismiss]);

  // One thing at a time: the live-chat bubble waits until this is gone.
  useEffect(() => {
    setTawkHidden('zoom-hint', visible);
    return () => setTawkHidden('zoom-hint', false);
  }, [visible]);

  // The overlay lives inside the Leaflet container, whose own listeners
  // would otherwise treat a tap on the button as a map click.
  useEffect(() => {
    if (visible && buttonRef.current) L.DomEvent.disableClickPropagation(buttonRef.current);
  }, [visible]);

  if (!visible || !map) return null;

  const touch = isTouchScreen();

  return createPortal(
    <div className={`${styles.overlay} ${leaving ? styles.leaving : ''}`} role="status">
      <div className={styles.card}>
        <div className={styles.gestureWrap} aria-hidden="true">
          {touch ? <PinchGesture /> : <ScrollGesture />}
        </div>
        <p className={styles.title}>Zoom in to see places</p>
        <p className={styles.text}>
          {touch ? 'Spread two fingers apart on the map' : 'Scroll up on the map'} — buildings and place names
          appear as you get closer.
        </p>
        <button ref={buttonRef} type="button" className={styles.gotIt} onClick={dismiss}>
          Got it
        </button>
      </div>
    </div>,
    map.getContainer()
  );
}

function isTouchScreen() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

// Two fingertips press down near the centre and spread apart along a
// diagonal, each led by an arrow pointing outwards — the zoom-in pinch.
function PinchGesture() {
  return (
    <svg className={styles.gesture} viewBox="0 0 120 120" width="120" height="120">
      <g className={styles.arrowA}>
        <path className={styles.arrow} d="M30 90 L14 106 M14 106 h12 M14 106 v-12" />
      </g>
      <g className={styles.arrowB}>
        <path className={styles.arrow} d="M90 30 L106 14 M106 14 h-12 M106 14 v12" />
      </g>
      <circle className={`${styles.finger} ${styles.fingerA}`} cx="60" cy="60" r="11" />
      <circle className={`${styles.finger} ${styles.fingerB}`} cx="60" cy="60" r="11" />
    </svg>
  );
}

// A mouse with its wheel rolling and an arrow pointing up (scroll up = in).
function ScrollGesture() {
  return (
    <svg className={styles.gesture} viewBox="0 0 120 120" width="120" height="120">
      <g className={styles.arrowUp}>
        <path className={styles.arrow} d="M60 26 V6 M60 6 l-9 9 M60 6 l9 9" />
      </g>
      <rect className={styles.mouseBody} x="40" y="34" width="40" height="64" rx="20" />
      <line className={styles.wheel} x1="60" y1="46" x2="60" y2="58" />
    </svg>
  );
}
