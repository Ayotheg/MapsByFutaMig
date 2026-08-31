import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { Compass, Rss, Navigation, CirclePlus, CircleUser } from 'lucide-react';
import styles from './MobileSheet.module.css';
import ExplorePanel from '../explore/ExplorePanel';
import { track } from '../../lib/analytics';

const GpsPanel = lazy(() => import('../navigation/GpsPanel'));

/**
 * Mobile bottom chrome — a fixed, non-sliding tab bar (`.navbar`, the
 * redesigned white pill matching the Figma node) that drives a separate
 * `.panel` which grows open above it when a tab is selected, hosting the
 * same Layers panel content as the desktop Sidebar.
 *
 * Ported from legacy `index.html` lines ~1133–1154 (`#mobSheet` markup)
 * and `app.js`'s `initMobileLayout` IIFE (~5542–5760), which drove a
 * single draggable peek/half/full bottom sheet. That drag-to-resize
 * sheet (rubber-banding, velocity-flick detection, a handle strip you
 * dragged) has been retired for the redesign: the navbar and the panel
 * are now two independent fixed elements rather than one physical sheet
 * that carried both. The navbar never moves — it owns tab switching, and
 * re-tapping the open tab is what steps the panel through its two open
 * sizes (`half` -> `full`) or closes it, replacing what the drag gesture
 * used to do. `sheetState` ('peek' | 'half' | 'full') is kept as the
 * vocabulary other mobile chrome (FAB cluster, search bar) already
 * expects, but it now describes the *panel's* size — 'peek' means no
 * panel is open — rather than one sheet's drag position.
 *
 * Deliberate implementation deviations (behavior unchanged from that
 * baseline, beyond dropping the drag itself):
 *  - Legacy literally MOVES the shared `.sidebar-panel` DOM nodes into the
 *    sheet on mobile (app.js ~5564–5579) so the same event listeners keep
 *    working. React can't move nodes between trees like that, so this
 *    renders its own component instances instead (e.g. `<GpsPanel>`/
 *    `<NavPanel>`) — the same components desktop's Sidebar uses, driven
 *    by the same lifted state from MapPage, so both stay in sync. Since
 *    only one of Sidebar/MobileSheet mounts at a time (see MapPage's
 *    isMobile check), there's never a real double-render. The 'layers'
 *    tab is the one exception: it no longer renders LayersPanel at all
 *    on mobile (see the ExplorePanel comment further down) — Layers/
 *    legend content now has no mobile entry point.
 *  - Legacy toggles `body.mob-sheet-*` classes so OTHER mobile chrome
 *    (FAB cluster, search bar) can react to sheet state too. `sheetState`
 *    is an optional controlled prop — MapPage owns it and passes it down
 *    so MobileSearchBar/MobileSearchOverlay can collapse/raise the panel
 *    (mirrors `#mobMenuBtn` and `openMobSearch()`'s `setSheetState('peek')`
 *    in app.js ~5838/~5960–5998). Falls back to internal state if unused,
 *    so nothing else calling this component needs to change.
 *
 * GPS Signal and Navigate tabs render real panels — same `GpsPanel`/
 * `NavPanel` desktop's Sidebar uses, same lifted `gps` state. `activeTab`
 * is also an optional controlled prop, same pattern as `sheetState` —
 * needed so `MobileSearchBar`'s nav trigger can force this onto the
 * "navigate" tab, matching legacy's `mobNavTrig` handler.
 *
 * UI redesign (per UI_REDESIGN_GUIDE.md): the `admin` tab that legacy
 * added here (index.html ~1149, app.js ~5752–5759) has been removed from
 * this mobile tab strip — explicit product decision that Admin is a
 * desktop-only surface. `onAdminClick` stays a declared prop so MapPage's
 * existing wiring doesn't need to change, it's just no longer called from
 * here. Desktop's Sidebar is unaffected and keeps its own Admin button.
 *
 * Tab order/treatment (Figma node 5:746, "Layers Panel" nav): Explore,
 * Signal, Nav, Suggest, Profile — Nav centered and permanently accented
 * (`isPrimary`, see TABS above) since it's the bar's primary action, not
 * just another switchable tab. `Profile` is new here — previously only
 * reachable via `MobFabCluster`'s floating auth button — and reuses the
 * same `onAuthClick`/`user` MapPage already threads to that FAB, opening
 * the same `AuthModal` rather than duplicating sign-in logic.
 */

