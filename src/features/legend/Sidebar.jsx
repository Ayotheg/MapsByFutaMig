import { lazy, Suspense, useEffect, useState } from 'react';
import { Compass, Rss, Navigation, CirclePlus, CircleUser, Shield, Sparkles } from 'lucide-react';
import styles from './Sidebar.module.css';
import LayersPanel from './LayersPanel';
import ExplorePanel from '../explore/ExplorePanel';
import { displayName } from '../auth/useAuth';
import { track } from '../../lib/analytics';
import { readPersistentState, writePersistentState } from '../../lib/persistentState';

// Slice 9: GPS Signal isn't open by default (only Layers is), so per
// CLAUDE.md's bundle-size policy it's lazy-loaded like DetailModal/
// SaveModal — the always-on tracking logic itself (`useGpsTracking`) is
// a different concern and stays non-lazy in MapPage, see its own header
// comment for why.
const GpsPanel = lazy(() => import('../navigation/GpsPanel'));

// ── Rail button icons: previously hand-drawn inline SVGs copied verbatim
// from legacy index.html (~96–119). UI redesign (UI_REDESIGN_GUIDE.md)
// swaps these for lucide-react equivalents — a component swap only, same
// as the Loading Screen's icon swap flag — chosen to match the icon
// treatment just established on the mobile MobileSheet tab strip
// (Section 2's pairing rule: reuse the just-made mobile decisions), which
// itself matches the "Layers Panel" Figma reference glyphs.
const RAIL_ITEMS = [
  { key: 'layers', label: 'Layers', title: 'Layers', Icon: Compass, hasPanel: true },
  // Desktop's own new rail button, added alongside (not instead of)
  // Layers — per explicit instruction, desktop keeps Layers untouched;
  // only mobile's pre-existing "Explore" tab got repurposed (see
  // MobileSheet.jsx's header comment on that). Sparkles rather than
  // Compass since Compass is already Layers' icon here on desktop.
  { key: 'explore', label: 'Explore', title: 'Explore', Icon: Sparkles, hasPanel: true },
  { key: 'gps', label: 'Signal', title: 'GPS Signal', Icon: Rss, hasPanel: true },
  { key: 'navigate', label: 'Nav', title: 'Navigate', Icon: Navigation, hasPanel: true },
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
export default function Sidebar({
  map,
  typeVisibilityProps,
  collapsed,
  onCollapsedChange,
  gps,
  // No longer read directly now that `NavPanel` (its only consumer) is
  // unreachable from this rail — accepted rather than removed since
  // MapPage still passes it, and it's the natural hook if the desktop
  // rail ever gets its own nav-active treatment (mobile's navbar already
  // has one, see MobileSheet.module.css's `.navbarNavActive`).
  navActive,
  onNavLaunch,
  user,
  onAuthClick,
  onAdminClick,
  guestNavRemaining,
  onSuggestPlaceClick,
  explorePicks,
  explorePicksLoading,
  onExploreSelect,
}) {
  const [activeKey, setActiveKey] = useState(() => readPersistentState('sidebar-active-panel', 'layers'));

  useEffect(() => writePersistentState('sidebar-active-panel', activeKey), [activeKey]);

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
    // Bug fix (reported directly for the mobile search bar + navbar; the
    // desktop rail's "Nav" item had the identical problem — opening its
    // own panel body, `NavPanel`, a plain "START NAVIGATION" card,
    // instead of handing off to `onNavLaunch` the way `DesktopSearchBar`'s
    // own nav button already did). Same fix as `MobileSheet.jsx`'s
    // `handleTabClick`: skip the panel entirely and call `onNavLaunch`
    // directly, so this rail item and the search bar's nav button now
    // agree. `NavPanel` is no longer reachable from here either.
    if (item.key === 'navigate') {
      onCollapsedChange(true);
      onNavLaunch?.();
      return;
    }
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
    // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9) — only fires
    // when a panel actually opens, not on the collapse branches above.
    track('feature_panel_open', { panel: item.key });
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
              <item.Icon size={18} strokeWidth={1.8} />
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

      {!collapsed && activeKey === 'explore' && (
        <div className={styles.panel}>
          <div className={styles.panelBody}>
            <ExplorePanel
              picks={explorePicks || []}
              loading={explorePicksLoading}
              variant="full"
              onSelect={onExploreSelect}
            />
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

      {/* Ported from legacy index.html ~611–630 (`.sidebar-footer`) — sits
          below the rail, same width. Sign In is wired for real now
          (Slice 10) — signed-in state swaps to avatar + first name,
          matching legacy's `updateSidebarBtn` (app.js ~7324–7339). Admin
          toggle (`onAdminClick`) is PIN-gated (`useAdminPin`/
          `AdminPinGate`, Slice 10) and, as of Slice 11, opens the real
          ported admin panel — see MapPage.jsx's `handleAdminClick`. */}
      <div className={styles.sidebarFooter}>
        <button
          type="button"
          className={styles.authBtn}
          title={
            user
              ? 'Account'
              : guestNavRemaining != null
                ? `Sign In — ${guestNavRemaining} free navigation${guestNavRemaining === 1 ? '' : 's'} left`
                : 'Sign In'
          }
          onClick={onAuthClick}
        >
          {!user && guestNavRemaining != null && (
            <span className={styles.guestBadge}>{guestNavRemaining}</span>
          )}
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
              <CircleUser size={15} strokeWidth={1.8} />
              <span>Sign In</span>
            </>
          )}
        </button>
        {/* Admin stays desktop-only: Sidebar only ever mounts when
            MapPage's isMobile check is false (see that file's isMobile ≤
            768px breakpoint), and MobileSheet's tab strip no longer has
            an Admin entry point (UI redesign, see MobileSheet.jsx's own
            header comment). `.adminBtn`'s own `@media (max-width: 768px)`
            rule below is a belt-and-suspenders CSS guard for the same
            768px cutoff, in case this component is ever kept mounted
            across a resize rather than swapped. Icon swapped from the
            Sign In button's person glyph to Shield so the two are
            visually distinct — was previously the same icon for both. */}
        <button
          type="button"
          className={styles.adminBtn}
          title="Admin Panel"
          onClick={() => {
            track('feature_panel_open', { panel: 'admin' });
            onAdminClick();
          }}
        >
          <Shield size={15} strokeWidth={1.8} />
          <span>Admin</span>
        </button>
        {/* Slice 13 — button always visible; whether it opens the
            submission form or a "sign in first" prompt is decided by
            `onSuggestPlaceClick` (wired in MapPage.jsx), same reasoning
            as this button's `title` above not hiding Admin for signed-
            out visitors either — the entry point stays discoverable,
            the gate happens on click. */}
        <button type="button" className={styles.adminBtn} title="Suggest a Place" onClick={onSuggestPlaceClick}>
          <CirclePlus size={15} strokeWidth={1.8} />
          <span>Suggest</span>
        </button>
      </div>
    </aside>
  );
}