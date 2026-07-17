import { useEffect, useState } from 'react';
import styles from './Sidebar.module.css';
import LayersPanel from './LayersPanel';

// ── Rail button icons, copied verbatim from legacy index.html inline SVGs
// (~96–119) rather than swapped for a lucide-react equivalent, since these
// are already simple hand-drawn icons in the legacy markup itself (not
// Bootstrap Icons references — legacyIconMap.js doesn't apply here).
function LayersIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" />
      <polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  );
}
function SignalIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
      <path d="M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1" />
    </svg>
  );
}
function NavigateIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="3 11 22 2 13 21 11 13 3 11" />
    </svg>
  );
}

const RAIL_ITEMS = [
  { key: 'layers', label: 'Layers', title: 'Layers', Icon: LayersIcon, hasPanel: true },
  { key: 'gps', label: 'Signal', title: 'GPS Signal', Icon: SignalIcon, hasPanel: false },
  { key: 'navigate', label: 'Nav', title: 'Navigate', Icon: NavigateIcon, hasPanel: false },
];

/**
 * Desktop sidebar shell — logo strip + icon rail + the active panel.
 *
 * Ported from legacy `index.html` lines ~79–131 (`<aside class="sidebar">`
 * through the open of `#panelLayers`) and `app.js`'s `initSidebarRail`
 * IIFE (~3296–3324) for the rail's click/collapse behavior.
 *
 * Only the Layers panel has content this slice — GPS Signal (Slice 9) and
 * Navigate (Slice 9) rail buttons are rendered (they're real chrome in
 * legacy, not invented) but `hasPanel: false` for both, so clicking them
 * reproduces legacy's exact fallback: `targetPanel` resolves to nothing,
 * so the rail just collapses to icon-only width, same as if you re-click
 * the already-active tab. Nothing here should be built out further until
 * Slice 9 actually lands their panels.
 *
 * `collapsed` was promoted from local state to a controlled prop in
 * Slice 7: the new floating `DesktopSearchBar`/`QuickChips` need to shift
 * left in lockstep with the sidebar collapsing (legacy's
 * `body.sidebar-collapsed .desk-search-bar` rule), so MapPage now owns
 * this value and passes it down to all three.
 */
export default function Sidebar({ map, typeVisibilityProps, collapsed, onCollapsedChange }) {
  const [activeKey, setActiveKey] = useState('layers');

  // Slice 4: reflect collapsed state onto document.body, same
  // classList.toggle('sidebar-collapsed') approach legacy uses
  // (app.js ~3309/3320), so MapShell.module.css can react to it via a
  // global selector without Sidebar needing to know about MapShell.
  // Cleanup on unmount matters here — Sidebar unmounts on mobile
  // (MobileSheet renders instead), so a stale class shouldn't linger.
  useEffect(() => {
    document.body.classList.toggle('sidebar-collapsed', collapsed);
    return () => document.body.classList.remove('sidebar-collapsed');
  }, [collapsed]);

  function handleRailClick(item) {
    const isAlreadyActive = activeKey === item.key && !collapsed;
    if (isAlreadyActive) {
      onCollapsedChange(true);
      return;
    }
    if (!item.hasPanel) {
      // Mirrors legacy: no matching panel element → rail collapses,
      // nothing activates (app.js ~3317: `if (targetPanel) { ... }`).
      onCollapsedChange(true);
      return;
    }
    setActiveKey(item.key);
    onCollapsedChange(false);
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.collapsed : ''}`}>
      <div className={styles.logo}>
        <div className={styles.logoIcon}>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
            <circle cx="12" cy="10" r="4" stroke="var(--primary)" strokeWidth="1.8" />
            <path
              d="M12 2C7.03 2 3 6.03 3 11c0 5.25 7.5 11 9 11s9-5.75 9-11c0-4.97-4.03-9-9-9z"
              stroke="var(--primary)"
              strokeWidth="1.8"
              fill="none"
            />
          </svg>
        </div>
      </div>

      <nav className={styles.rail}>
        {RAIL_ITEMS.map((item) => {
          const active = !collapsed && activeKey === item.key;
          return (
            <button
              key={item.key}
              type="button"
              className={`${styles.railBtn} ${active ? styles.railBtnActive : ''}`}
              title={item.title}
              onClick={() => handleRailClick(item)}
            >
              <item.Icon />
              <span>{item.label}</span>
            </button>
          );
        })}
        <div className={styles.brandText}>Maps By Futa v1.0</div>
      </nav>

      {!collapsed && activeKey === 'layers' && (
        <div className={styles.panel}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderTitles}>
              <span className={styles.panelTitle}>Map Layers</span>
              <span className={styles.panelSubtitle}>Map legend and data reference</span>
            </div>
          </div>
          <div className={styles.panelBody}>
            <LayersPanel map={map} typeVisibilityProps={typeVisibilityProps} />
          </div>
        </div>
      )}

      {/* Ported from legacy index.html ~611–630 (`.sidebar-footer`) — sits
          below the rail, same width. Both buttons are real legacy chrome,
          rendered here but inert: the Sign In flow is Slice 10 (Auth) and
          the admin toggle is Slice 11 (Admin panel). Only the signed-out
          state is ported — `#authBtnSignedIn`'s avatar/display-name swap
          needs actual auth state that doesn't exist yet. */}
      <div className={styles.sidebarFooter}>
        <button type="button" className={styles.authBtn} title="Sign In">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span>Sign In</span>
        </button>
        <button type="button" className={styles.adminBtn} title="Admin Panel">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="8" r="4" />
            <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
          </svg>
          <span>Admin</span>
        </button>
      </div>
    </aside>
  );
}