import { useCallback, useEffect, useRef, useState } from 'react';
import { X } from 'lucide-react';
import styles from './ZoomHint.module.css';

const DISMISSED_KEY = 'mbf_zoom_hint_dismissed';
// Long enough for the gesture animation below to loop ~4 times.
const AUTO_DISMISS_MS = 7000;
const FADE_MS = 280;
// Matches MapShell's `zoom-close` tier (waypointMarkers.css) — once the
// person is this zoomed in, dots already have inline labels and the
// hint has nothing left to teach.
const ZOOM_CLOSE_THRESHOLD = 18;

/**
 * "Pinch/scroll to zoom in" toast — shown once per browser, right after
 * the map is ready. At the app's default entry zoom (16, MapShell's
 * `zoom-near` tier) waypoint dots have no label yet, so first-time
 * visitors land on what looks like a nearly empty map with a scatter of
 * small dots. This nudges them to zoom in without permanently cluttering
 * the UI for repeat visits.
 *
 * Leads with a looping gesture animation rather than text alone: two
 * fingertips spreading apart on touch screens, a scrolling mouse wheel
 * on desktop (chosen by `pointer: coarse`, so tablets get the pinch).
 *
 * Dismisses itself after 7s, or immediately when closed or when the person
 * zooms in past the zoom-close threshold. Only an intentional close or
 * zoom-in sets the localStorage flag, so a missed toast can appear next visit.
 */
export default function ZoomHint({ map }) {
  const [visible, setVisible] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const timerRef = useRef(null);

  const dismiss = useCallback((remember = true) => {
    clearTimeout(timerRef.current);
    setLeaving(true);
    setTimeout(() => setVisible(false), FADE_MS);
    if (remember) {
      try {
        window.localStorage?.setItem(DISMISSED_KEY, '1');
      } catch {
        // Private-mode/storage-disabled browsers just see the hint again
        // next visit -- not worth failing over for.
      }
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
    if (alreadySeen || map.getZoom() >= ZOOM_CLOSE_THRESHOLD) return undefined;

    setVisible(true);
    setLeaving(false);
    timerRef.current = setTimeout(() => dismiss(false), AUTO_DISMISS_MS);

    const onZoomEnd = () => {
      if (map.getZoom() >= ZOOM_CLOSE_THRESHOLD) dismiss();
    };
    map.on('zoomend', onZoomEnd);

    return () => {
      clearTimeout(timerRef.current);
      map.off('zoomend', onZoomEnd);
    };
  }, [map, dismiss]);

  if (!visible) return null;

  const touch = isTouchScreen();

  return (
    <div className={`${styles.hint} ${leaving ? styles.leaving : ''}`} role="status">
      <span className={styles.iconWrap} aria-hidden="true">
        {touch ? <PinchGesture /> : <ScrollGesture />}
      </span>
      <span className={styles.text}>
        {touch ? 'Pinch outwards to zoom in' : 'Scroll to zoom in'} — place names appear as you get closer.
      </span>
      <button type="button" className={styles.close} aria-label="Dismiss" onClick={dismiss}>
        <X size={14} />
      </button>
    </div>
  );
}

function isTouchScreen() {
  try {
    return window.matchMedia('(pointer: coarse)').matches;
  } catch {
    return false;
  }
}

// Two fingertips pressing down near the centre, spreading apart along a
// diagonal, then lifting off — the zoom-in pinch, looped.
function PinchGesture() {
  return (
    <svg className={styles.gesture} viewBox="0 0 44 44" width="44" height="44">
      <line className={styles.pinchTrack} x1="10" y1="34" x2="34" y2="10" />
      <circle className={`${styles.finger} ${styles.fingerA}`} cx="22" cy="22" r="5" />
      <circle className={`${styles.finger} ${styles.fingerB}`} cx="22" cy="22" r="5" />
    </svg>
  );
}

// A mouse with its wheel rolling forward.
function ScrollGesture() {
  return (
    <svg className={styles.gesture} viewBox="0 0 44 44" width="44" height="44">
      <rect className={styles.mouseBody} x="14" y="8" width="16" height="26" rx="8" />
      <line className={styles.wheel} x1="22" y1="13" x2="22" y2="18" />
    </svg>
  );
}
