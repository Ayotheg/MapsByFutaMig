import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import styles from './AdminPanel.module.css';
import PointsTab from './PointsTab';
import RoutesTab from './RoutesTab';
import KmlTab from './KmlTab';
import QuickChipsTab from './QuickChipsTab';
import PendingTab from './PendingTab';
import AdminEditModal from './AdminEditModal';
import { useAdminKml } from './useAdminKml';
import InsightsErrorBoundary from '../analytics/InsightsErrorBoundary';

// Slice 14: the Insights tab is lazy-loaded per CLAUDE.md's bundle-size
// policy — this is explicitly the heaviest tab (recharts + presence +
// several queries), a textbook lazy-load candidate, unlike the other five
// tabs here which are small enough to stay in AdminPanel's own chunk
// (AdminPanel itself is already the lazy boundary MapPage.jsx uses for
// all of admin).
const InsightsTab = lazy(() => import('../analytics/InsightsTab'));

// Slice 13: new "Pending" tab for reviewing student-submitted waypoints —
// added as a 5th tab, appended at the end so it doesn't reorder/renumber
// anything an admin's muscle memory already relies on for the other four.
// Slice 14: "Insights" appended as a 6th tab, same precedent.
const TABS = [
  { key: 'points', label: 'Points' },
  { key: 'routes', label: 'Routes' },
  { key: 'kml', label: 'KML Upload' },
  { key: 'chips', label: 'Chips' },
  { key: 'pending', label: 'Pending' },
  { key: 'insights', label: 'Insights' },
];

/**
 * Admin panel — ported from legacy's `#adminOverlay` (index.html ~773–943)
 * + `openAdminPanel`/tab-switching wiring (app.js ~3326–3360) + the
 * pick-coordinate flow (~3389–3416). Reached from `Sidebar.jsx`'s Admin
 * button and (mobile) `MobileSheet.jsx`'s Admin tab, both already gated by
 * `useAdminPin`/`AdminPinGate` (Slice 10) — this component assumes access
 * has already been granted by the time it mounts.
 *
 * Backdrop-click-to-close matches legacy (`adminOverlay`'s own listener,
 * app.js ~3345–3347) — unlike `AdminEditModal`, which reuses `Modal.jsx`'s
 * `closeOnBackdrop=false` default, matching legacy not wiring one there.
 */
export default function AdminPanel({
  map,
  user,
  waypoints,
  segments,
  kmlAnnotations,
  chips,
  onChipsChanged,
  onClose,
  onWaypointsChanged,
  onSegmentsChanged,
  onSelect,
  searchRegister,
}) {

  const [activeTab, setActiveTab] = useState('points');
  const [editContext, setEditContext] = useState(null);
  const [pickingCoord, setPickingCoord] = useState(false);
  const [pickedCoord, setPickedCoord] = useState(null);
  const clickHandlerRef = useRef(null);

  const adminKml = useAdminKml({ map, onSelect, searchRegister });

  // Legacy: `_startPickingCoord`/`_stopPickingCoord` (app.js ~3394–3416) —
  // hides the whole overlay (not just this tab) so the map is fully
  // interactive, waits for one map click, then reopens on the Points tab
  // with the form pre-filled.
  const startPicking = useCallback(() => {
    setPickingCoord(true);
    const handler = (e) => {
      setPickedCoord({ lat: e.latlng.lat, lng: e.latlng.lng });
      setPickingCoord(false);
      setActiveTab('points');
    };
    clickHandlerRef.current = handler;
    map.once('click', handler);
  }, [map]);

  useEffect(
    () => () => {
      if (clickHandlerRef.current) map.off('click', clickHandlerRef.current);
    },
    [map]
  );

  function handleRefresh() {
    // Legacy: `#adminRefresh` ("Sync from Firebase") has no listener
    // anywhere in app.js — a confirmed-dead button, not a feature this
    // port is choosing to skip. Given a live equivalent (refetch) exists
    // and the button's own label promises exactly that, this wires it up
    // rather than leaving another dead button behind — a small, flagged
    // improvement, not a guess dressed up as legacy behavior.
    onWaypointsChanged?.();
    onSegmentsChanged?.();
  }

  return (
    <>
      <div
        className={styles.overlay}
        style={pickingCoord ? { display: 'none' } : undefined}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className={styles.panel}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                style={{ color: 'var(--primary)', flexShrink: 0 }}
              >
                <circle cx="12" cy="8" r="4" />
                <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
              </svg>
              <div className={styles.title}>Admin</div>
            </div>
            <div className={styles.headerRight}>
              <button type="button" className={styles.iconBtn} title="Refresh" onClick={handleRefresh}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
                  <path d="M3 3v5h5" />
                </svg>
              </button>
              <button type="button" className={`${styles.iconBtn} ${styles.iconBtnClose}`} title="Close" onClick={onClose}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>
          </div>

          <div className={styles.tabbar}>
            {TABS.map((t) => (
              <button
                key={t.key}
                type="button"
                className={`${styles.atab} ${activeTab === t.key ? styles.atabActive : ''}`}
                onClick={() => setActiveTab(t.key)}
              >
                {t.label}
              </button>
            ))}
          </div>

          {activeTab === 'points' && (
            <PointsTab
              waypoints={waypoints}
              onEditWaypoint={(wp) => setEditContext({ type: 'waypoint', id: wp.id, data: wp })}
              pickingCoord={pickingCoord}
              onStartPicking={startPicking}
              pickedCoord={pickedCoord}
              onCoordConsumed={() => setPickedCoord(null)}
              onWaypointsChanged={onWaypointsChanged}
            />
          )}
          {activeTab === 'routes' && (
            <RoutesTab
              segments={segments}
              onEditSegment={(seg) => setEditContext({ type: 'segment', id: seg.id, data: seg })}
            />
          )}
          {activeTab === 'kml' && (
            <KmlTab adminKml={adminKml} onEditKmlFeature={(ctx) => setEditContext({ type: 'kml', ...ctx })} />
          )}
          {activeTab === 'chips' && (
            <QuickChipsTab
              user={user}
              chips={chips}
              waypoints={waypoints}
              kmlAnnotations={kmlAnnotations}
              onChipsChanged={onChipsChanged}
            />
          )}
          {activeTab === 'pending' && <PendingTab onRefreshWaypoints={onWaypointsChanged} />}
          {activeTab === 'insights' && (
            <InsightsErrorBoundary>
              <Suspense fallback={<div className={styles.tabContent} style={{ padding: 12, color: 'var(--muted)', fontSize: 11 }}>Loading insights…</div>}>
                <InsightsTab />
              </Suspense>
            </InsightsErrorBoundary>
          )}
        </div>
      </div>

      {editContext && (
        <AdminEditModal
          editContext={editContext}
          onClose={() => setEditContext(null)}
          onWaypointChanged={onWaypointsChanged}
          onSegmentChanged={onSegmentsChanged}
          adminKml={adminKml}
        />
      )}
    </>
  );
}