import { lazy, Suspense, useEffect, useState } from 'react';
import styles from './Sidebar.module.css';
import LayersPanel from './LayersPanel';
import NavPanel from '../navigation/NavPanel';
import { displayName } from '../auth/useAuth';

// Slice 9: GPS Signal isn't open by default (only Layers is), so per
// CLAUDE.md's bundle-size policy it's lazy-loaded like DetailModal/
// SaveModal — the always-on tracking logic itself (`useGpsTracking`) is
// a different concern and stays non-lazy in MapPage, see its own header
// comment for why.
const GpsPanel = lazy(() => import('../navigation/GpsPanel'));

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
  { key: 'gps', label: 'Signal', title: 'GPS Signal', Icon: SignalIcon, hasPanel: true },
  { key: 'navigate', label: 'Nav', title: 'Navigate', Icon: NavigateIcon, hasPanel: true },
];

/**
 * Desktop sidebar shell — logo strip + icon rail + the active panel.
 *
 * Ported from legacy `index.html` lines ~79–131 (`<aside class="sidebar">`
 * through the open of `#panelLayers`) and `app.js`'s `initSidebarRail`
 * IIFE (~3296–3324) for the rail's click/collapse behavior.
 *
 * Only the Layers panel had content before Slice 9 — GPS Signal and
 * Navigate now render real panels too (`GpsPanel`/`NavPanel`), wired to
 * the `gps`/nav-launch state MapPage lifts from `useGpsTracking` and
 * `NavigationController`.
 *
 * `collapsed` was promoted from local state to a controlled prop in
 * Slice 7: the new floating `DesktopSearchBar`/`QuickChips` need to shift
 * left in lockstep with the sidebar collapsing (legacy's
 * `body.sidebar-collapsed .desk-search-bar` rule), so MapPage now owns
 * this value and passes it down to all three.
 */
export default function Sidebar({ map, typeVisibilityProps, collapsed, onCollapsedChange, gps, navActive, onNavLaunch, user, onAuthClick }) {
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

      {!collapsed && activeKey === 'gps' && (
        <div className={styles.panel}>
          <Suspense fallback={null}>
            <GpsPanel gps={gps} />
          </Suspense>
        </div>
      )}

      {!collapsed && activeKey === 'navigate' && (
        <div className={styles.panel}>
          <div className={styles.panelHeaderGeneric}>
            <span className={styles.panelTitleGeneric}>Navigate</span>
          </div>
          <div className={styles.panelBody}>
            <NavPanel navActive={navActive} onLaunch={onNavLaunch} />
          </div>
        </div>
      )}

      {/* Ported from legacy index.html ~611–630 (`.sidebar-footer`) — sits
          below the rail, same width. Sign In is wired for real now
          (Slice 10) — signed-in state swaps to avatar + first name,
          matching legacy's `updateSidebarBtn` (app.js ~7324–7339). Admin
          toggle stays inert — wiring it (PIN gate + panel) is Slice 11's
          job per its own tracker row. */}
      <div className={styles.sidebarFooter}>
        <button type="button" className={styles.authBtn} title={user ? 'Account' : 'Sign In'} onClick={onAuthClick}>
          {user ? (
            <>
              {/* Legacy shows the avatar only if photoURL exists; no icon
                  fallback when signed in without one — just the name
                  (app.js ~7329–7335's `sidebarAvatar.classList.add('hidden')`
                  else-branch has no icon swap-in). */}
              {(user.user_metadata?.avatar_url || user.user_metadata?.picture) && (
                <img className={styles.avatar} src={user.user_metadata.avatar_url || user.user_metadata.picture} alt="" />
              )}
              <span className={styles.displayName}>{displayName(user).split(' ')[0]}</span>
            </>
          ) : (
            <>
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              <span>Sign In</span>
            </>
          )}
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