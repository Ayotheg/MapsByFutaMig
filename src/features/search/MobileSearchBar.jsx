import { Search, Navigation } from 'lucide-react';
import styles from './MobileSearchBar.module.css';

/**
 * Ported from legacy's mobile top bar (index.html ~1099–1104,
 * `#mobSearchBar` / `#mobSearchTrigger` / `#mobNavTrigger`). Unlike the
 * desktop bar, this one isn't a real text input — it's a button that
 * opens MobileSearchOverlay, matching legacy exactly (the mobile search
 * *experience* only exists inside the full-screen overlay).
 *
 * `onNavigate` (Slice 9): legacy's `mobNavTrig` click handler (app.js
 * ~5560ish, wired alongside the other mobile FABs) just switches the
 * bottom sheet to its "navigate" tab and opens it half-height — it does
 * NOT itself start navigation, that's what `#panelNavigate`'s own
 * "START NAVIGATION" button inside that tab is for.
 *
 * Oct 2026 Quick Chips revamp (public/Maps By FUTA — Quick-chips-png.zip):
 * restyled to the redesign's plain white pill — search icon + "Search
 * FUTA campus..." — with the Navigate button kept on the right, per the
 * person's instruction. The menu button that toggled the bottom sheet
 * (legacy `#mobMenuBtn`) is gone; the sheet's own handle/tabs still
 * open it.
 */
export default function MobileSearchBar({ onOpenSearch, onNavigate, activeChipLabel }) {
  return (
    <div className={styles.bar}>
      <button className={styles.inputBtn} onClick={onOpenSearch} type="button">
        <Search size={22} className={styles.icon} />
        <span className={styles.placeholder}>{activeChipLabel || 'Search FUTA campus...'}</span>
      </button>
      <button className={styles.navBtn} title="Navigate" type="button" onClick={onNavigate}>
        <Navigation size={17} />
      </button>
    </div>
  );
}
