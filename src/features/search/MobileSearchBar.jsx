import { Heart, Navigation } from 'lucide-react';
import { CROWDR_CAMPAIGN_URL } from '../../lib/donate';
import { track } from '../../lib/analytics';
import styles from './MobileSearchBar.module.css';

/**
 * Ported from legacy's mobile top bar (index.html ~1099–1104,
 * `#mobSearchBar` / `#mobMenuBtn` / `#mobSearchTrigger` / `#mobNavTrigger`).
 * Unlike the desktop bar, this one isn't a real text input — it's a button
 * that opens MobileSearchOverlay, matching legacy exactly (the mobile
 * search *experience* only exists inside the full-screen overlay).
 *
 * The left button is the donate heart (Crowdr). It replaced the old menu
 * button, which only duplicated the sheet's own Explore tab. No search
 * icon: it sat right next to the heart and the two clashed.
 *
 * `onNavigate` (Slice 9): legacy's `mobNavTrig` click handler (app.js
 * ~5560ish, wired alongside the other mobile FABs) just switches the
 * bottom sheet to its "navigate" tab and opens it half-height — it does
 * NOT itself start navigation, that's what `#panelNavigate`'s own
 * "START NAVIGATION" button inside that tab is for.
 *
 * v2 redesign: restyled to the v2 "Lumina
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
export default function MobileSearchBar({ onOpenSearch, onNavigate, activeChipLabel }) {
  return (
    <div className={styles.bar}>
      <a
        className={styles.logoBtn}
        href={CROWDR_CAMPAIGN_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Support Maps By FUTA"
        title="Support Maps By FUTA"
        onClick={() => track('donate_click', { source: 'search_bar' })}
      >
        <Heart size={18} />
      </a>
      <button className={styles.inputBtn} onClick={onOpenSearch} type="button">
        <span className={styles.placeholder}>{activeChipLabel || 'Search FUTA campus…'}</span>
      </button>
      <button className={styles.navBtn} title="Navigate" type="button" onClick={onNavigate}>
        <Navigation size={13} />
      </button>
    </div>
  );
}
