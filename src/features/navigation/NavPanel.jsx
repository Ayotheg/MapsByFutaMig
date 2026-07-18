import { Navigation } from 'lucide-react';
import styles from './NavPanel.module.css';

/**
 * Ported from legacy `index.html` ~598–609 (`#panelNavigate`). Just the
 * launch button + static hint text — the actual "Where to?" destination
 * panel and turn-by-turn HUD live in `NavigationController.jsx`, which is
 * lazy-loaded on demand (see MapPage.jsx's bundle-size note). This
 * component stays tiny and non-lazy so the "Navigate" rail item always
 * has *something* to show immediately, matching every other sidebar
 * panel.
 */
export default function NavPanel({ navActive, onLaunch }) {
  return (
    <div className={styles.body}>
      <button type="button" className={`${styles.launchBtn} ${navActive ? styles.active : ''}`} title="Navigate from my location" onClick={onLaunch}>
        <Navigation size={14} />
        START NAVIGATION
      </button>
      <div className={styles.hint}>Tap any pin on the map to set as your destination, then press Start Navigation.</div>
    </div>
  );
}
