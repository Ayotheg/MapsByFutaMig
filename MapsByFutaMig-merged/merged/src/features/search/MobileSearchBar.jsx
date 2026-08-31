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
 *
 * `onNavigate` (Slice 9): legacy's `mobNavTrig` click handler (app.js
 * ~5560ish, wired alongside the other mobile FABs) just switches the
 * bottom sheet to its "navigate" tab and opens it half-height — it does
 * NOT itself start navigation, that's what `#panelNavigate`'s own
 * "START NAVIGATION" button inside that tab is for.
 *
 * UI_REDESIGN_GUIDE.md pass (this session): restyled to the v2 "Lumina
 * Campus Utility" light theme per Figma node 29:23 ("Group 2" — the
 * floating search pill). Structure/props/handlers unchanged — only
 * classNames' declarations and icon sizes moved to match the design.
 *
 * Update: node 29:23's third button rendered as an ambiguous circular
 * photo/badge with no source asset, flagged for confirmation rather
 * than guessed at. Node 31:243 (a cleaner pass at the same bar,
 * supplied in-session) confirms it as a plain navigation/send arrow
 * in a solid `--v2-primary` circle — matching what was already here
 * (`Navigation` icon, unchanged `onNavigate`/title="Navigate"). Flag
 * resolved; only the icon size and the pill's background/border
 * moved to match 31:243's opaque white treatment (see .module.css).
 */
export default function MobileSearchBar({ onOpenSearch, onToggleSheet, onNavigate, activeChipLabel }) {
  return (
    <div className={styles.bar}>
      <button className={styles.logoBtn} onClick={onToggleSheet} title="Menu" type="button">
        <Menu size={18} />
      </button>
      <button className={styles.inputBtn} onClick={onOpenSearch} type="button">
        <Search size={16} className={styles.icon} />
        <span className={styles.placeholder}>{activeChipLabel || 'Search FUTA campus…'}</span>
      </button>
      <button className={styles.navBtn} title="Navigate" type="button" onClick={onNavigate}>
        <Navigation size={13} />
      </button>
    </div>
  );
}
