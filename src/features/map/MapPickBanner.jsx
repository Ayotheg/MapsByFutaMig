import { Crosshair, X } from 'lucide-react';
import styles from './MapPickBanner.module.css';

/**
 * Shown while MapPage is waiting for the one map click that resolves a
 * cross-route location pick (see MapPage.jsx's `externalPick` state,
 * fed by PromotePage.jsx's "Pick on Map" button).
 *
 * Distinct from SuggestWaypointModal/AdminPanel's own tap-to-place flow:
 * those just hide their own modal/panel in place, since the picker and
 * the form live on the same screen. A cross-route pick sends the person
 * to a different route (`/map`) with no modal left open to hint at what
 * to do, so this banner is what replaces that context — same
 * fixed-top/v2-token construction as OfflineBanner, since both are
 * "float above the map regardless of its own theme" banners.
 */
export default function MapPickBanner({ onCancel }) {
  return (
    <div className={styles.banner} role="status">
      <Crosshair size={14} className={styles.icon} />
      <span>Tap the map to set your location</span>
      <button type="button" className={styles.cancelButton} onClick={onCancel}>
        <X size={12} />
        Cancel
      </button>
    </div>
  );
}
