import { useCallback, useRef, useState } from 'react';
import styles from './MobileSheet.module.css';
import LayersPanel from './LayersPanel';

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
 * Not ported: GPS/Navigate/Admin tabs are rendered (real legacy chrome)
 * but inert — their panels don't exist until Slice 9/Slice 11. Tapping
 * them does nothing, matching Sidebar's same rail-button fallback.
 */

const TABS = [
  { key: 'layers', label: 'Layers', hasPanel: true },
  { key: 'gps', label: 'Signal', hasPanel: false },
  { key: 'navigate', label: 'Nav', hasPanel: false },
];

export default function MobileSheet({ map, typeVisibilityProps, sheetState: controlledSheetState, onSheetStateChange }) {
  const [internalSheetState, setInternalSheetState] = useState('peek');
  const sheetState = controlledSheetState ?? internalSheetState;
  const setSheetState = onSheetStateChange ?? setInternalSheetState;
  const [activeTab, setActiveTab] = useState('layers');
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

  const handleTabClick = useCallback(
    (tab) => {
      if (!tab.hasPanel) return; // matches Sidebar's inert-tab fallback
      const isActive = activeTab === tab.key && sheetState !== 'peek';
      if (isActive) {
        setSheetState('peek');
        return;
      }
      setActiveTab(tab.key);
      if (sheetState === 'peek') setSheetState('half');
    },
    [activeTab, sheetState, setSheetState]
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
          onClick={handleTap}
        >
          <div className={styles.handleBar} />
        </div>
        <div
          className={styles.header}
          onPointerDown={onDragStart}
          onPointerMove={onDragMove}
          onPointerUp={onDragEnd}
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
        </div>
      </div>
    </>
  );
}
