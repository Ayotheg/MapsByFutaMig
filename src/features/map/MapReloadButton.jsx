import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { RotateCw } from 'lucide-react';
import L from 'leaflet';
import styles from './MapReloadButton.module.css';

/**
 * Reload map — installed app only (MapShell decides). Tiles can come back
 * blank while counting as "loaded", so tileHealth's alert never shows, and
 * the installed app has no browser bar or pull-to-refresh to fall back on.
 *
 * First tap redraws the map's tiles. A second tap soon after (still blank)
 * reloads the app — what pull-to-refresh does in a browser tab.
 *
 * Phone: fixed top-right under the quick chips. Desktop: a Leaflet control
 * under the +/- zoom buttons. CSS picks which one shows. Hidden while the
 * "Map isn't loading" alert is up: it has its own Retry and covers this spot.
 */
const SECOND_TAP_MS = 30000;
const REACH_TIMEOUT_MS = 3000;

// The app shell isn't cached, so reloading while the site can't be reached
// (Wi-Fi with no internet, a stalled connection) leaves an installed app on
// the browser's error page with no way back. `navigator.onLine` can't tell.
async function siteReachable() {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), REACH_TIMEOUT_MS);
  try {
    const res = await fetch('/', { method: 'HEAD', cache: 'no-store', signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

export default function MapReloadButton({ map, hidden }) {
  const [busy, setBusy] = useState(false);
  const [controlEl, setControlEl] = useState(null);
  const busyRef = useRef(false);
  const lastTapRef = useRef(0);

  useEffect(() => {
    const Control = L.Control.extend({
      onAdd() {
        const el = L.DomUtil.create('div', `leaflet-bar ${styles.control}`);
        L.DomEvent.disableClickPropagation(el);
        return el;
      },
    });
    const control = new Control({ position: 'topleft' }).addTo(map);
    setControlEl(control.getContainer());
    return () => control.remove();
  }, [map]);

  // Leaflet keeps the control's (bordered) box; hide it with the button.
  useEffect(() => {
    if (controlEl) controlEl.style.display = hidden ? 'none' : '';
  }, [controlEl, hidden]);

  const reload = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    const now = Date.now();
    const secondTap = now - lastTapRef.current < SECOND_TAP_MS;
    lastTapRef.current = now;
    if (secondTap && (await siteReachable())) {
      window.location.reload();
      return;
    }
    // Spin at least briefly so the tap visibly did something.
    await Promise.allSettled([map._reloadTiles(), new Promise((r) => setTimeout(r, 900))]);
    busyRef.current = false;
    setBusy(false);
  };

  if (hidden) return null;

  const button = (className) => (
    <button
      type="button"
      className={`${className} ${busy ? styles.busy : ''}`}
      onClick={reload}
      aria-label="Reload map"
      title="Reload map"
      disabled={busy}
    >
      <RotateCw size={16} strokeWidth={2.2} aria-hidden="true" />
    </button>
  );

  return (
    <>
      {button(styles.fab)}
      {controlEl && createPortal(button(styles.square), controlEl)}
    </>
  );
}
