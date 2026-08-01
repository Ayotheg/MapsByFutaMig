import { lazy, Suspense, useCallback, useRef, useState } from 'react';
import styles from './MobileSheet.module.css';
import LayersPanel from './LayersPanel';
import NavPanel from '../navigation/NavPanel';
import { track } from '../../lib/analytics';

const GpsPanel = lazy(() => import('../navigation/GpsPanel'));

/**
 * Mobile bottom sheet — draggable peek/half/full states with a tab strip,
 * hosting the same Layers panel content as the desktop Sidebar.
 *
 * Ported from legacy `index.html` lines ~1133–1154 (`#mobSheet` markup)
 * and `app.js`'s `initMobileLayout` IIFE (~5542–5760): the state machine
 * (peek/half/full), drag-to-resize with rubber-banding + velocity-based
 * flick detection, tap-handle-to-cycle, and backdrop-tap-to-collapse.
 *
 * Deliberate implementation deviations (behavior unchanged):
 *  - Legacy literally MOVES the shared `.sidebar-panel` DOM nodes into the
 *    sheet on mobile (app.js ~5564–5579) so the same event listeners keep
 *    working. React can't move nodes between trees like that, so this
 *    renders its own `<LayersPanel>` instance instead — the same
 *    component desktop's Sidebar uses, driven by the same lifted
 *    `typeVisibilityProps` from MapPage, so both stay in sync. Since only
 *    one of Sidebar/MobileSheet mounts at a time (see MapPage's isMobile
 *    check), there's never a real double-render.
 *  - Legacy attaches separate touch/mouse listener pairs; this uses the
 *    Pointer Events API (`onPointerDown/Move/Up`) to unify both, same as
 *    the original's own "desktop debugging" mouse fallback intent.
 *  - Legacy toggles `body.mob-sheet-*` classes so OTHER mobile chrome
 *    (FAB cluster, search bar) can react to sheet state too. Slice 7
 *    picks this up: `sheetState` is now an optional controlled prop —
 *    MapPage owns it and passes it down so MobileSearchBar/
 *    MobileSearchOverlay can collapse/raise the sheet (mirrors
 *    `#mobMenuBtn` and `openMobSearch()`'s `setSheetState('peek')` in
 *    app.js ~5838/~5960–5998). Falls back to internal state if unused,
 *    so nothing else calling this component needs to change.
 *
 * GPS Signal and Navigate tabs now render real panels (Slice 9) — same
 * `GpsPanel`/`NavPanel` desktop's Sidebar uses, same lifted `gps` state.
 * `activeTab` is now also an optional controlled prop, same pattern as
 * `sheetState` (Slice 7's own precedent) — needed so `MobileSearchBar`'s
 * nav trigger can force this sheet onto the "navigate" tab, matching
 * legacy's `mobNavTrig` handler.
 *
 * Slice 11: adds the `mobTabAdmin` tab (index.html ~1149, app.js
 * ~5752–5759) — unlike the other three, clicking it doesn't switch this
 * sheet to an in-sheet body; it collapses the sheet to 'peek' and hands
 * off to `onAdminClick` (the same PIN-gated handler desktop's Sidebar
 * Admin button already uses), which opens the real `AdminPanel` overlay.
 */

