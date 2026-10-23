import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Layers, Compass, Rss, Navigation, Plus, User, Shield } from 'lucide-react';
import styles from './Sidebar.module.css';
import LayersPanel from './LayersPanel';
import ExplorePanel from '../explore/ExplorePanel';
import { GROUP_META } from './placeTypeGroups';
import { displayName } from '../auth/useAuth';
import { track } from '../../lib/analytics';
import { readPersistentState, writePersistentState } from '../../lib/persistentState';
import { supabase } from '../../lib/supabase';
import { fetchIsAdmin } from '../waypoints/submitWaypoint';

// Slice 9: GPS Signal isn't open by default (only Layers is), so per
// CLAUDE.md's bundle-size policy it's lazy-loaded like DetailModal/
// SaveModal — the always-on tracking logic itself (`useGpsTracking`) is
// a different concern and stays non-lazy in MapPage, see its own header
// comment for why.
const GpsPanel = lazy(() => import('../navigation/GpsPanel'));

// Rail items and icons per the desktop rail redesign (Oct 2026, public/
// Maps By FUTA — strip-Redesign-png.zip): Layers, Explore, Signal,
// Navigate. Explore takes Compass, matching its mobile tab.
const RAIL_ITEMS = [
  { key: 'layers', label: 'Layers', title: 'Layers', Icon: Layers, hasPanel: true },
  { key: 'explore', label: 'Explore', title: 'Explore', Icon: Compass, hasPanel: true },
  { key: 'gps', label: 'Signal', title: 'GPS Signal', Icon: Rss, hasPanel: true },
  { key: 'navigate', label: 'Navigate', title: 'Navigate', Icon: Navigation, hasPanel: true },
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
  // Bumped by the search bar's menu button: acts like clicking the rail's
  // Explore item (opens Explore, or closes it if it's already open).
  exploreRequest = 0,
  // Bumped once the first-visit zoom hint is done: opens Explore, never
  // closes it (unlike exploreRequest's toggle).
  exploreOpenRequest = 0,
  // Signal is a floating card beside the closed rail; MapPage owns whether
  // it's open so opening it closes other overlays and vice versa.
  gpsOpen = false,
  onGpsOpenChange,
}) {
  // GPS Signal is a floating card, not a drawer (Oct 2026 redesign), so it
  // isn't remembered as the open drawer — an old saved 'gps' falls back.
  const [activeKey, setActiveKey] = useState(() => {
    const saved = readPersistentState('sidebar-active-panel', 'layers');
    return saved === 'gps' ? 'layers' : saved;
  });
  // Admin only shows on admin accounts (profiles.is_admin), with a badge
  // counting places waiting for review — the same head-only count
  // AdminPanel.jsx uses for its Pending tab.
  const [isAdmin, setIsAdmin] = useState(false);
  const [pendingCount, setPendingCount] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setIsAdmin(false);
    setPendingCount(0);
    if (!user?.id) return undefined;
    fetchIsAdmin(user.id)
      .then((admin) => {
        if (cancelled || !admin) return;
        setIsAdmin(true);
        return supabase
          .from('waypoints')
          .select('id', { count: 'exact', head: true })
          .eq('status', 'pending')
          .then(({ count, error }) => {
            if (!cancelled && !error && typeof count === 'number') setPendingCount(count);
          });
      })
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, [user?.id]);
  const lastExploreRequest = useRef(exploreRequest);
  useEffect(() => {
    if (exploreRequest === lastExploreRequest.current) return;
    lastExploreRequest.current = exploreRequest;
    handleRailClick(RAIL_ITEMS.find((item) => item.key === 'explore'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreRequest]);
  const lastExploreOpenRequest = useRef(exploreOpenRequest);
  useEffect(() => {
    if (exploreOpenRequest === lastExploreOpenRequest.current) return;
    lastExploreOpenRequest.current = exploreOpenRequest;
    if (activeKey === 'explore' && !collapsed) return;
    handleRailClick(RAIL_ITEMS.find((item) => item.key === 'explore'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [exploreOpenRequest]);

  useEffect(() => writePersistentState('sidebar-active-panel', activeKey), [activeKey]);

  // Desktop Layers-panel light redesign (Sept 2026, Figma node 96:1227):
  // the header's "N Active" pill counts how many of the real category
  // groups (placeTypeGroups.js — already the 24-type consolidation) are
  // currently fully toggled on, derived from the same `isGroupFullyVisible`
  // PlaceTypeFilter itself already uses. Not a new piece of state — just a
  // read of what's already tracked by `useTypeVisibility`.
  const isGroupFullyVisible = typeVisibilityProps?.isGroupFullyVisible;
  const activeGroupCount = useMemo(
    () => (isGroupFullyVisible ? GROUP_META.filter((g) => isGroupFullyVisible(g.key)).length : GROUP_META.length),
    [isGroupFullyVisible]
  );

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
    // Signal opens a floating card beside the closed rail (like PlaceCard),
    // so the map and search bar don't shift. Opening anything else closes
    // it via MapPage's closeOtherOverlays.
    if (item.key === 'gps') {
      if (!gpsOpen) track('feature_panel_open', { panel: item.key });
      onGpsOpenChange?.(!gpsOpen);
      return;
    }
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
      {/* Desktop rail redesign (Oct 2026): one light, full-height column —
          logo, the four rail items, then Suggest, Admin (admins only),
          account and version at the bottom. */}
      <div className={styles.rail}>
        <div className={styles.logoIcon}>
          <img src="/android-chrome-512x512.png" alt="Maps By FUTA" width={34} height={34} />
        </div>
        <div className={styles.railDivider} />

        <nav className={styles.railItems}>
          {RAIL_ITEMS.map((item) => {
            const active = item.key === 'gps' ? gpsOpen : !collapsed && activeKey === item.key;
            return (
              <button
                key={item.key}
                type="button"
                className={`${styles.railBtn} ${active ? styles.railBtnActive : ''}`}
                title={item.title}
                aria-current={active ? 'page' : undefined}
                onClick={() => handleRailClick(item)}
              >
                <item.Icon size={22} strokeWidth={1.8} />
                <span>{item.label}</span>
              </button>
            );
          })}
        </nav>

        <div className={styles.railFooter}>
          {/* Slice 13 — always visible; whether it opens the submission
              form or a "sign in first" prompt is decided by
              `onSuggestPlaceClick` (MapPage.jsx). */}
          <button type="button" className={styles.suggestBtn} title="Suggest a Place" onClick={onSuggestPlaceClick}>
            <span className={styles.suggestIcon}>
              <Plus size={22} strokeWidth={2.2} />
            </span>
            <span className={styles.footerLabel}>Suggest</span>
          </button>
          <div className={styles.railDivider} />

          {isAdmin && (
            <button
              type="button"
              className={styles.railBtn}
              title={pendingCount > 0 ? `Admin Panel — ${pendingCount} waiting for review` : 'Admin Panel'}
              onClick={() => {
                track('feature_panel_open', { panel: 'admin' });
                onAdminClick();
              }}
            >
              <span className={styles.adminIcon}>
                <Shield size={22} strokeWidth={1.8} />
                {pendingCount > 0 && <span className={styles.countBadge}>{pendingCount > 99 ? '99+' : pendingCount}</span>}
              </span>
              <span>Admin</span>
            </button>
          )}

          {/* Sign In / account — opens AuthModal either way (Slice 10). */}
          <button
            type="button"
            className={styles.accountBtn}
            title={
              user
                ? 'Account'
                : guestNavRemaining != null
                  ? `Sign In — ${guestNavRemaining} free navigation${guestNavRemaining === 1 ? '' : 's'} left`
                  : 'Sign In'
            }
            onClick={onAuthClick}
          >
            <span className={styles.avatarRing}>
              <span className={styles.avatarInner}>
                {user && (user.user_metadata?.avatar_url || user.user_metadata?.picture) ? (
                  <img className={styles.avatar} src={user.user_metadata.avatar_url || user.user_metadata.picture} alt="" />
                ) : user ? (
                  displayName(user).charAt(0).toLowerCase()
                ) : (
                  <User size={18} strokeWidth={2} />
                )}
              </span>
              {!user && guestNavRemaining != null && <span className={styles.guestBadge}>{guestNavRemaining}</span>}
            </span>
            <span className={styles.footerLabel}>{user ? displayName(user).split(' ')[0] : 'Sign in'}</span>
          </button>

          <span className={styles.version}>v1.0</span>
        </div>
      </div>

      {!collapsed && activeKey === 'layers' && (
        <div className={`${styles.panel} ${styles.panelLayersLight}`}>
          <div className={styles.panelHeader}>
            <div className={styles.panelHeaderTitles}>
              <div className={styles.panelHeaderTitleRow}>
                <span className={styles.panelTitle}>Map Layers</span>
                <span className={styles.activePill}>{activeGroupCount} Active</span>
              </div>
              <span className={styles.panelSubtitle}>Map legend and data reference</span>
            </div>
          </div>
          <div className={styles.panelBody}>
            <LayersPanel map={map} typeVisibilityProps={typeVisibilityProps} desktop />
          </div>
        </div>
      )}

      {!collapsed && activeKey === 'explore' && (
        <div className={`${styles.panel} ${styles.panelExploreDesktop}`}>
          <div className={`${styles.panelBody} ${styles.panelBodyExploreDesktop}`}>
            <ExplorePanel
              picks={explorePicks || []}
              loading={explorePicksLoading}
              variant="full"
              desktop
              onSelect={onExploreSelect}
              onSuggestPlace={onSuggestPlaceClick}
            />
          </div>
        </div>
      )}

      {gpsOpen && (
        <div className={styles.gpsCard}>
          <Suspense fallback={null}>
            <GpsPanel gps={gps} onClose={() => onGpsOpenChange?.(false)} />
          </Suspense>
        </div>
      )}
    </aside>
  );
}