// Order and treatment match the Figma "Layers Panel" nav node (5:746)
// exactly: Explore, Signal, Nav, Suggest, Profile, with Nav centered and
// carrying a permanent accent pill (`isPrimary`) rather than only
// highlighting on selection — per that design, Nav (starting turn-by-turn
// navigation) is the bar's primary action, so it stays visually prominent
// at rest instead of looking identical to the other tabs until tapped.
const TABS = [
  { key: 'layers', label: 'Explore', Icon: Compass, hasPanel: true },
  { key: 'gps', label: 'Signal', Icon: Rss, hasPanel: true },
  { key: 'navigate', label: 'Nav', Icon: Navigation, hasPanel: true, isPrimary: true },
  // isAction closes the panel and hands off to a callback rather than
  // switching the panel's body.
  { key: 'suggest', label: 'Suggest', Icon: CirclePlus, hasPanel: false, isAction: true },
  { key: 'profile', label: 'Profile', Icon: CircleUser, hasPanel: false, isAction: true },
];

export default function MobileSheet({
  map,
  // No longer read inside this component now that the 'layers' tab
  // renders ExplorePanel instead of LayersPanel (mobile has no Layers
  // entry point anymore — see header comment). Left as an accepted prop
  // rather than removed: MapPage still passes it, and Sidebar (desktop)
  // still needs it for its own separate Layers rail item, so removing it
  // here would just mean MapPage special-cases which component gets it.
  typeVisibilityProps,
  sheetState: controlledSheetState,
  onSheetStateChange,
  activeTab: controlledActiveTab,
  onActiveTabChange,
  gps,
  navActive,
  onNavLaunch,
  onAdminClick,
  onSuggestPlaceClick,
  user,
  onAuthClick,
  explorePicks,
  explorePicksLoading,
  onExploreSelect,
}) {
  const [internalSheetState, setInternalSheetState] = useState('peek');
  const sheetState = controlledSheetState ?? internalSheetState;
  const setSheetState = onSheetStateChange ?? setInternalSheetState;
  const [internalActiveTab, setInternalActiveTab] = useState('layers');
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = onActiveTabChange ?? setInternalActiveTab;

  // Bug fix (reported directly, with a screenshot showing the old
  // "START NAVIGATION" card still sitting behind the new NavHud cards):
  // this sheet's open/closed state (`sheetState`) was never tied to
  // `navActive` at all — `handleNavLaunch` in MapPage.jsx only sets
  // `navOpen`, it never touches the sheet — so if the sheet happened to
  // be open (any tab, not just Nav) when navigation started, that tab's
  // stale panel body just kept sitting there, now underneath NavHud's
  // floating cards instead of replaced by them. Collapsing to 'peek' the
  // moment `navActive` flips true means nothing is left open behind the
  // HUD, regardless of which tab was showing. `navActive` going false
  // again (nav ends) is intentionally left alone — no reason to force
  // any particular sheet state on exit, matches every other close path
  // in this file, which just leaves the sheet wherever it already was.
  useEffect(() => {
    if (navActive) setSheetState('peek');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navActive]);

  const handleTabClick = useCallback(
    (tab) => {
      // Bug fix (reported directly): both the navbar's "Nav" tab and the
      // search bar's nav icon (`MapPage.jsx`'s `onNavigate` prop, fixed
      // the same way) used to open this sheet to the 'navigate' tab,
      // whose body was `NavPanel` — a plain "START NAVIGATION" card that
      // then required a *second* tap on its own button to actually call
      // `onNavLaunch` and mount `NavigationController` (whose
      // `destPanelOpen` already defaults to true, i.e. `NavDestPanel`,
      // the redesigned destination picker, was always one extra tap
      // away). Both entry points now call `onNavLaunch` directly instead,
      // matching how Sidebar's/DesktopSearchBar's equivalent nav buttons
      // already behaved on desktop. `NavPanel` is no longer reachable
      // from either — see this session's flag in UI_REDESIGN_GUIDE.md.
      if (tab.key === 'navigate') {
        setActiveTab(null);
        setSheetState('peek');
        onNavLaunch?.();
        return;
      }
      if (tab.isAction) {
        // Legacy: an action tab is caught by *two* listeners — the generic
        // `.mob-tab` loop (which strips `active` off every tab first, then
        // no-ops since this tab has no `data-panel`) and its own dedicated
        // handler that collapses the sheet and hands off. Net effect: no
        // tab stays highlighted, and the target opens. `setActiveTab(null)`
        // reproduces the "nothing stays highlighted" half; the previously
        // highlighted tab's own panel content stays mounted underneath
        // (matches legacy — the panel body was never touched, only its
        // tab-strip highlight).
        setActiveTab(null);
        setSheetState('peek');
        if (tab.key === 'profile') onAuthClick?.();
        else onSuggestPlaceClick?.();
        return;
      }
      if (!tab.hasPanel) return; // matches Sidebar's inert-tab fallback
      const isOpenOnThisTab = activeTab === tab.key && sheetState !== 'peek';
      if (isOpenOnThisTab) {
        // Re-tapping the already-open tab steps the panel bigger, then
        // closes it — this is what used to be a drag-up/drag-down
        // gesture on the old sheet's handle.
        setSheetState(sheetState === 'half' ? 'full' : 'peek');
        return;
      }
      setActiveTab(tab.key);
      setSheetState('half');
      track('feature_panel_open', { panel: tab.key });
    },
    [activeTab, sheetState, setSheetState, setActiveTab, onSuggestPlaceClick, onAuthClick, onNavLaunch]
  );

  const panelOpen = sheetState !== 'peek';

  return (
    <>
      <div
        className={`${styles.backdrop} ${sheetState === 'full' ? styles.backdropVisible : ''}`}
        onClick={() => setSheetState('peek')}
      />
      <div
        className={`${styles.panel} ${
          !panelOpen ? styles.panelClosed : sheetState === 'full' ? styles.panelFull : styles.panelHalf
        } ${activeTab === 'layers' ? styles.panelLight : ''}`}
        aria-hidden={!panelOpen}
      >
        <div className={styles.body}>
          {/* In-app redesign (per the person's explicit instruction, not
              a UI_REDESIGN_GUIDE default — flagged in that doc's Section
              7 table): the tab keyed 'layers' was already labeled
              "Explore" (TABS above) but rendered LayersPanel — a leftover
              from the tab-strip-only pass that had no Figma reference
              for the panel body yet. This is that body, now that one
              exists (Figma node 1:3, screenshot supplied in-session).
              Layers/legend content has no other mobile entry point after
              this change — accepted trade-off, explicitly confirmed. */}
          {activeTab === 'layers' && (
            <ExplorePanel
              picks={explorePicks}
              loading={explorePicksLoading}
              variant={sheetState === 'full' ? 'full' : 'compact'}
              onViewAll={() => setSheetState('full')}
              onSelect={(wp) => {
                onExploreSelect?.(wp);
                setSheetState('peek');
              }}
            />
          )}
          {activeTab === 'gps' && (
            <Suspense fallback={null}>
              <GpsPanel gps={gps} embedded />
            </Suspense>
          )}
        </div>
      </div>
      {/* UI redesign (per UI_REDESIGN_GUIDE.md, Nav/GPS HUD session, Figma
          node 4:429): navbar switches to its "in navigation" treatment
          while `navActive` is true — same bar, same tabs, just restyled,
          driven entirely by the `navActive` prop this component already
          received (see NavPanel below) and already threaded from MapPage.
          No new prop, no behavior change. */}
      <div className={`${styles.navbar} ${navActive ? styles.navbarNavActive : ''}`}>
        <div className={styles.tabs}>
          {TABS.map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={`${styles.tab} ${tab.isPrimary ? styles.tabPrimary : ''} ${
                activeTab === tab.key && panelOpen ? styles.tabActive : ''
              }`}
              onClick={() => handleTabClick(tab)}
            >
              <tab.Icon className={styles.tabIcon} size={18} strokeWidth={1.8} />
              <span className={styles.tabLabel}>{tab.label}</span>
              {tab.key === 'profile' && user && <span className={styles.signedInDot} />}
            </button>
          ))}
        </div>
      </div>
    </>
  );
}
