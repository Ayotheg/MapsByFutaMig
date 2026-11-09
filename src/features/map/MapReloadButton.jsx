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
 * Phone: fixed top-right under the quick chips. Desktop: a Leaflet control
 * under the +/- zoom buttons. CSS picks which one shows.
 */
export default function MapReloadButton({ map }) {
  const [busy, setBusy] = useState(false);
  const [controlEl, setControlEl] = useState(null);
  const busyRef = useRef(false);

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

  const reload = async () => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    let ok = true;
    try {
      ok = await map._reloadTiles();
    } catch {
      ok = false;
    }
    // Last resort, what pull-to-refresh does in a browser tab. Never
    // offline: the app shell isn't cached, so a reload would show nothing.
    if (!ok && navigator.onLine !== false) {
      window.location.reload();
      return;
    }
    busyRef.current = false;
    setBusy(false);
  };

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