const TABS = [
  { key: 'layers', label: 'Layers', hasPanel: true },
  { key: 'gps', label: 'Signal', hasPanel: true },
  { key: 'navigate', label: 'Nav', hasPanel: true },
  { key: 'admin', label: 'Admin', hasPanel: false, isAction: true },
  // Slice 13: same isAction shape as 'admin' above — collapses the sheet
  // and hands off to a callback rather than switching this sheet's body,
  // reusing the exact pattern Slice 11 established for 'admin' instead of
  // inventing a second one.
  { key: 'suggest', label: 'Suggest', hasPanel: false, isAction: true },
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
}) {
  const [internalSheetState, setInternalSheetState] = useState('peek');
  const sheetState = controlledSheetState ?? internalSheetState;
  const setSheetState = onSheetStateChange ?? setInternalSheetState;
  const [internalActiveTab, setInternalActiveTab] = useState('layers');
  const activeTab = controlledActiveTab ?? internalActiveTab;
  const setActiveTab = onActiveTabChange ?? setInternalActiveTab;
  const [dragTranslate, setDragTranslate] = useState(null); // px, while dragging
  const sheetRef = useRef(null);
  const dragRef = useRef(null); // { startY, startTranslate, lastY, lastT, velocity }

  const getSnapPx = useCallback((state) => {
    const el = sheetRef.current;
    const fullH = el ? el.offsetHeight : window.innerHeight * 0.92;
    const peekVar =
      parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--mob-sheet-peek')) ||
      76;
    if (state === 'peek') return fullH - peekVar;
    if (state === 'half') return fullH - window.innerHeight * 0.52;
    return fullH - window.innerHeight * 0.92; // 'full'
  }, []);

  const onDragStart = useCallback(
    (e) => {
      // .header carries touch-action:none so empty header space can be
      // dragged like the handle — but that same touch-action applies
      // to its .tab children too (touch-action isn't something a
      // descendant can opt back out of), so without this guard every
      // tap on a tab also starts a drag capture. A stray sub-pixel of
      // finger movement during that tap can then read as a real drag,
      // occasionally enough to cross a snap threshold and jump the
      // sheet to 'full' from what looked like a simple tab tap.
      if (e.target.closest?.('button')) return;
      dragRef.current = {
        startY: e.clientY,
        startTranslate: getSnapPx(sheetState),
        lastY: e.clientY,
        lastT: Date.now(),
        velocity: 0,
      };
      e.target.setPointerCapture?.(e.pointerId);
    },
    [sheetState, getSnapPx]
  );

  const onDragMove = useCallback((e) => {
    const d = dragRef.current;
    if (!d) return;
    const dy = e.clientY - d.startY;
    const now = Date.now();
    const dt = now - d.lastT || 16;
    d.velocity = ((e.clientY - d.lastY) / dt) * 16;
    d.lastY = e.clientY;
    d.lastT = now;

    let next = d.startTranslate + dy;
    const minT = getSnapPx('full');
    const maxT = getSnapPx('peek');
    if (next < minT) next = minT - (minT - next) * 0.2; // rubber-band top
    if (next > maxT) next = maxT + (next - maxT) * 0.2; // rubber-band bottom
    setDragTranslate(next);
  }, [getSnapPx]);

  const onDragEnd = useCallback(
    (e) => {
      const d = dragRef.current;
      dragRef.current = null;
      setDragTranslate(null);
      if (!d) return;

      const dy = e.clientY - d.startY;
      const vy = d.velocity;
      let next = sheetState;
      if (vy < -4) next = 'full';
      else if (vy > 4) next = 'peek';
      else if (dy < -60) next = sheetState === 'peek' ? 'half' : 'full';
      else if (dy > 60) next = sheetState === 'full' ? 'half' : 'peek';
      setSheetState(next);
    },
    [sheetState, setSheetState]
  );

  // A drag that ends via pointerup is handled above, but a pointer
  // sequence can also be interrupted without ever firing pointerup —
  // the browser hands the gesture to something else mid-touch, the OS
  // shows a system UI, a second touch lands, the tab backgrounds, etc.
  // `pointercancel`/`lostpointercapture` are how the platform tells us
  // that happened. Without handling them, `dragRef.current` and
  // `dragTranslate` are left set from the aborted drag; since `style`
  // below applies that stale `dragTranslate` as an inline
  // `transform`+`transition:none`, the sheet stays visually pinned
  // wherever the gesture broke off — ignoring every subsequent
  // sheetState change — and no further drag can "grab" it back because
  // pointer capture was already released elsewhere. That's the stuck-
  // fullscreen-until-refresh symptom: refreshing works only because it
  // resets this in-memory state, not because anything on screen was
  // actually fixed. The fix is to always clear both refs the moment a
  // sequence ends, cancelled or not, so the CSS class for the current
  // (unchanged) sheetState immediately takes back over the transform.
  const onDragCancel = useCallback(() => {
    dragRef.current = null;
    setDragTranslate(null);
  }, []);

  const handleTabClick = useCallback(
    (tab) => {
      if (tab.isAction) {
        // Legacy: `mobTabAdmin` is caught by *two* listeners — the generic
        // `.mob-tab` loop (which strips `active` off every tab first, then
        // no-ops since this tab has no `data-panel`) and its own dedicated
        // handler (app.js ~5753–5758) that collapses the sheet and opens
        // the admin overlay. Net effect: no tab stays highlighted, and the
        // panel opens. `setActiveTab(null)` reproduces the "nothing stays
        // highlighted" half; the highlighted-tab's own panel content stays
        // mounted underneath (matches legacy — the sheet body was never
        // touched, only its tab-strip highlight).
        setActiveTab(null);
        setSheetState('peek');
        if (tab.key === 'suggest') {
          onSuggestPlaceClick?.();
        } else {
          // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9) —
          // mirrors Sidebar.jsx's desktop admin-rail-click tracking.
          track('feature_panel_open', { panel: 'admin' });
          onAdminClick?.();
        }
        return;
      }
      if (!tab.hasPanel) return; // matches Sidebar's inert-tab fallback
      const isActive = activeTab === tab.key && sheetState !== 'peek';
      if (isActive) {
        setSheetState('peek');
        return;
      }
      setActiveTab(tab.key);
      if (sheetState === 'peek') setSheetState('half');
      track('feature_panel_open', { panel: tab.key });
    },
    [activeTab, sheetState, setSheetState, setActiveTab, onAdminClick, onSuggestPlaceClick]
  );

  const handleTap = useCallback(() => {
    setSheetState((s) => (s === 'peek' ? 'half' : s === 'half' ? 'full' : 'peek'));
  }, [setSheetState]);

  const style =
    dragTranslate != null
      ? { transform: `translateY(${dragTranslate}px)`, transition: 'none' }
      : undefined;

  return (
    <>
      <div
        className={`${styles.backdrop} ${sheetState === 'full' ? styles.backdropVisible : ''}`}
        onClick={() => setSheetState('peek')}
      />
      <div
        ref={sheetRef}
        className={`${styles.sheet} ${
          sheetState === 'peek' ? styles.statePeek : sheetState === 'half' ? styles.stateHalf : styles.stateFull
        }`}
        style={style}
      >
        <div
          className={styles.handleWrap}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragCancel}
          onLostPointerCapture={onDragCancel}
          onClick={handleTap}
        >
          <div className={styles.handleBar} />
        </div>
        <div
          className={styles.header}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
          onPointerCancel={onDragCancel}
          onLostPointerCapture={onDragCancel}
        >
          <div className={styles.tabs}>
            {TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={`${styles.tab} ${activeTab === tab.key ? styles.tabActive : ''}`}
                onClick={() => handleTabClick(tab)}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
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
    </>
  );
}