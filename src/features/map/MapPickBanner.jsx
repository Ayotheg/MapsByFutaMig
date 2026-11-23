import { Crosshair, X } from 'lucide-react';
import styles from './MapPickBanner.module.css';

/**
 * Shown while MapPage is waiting for the one map click that resolves a
 * location pick — currently SuggestWaypointModal's "Pick on map", which
 * hides the form while the person taps the map, leaving nothing else on
 * screen to say what to do. Same fixed-top/v2-token construction as
 * OfflineBanner, since both are "float above the map regardless of its
 * own theme" banners.
 */
export default function MapPickBanner({ message = 'Tap the map to set your location', onCancel }) {
  return (
    <div className={styles.banner} role="status">
      <Crosshair size={14} className={styles.icon} />
      <span>{message}</span>
      <button type="button" className={styles.cancelButton} onClick={onCancel}>
        <X size={12} />
        Cancel
      </button>
    </div>
  );
}
