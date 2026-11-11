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
 *
 * Bug fix (reported directly, with a screenshot): this used to render
 * the launch button + hint unconditionally, `navActive` was only used
 * for a cosmetic class on the button. Once turn-by-turn is actually
 * running, `NavHud` owns the entire "in navigation" UI (including its
 * own End button) — this stale "Start Navigation" card behind it served
 * no purpose and was confusing. `MobileSheet.jsx` now also auto-collapses
 * the sheet the instant `navActive` flips true, so in practice this
 * won't be visible anyway; returning null here is the belt-and-braces
 * case where the sheet gets manually reopened to this tab mid-navigation.
 */
export default function NavPanel({ navActive, onLaunch }) {
  if (navActive) return null;
  return (
    <div className={styles.body}>
      <button type="button" className={styles.launchBtn} title="Navigate from my location" onClick={onLaunch}>
        <Navigation size={14} />
        START NAVIGATION
      </button>
      <div className={styles.hint}>Tap any pin on the map to set as your destination, then press Start Navigation.</div>
    </div>
  );
}
