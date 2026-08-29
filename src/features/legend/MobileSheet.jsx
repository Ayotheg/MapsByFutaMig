import { lazy, Suspense, useCallback, useState } from 'react';
import { Compass, Rss, Navigation, CirclePlus, CircleUser } from 'lucide-react';
import styles from './MobileSheet.module.css';
import LayersPanel from './LayersPanel';
import NavPanel from '../navigation/NavPanel';
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
 *    renders its own `<LayersPanel>` instance instead — the same
 *    component desktop's Sidebar uses, driven by the same lifted
 *    `typeVisibilityProps` from MapPage, so both stay in sync. Since only
 *    one of Sidebar/MobileSheet mounts at a time (see MapPage's isMobile
 *    check), there's never a real double-render.
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
}) {
  const [internalSheetState, setInternalSheetState] = useState('peek');
  const sheetState = controlledSheetState ?? internalSheetState;
  const setSheetState = onSheetStateChange ?? setInternalSheetState;
  const [internalActiveTab, setInternalActiveTab] = useState('layers');
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = onActiveTabChange ?? setInternalActiveTab;

  const handleTabClick = useCallback(
    (tab) => {
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
    [activeTab, sheetState, setSheetState, setActiveTab, onSuggestPlaceClick, onAuthClick]
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
        }`}
        aria-hidden={!panelOpen}
      >
        <div className={styles.body}>
          {activeTab === 'layers' && (
            <LayersPanel map={map} typeVisibilityProps={typeVisibilityProps} />
          )}
          {activeTab === 'gps' && (
            <Suspense fallback={null}>
              <GpsPanel gps={gps} embedded />
            </Suspense>
          )}
          {activeTab === 'navigate' && <NavPanel navActive={navActive} onLaunch={onNavLaunch} />}
        </div>
      </div>
      <div className={styles.navbar}>
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
