import { createPortal } from 'react-dom';
import { LocateFixed } from 'lucide-react';
import styles from './NavResumeOverlay.module.css';

/**
 * "Please wait" cover shown while a trip catches up after the page was
 * hidden (screen off, app switched, tab left) or reloaded mid-trip, so the
 * person never acts on a stale map. NavigationController decides when.
 *
 * Portalled into the Leaflet container like ZoomHint, so it dims the map
 * only — the HUD (and its End button) stays usable above it.
 */
export default function NavResumeOverlay({ map }) {
  return createPortal(
    <div className={styles.overlay} role="status" aria-live="polite">
      <div className={styles.card}>
        <div className={styles.pulseWrap} aria-hidden="true">
          <span className={styles.ring} />
          <span className={`${styles.ring} ${styles.ringLate}`} />
          <LocateFixed className={styles.icon} size={44} strokeWidth={2} />
        </div>
        <p className={styles.title}>Please wait</p>
        <p className={styles.text}>Finding where you are to get your route back on track.</p>
      </div>
    </div>,
    map.getContainer()
  );
}
