import { Menu, Search, Navigation } from 'lucide-react';
import styles from './MobileSearchBar.module.css';

/**
 * Ported from legacy's mobile top bar (index.html ~1099–1104,
 * `#mobSearchBar` / `#mobMenuBtn` / `#mobSearchTrigger` / `#mobNavTrigger`).
 * Unlike the desktop bar, this one isn't a real text input — it's a button
 * that opens MobileSearchOverlay, matching legacy exactly (the mobile
 * search *experience* only exists inside the full-screen overlay).
 *
 * `mobMenuBtn`'s wiring (app.js ~5961–5998) is a comment-flagged legacy fix
 * — "mobMenuBtn was never captured or wired — this fixes it" — toggling
 * the bottom sheet between peek/half. Reproduced here via `onToggleSheet`,
 * since MobileSheet.jsx's `sheetState` had to be lifted to MapPage anyway
 * for this slice (its own header comment anticipated this).
 */
export default function MobileSearchBar({ onOpenSearch, onToggleSheet, activeChipLabel }) {
  return (
    <div className={styles.bar}>
      <button className={styles.logoBtn} onClick={onToggleSheet} title="Menu" type="button">
        <Menu size={18} />
      </button>
      <button className={styles.inputBtn} onClick={onOpenSearch} type="button">
        <Search size={14} className={styles.icon} />
        <span className={styles.placeholder}>{activeChipLabel || 'Search FUTA campus…'}</span>
      </button>
      <button className={styles.navBtn} title="Navigate" type="button">
        <Navigation size={16} />
      </button>
    </div>
  );
}
