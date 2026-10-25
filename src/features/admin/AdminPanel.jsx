import { useCallback, useEffect, useRef, useState, lazy, Suspense } from 'react';
import styles from './AdminPanel.module.css';
import PointsTab from './PointsTab';
import RoutesTab from './RoutesTab';
import KmlTab from './KmlTab';
import QuickChipsTab from './QuickChipsTab';
import PendingTab from './PendingTab';
import PromotionsTab from './PromotionsTab';
import EventsTab from './EventsTab';
import L from 'leaflet';
import { Footprints, MapPin, Undo2 } from 'lucide-react';
import AdminEditModal from './AdminEditModal';
import { useAdminKml } from './useAdminKml';
import InsightsErrorBoundary from '../analytics/InsightsErrorBoundary';
import { supabase } from '../../lib/supabase';
import { insertKmlLineAsSegment } from './adminSave';
import { lineLength } from './coordInput';

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
// Explore (in-app redesign) deliberately has NO tab here — per explicit
// instruction, featuring a place happens right in the existing waypoint
// edit form (Points tab → click a waypoint → "Feature this place in
// Explore" checkbox in AdminEditModal.jsx), not a separate admin
// surface. See supabase/explore_fields.sql's header comment.
const TABS = [
  { key: 'points', label: 'Points' },
  { key: 'routes', label: 'Routes' },
  { key: 'kml', label: 'KML Upload' },
  { key: 'chips', label: 'Chips' },
  { key: 'pending', label: 'Pending' },
  { key: 'promotions', label: 'Promotions' },
  { key: 'events', label: 'Events' },
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
  const [pendingCount, setPendingCount] = useState(0);
  const [promoCount, setPromoCount] = useState(0);
  const [eventCount, setEventCount] = useState(0);
  const clickHandlerRef = useRef(null);

  const adminKml = useAdminKml({ map, onSelect, searchRegister });

  // Slice 15: a cheap head-only count (no rows fetched) so the "Pending"
  // tab shows a live badge (Figma: MAPSBYFUTA / ADMIN PANEL, node
  // 96:1641) as soon as the panel opens — before the admin has ever
  // clicked into that tab. PendingTab.jsx itself keeps this in sync
  // afterwards (via its own `onCountChange`) every time it loads or
  // mutates a row, so this initial fetch only has to cover the gap
  // between "panel opens" and "Pending tab has been visited once".
  useEffect(() => {
    let cancelled = false;
    supabase
      .from('waypoints')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count, error }) => {
        if (!cancelled && !error && typeof count === 'number') setPendingCount(count);
      });
    // Paid promotions waiting on review — same cheap head-only count.
    supabase
      .from('promotions')
      .select('id', { count: 'exact', head: true })
      .eq('payment_status', 'paid')
      .eq('status', 'pending_review')
      .then(({ count, error }) => {
        if (!cancelled && !error && typeof count === 'number') setPromoCount(count);
      });
    // Events waiting on review (free, or ticketed and paid).
    supabase
      .from('events')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending_review')
      .in('payment_status', ['not_required', 'paid'])
      .then(({ count, error }) => {
        if (!cancelled && !error && typeof count === 'number') setEventCount(count);
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  // ── Map modes: the panel steps aside while the admin works on the map ──
  // Leaflet needs real colours, not CSS variables.
  const brandColour = (name, fallback) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

  // "Move on map" (AdminEditModal): drag the pin, or tap where it goes.
  const [moving, setMoving] = useState(false);
  const moveRef = useRef(null); // { marker, onClick, resolve }
  const endMove = useCallback(
    (keep) => {
      const m = moveRef.current;
      if (!m) return;
      moveRef.current = null;
      map.off('click', m.onClick);
      map.removeLayer(m.marker);
      const { lat, lng } = m.marker.getLatLng();
      m.resolve(keep ? { lat, lng } : null);
      setMoving(false);
    },
    [map]
  );
  const movePin = useCallback(
    (start) =>
      new Promise((resolve) => {
        endMove(false);
        const marker = L.marker([start.lat, start.lng], {
          draggable: true,
          zIndexOffset: 1000,
          icon: L.divIcon({ className: styles.movePin, iconSize: [22, 22], iconAnchor: [11, 11] }),
        }).addTo(map);
        const onClick = (e) => marker.setLatLng(e.latlng);
        map.on('click', onClick);
        moveRef.current = { marker, onClick, resolve };
        map.setView([start.lat, start.lng], Math.max(map.getZoom(), 18));
        setMoving(true);
      }),
    [map, endMove]
  );

  // "Draw path" (Routes tab): tap along a footpath the map doesn't have.
  // Each point can be dragged to adjust it.
  const [drawing, setDrawing] = useState(false);
  const [drawPoints, setDrawPoints] = useState([]);
  const [drawDetails, setDrawDetails] = useState(null); // { name, category, saving, error } once "Next" is pressed
  const drawRef = useRef(null); // { line, vertices: L.Marker[], onClick }
  const syncDraw = useCallback(() => {
    const d = drawRef.current;
    const pts = d.vertices.map((v) => v.getLatLng());
    d.line.setLatLngs(pts);
    setDrawPoints(pts.map(({ lat, lng }) => ({ lat, lng })));
  }, []);
  const addDrawPoint = useCallback(
    (latlng) => {
      const d = drawRef.current;
      const v = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({ className: styles.drawVertex, iconSize: [14, 14], iconAnchor: [7, 7] }),
      }).addTo(map);
      v.on('drag', syncDraw);
      d.vertices.push(v);
      syncDraw();
    },
    [map, syncDraw]
  );
  const endDraw = useCallback(() => {
    const d = drawRef.current;
    if (!d) return;
    drawRef.current = null;
    map.off('click', d.onClick);
    d.vertices.forEach((v) => map.removeLayer(v));
    map.removeLayer(d.line);
    setDrawing(false);
    setDrawPoints([]);
    setDrawDetails(null);
  }, [map]);
  const startDraw = useCallback(() => {
    endDraw();
    const line = L.polyline([], { color: brandColour('--v2-secondary', 'teal'), weight: 5, opacity: 0.9 }).addTo(map);
    const onClick = (e) => addDrawPoint(e.latlng);
    map.on('click', onClick);
    drawRef.current = { line, vertices: [], onClick };
    setDrawing(true);
  }, [map, endDraw, addDrawPoint]);
  const undoDrawPoint = useCallback(() => {
    const d = drawRef.current;
    const v = d?.vertices.pop();
    if (!v) return;
    map.removeLayer(v);
    syncDraw();
  }, [map, syncDraw]);
  const saveDrawnPath = useCallback(async () => {
    const name = drawDetails.name.trim();
    if (!name) {
      setDrawDetails((dd) => ({ ...dd, error: 'Give the path a name.' }));
      return;
    }
    setDrawDetails((dd) => ({ ...dd, saving: true, error: null }));
    try {
      await insertKmlLineAsSegment({
        name,
        description: '',
        category: drawDetails.category,
        points: drawPoints,
        distanceM: Math.round(lineLength(drawPoints)),
      });
      onSegmentsChanged?.();
      endDraw();
      setActiveTab('routes');
    } catch (e) {
      setDrawDetails((dd) => ({ ...dd, saving: false, error: e.message || 'Could not save the path.' }));
    }
  }, [drawDetails, drawPoints, onSegmentsChanged, endDraw]);

  useEffect(
    () => () => {
      endMove(false);
      endDraw();
    },
    [endMove, endDraw]
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
        style={pickingCoord || moving || drawing ? { display: 'none' } : undefined}
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className={styles.panel}>
          <div className={styles.header}>
            <div className={styles.headerLeft}>
              <div className={styles.adminIdentity}>
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  style={{ color: '#7c3aed', flexShrink: 0 }}
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7" />
                </svg>
              </div>
              <div className={styles.headerText}>
                <div className={styles.titleRow}>
                  <div className={styles.title}>Admin Console</div>
                  <span className={styles.livePill}>Live</span>
                </div>
                <div className={styles.subtitle}>Campus GeoDB Management</div>
              </div>
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
            {TABS.map((t) => {
              const active = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  className={`${styles.atab} ${active ? styles.atabActive : ''}`}
                  onClick={() => setActiveTab(t.key)}
                >
                  {active && <span className={styles.atabDot} />}
                  {t.label}
                  {t.key === 'pending' && pendingCount > 0 && (
                    <span className={styles.atabCount}>{pendingCount}</span>
                  )}
                  {t.key === 'promotions' && promoCount > 0 && (
                    <span className={styles.atabCount}>{promoCount}</span>
                  )}
                  {t.key === 'events' && eventCount > 0 && (
                    <span className={styles.atabCount}>{eventCount}</span>
                  )}
                </button>
              );
            })}
          </div>

          {activeTab === 'points' && (
            <PointsTab
              waypoints={waypoints}
              onEditWaypoint={(wp) => setEditContext({ type: 'waypoint', id: wp.id, data: wp })}
              onAddPerson={() =>
                setEditContext({
                  type: 'waypoint',
                  id: null,
                  isNew: true,
                  data: { name: '', description: '', isPerson: true },
                })
              }
              onAddChannel={() =>
                setEditContext({
                  type: 'waypoint',
                  id: null,
                  isNew: true,
                  data: { name: '', description: '', isChannel: true },
                })
              }
              onAddBusiness={() =>
                setEditContext({
                  type: 'waypoint',
                  id: null,
                  isNew: true,
                  data: { name: '', description: '', isBusiness: true },
                })
              }
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
              onDrawPath={startDraw}
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
          {activeTab === 'pending' && (
            <PendingTab onRefreshWaypoints={onWaypointsChanged} onCountChange={setPendingCount} />
          )}
          {activeTab === 'promotions' && <PromotionsTab onCountChange={setPromoCount} onRefreshWaypoints={onWaypointsChanged} />}
          {activeTab === 'events' && <EventsTab onCountChange={setEventCount} />}
          {activeTab === 'insights' && (
            <InsightsErrorBoundary>
              <Suspense fallback={<div className={styles.tabContent} style={{ padding: 12, color: '#94a3b8', fontSize: 11 }}>Loading insights…</div>}>
                <InsightsTab />
              </Suspense>
            </InsightsErrorBoundary>
          )}
        </div>
      </div>

      {moving && (
        <div className={styles.mapBar}>
          <p className={styles.mapBarText}>
            <MapPin size={16} />
            Drag the pin to the right spot, or tap where it should go.
          </p>
          <div className={styles.mapBarActions}>
            <button type="button" className={styles.formCancel} onClick={() => endMove(false)}>
              Cancel
            </button>
            <button type="button" className={styles.formSave} onClick={() => endMove(true)}>
              Use this spot
            </button>
          </div>
        </div>
      )}

      {drawing && !drawDetails && (
        <div className={styles.mapBar}>
          <p className={styles.mapBarText}>
            <Footprints size={16} />
            {drawPoints.length === 0
              ? 'Tap along the path, from the road it leaves to the road it joins.'
              : `${drawPoints.length} point${drawPoints.length === 1 ? '' : 's'} · ${Math.round(lineLength(drawPoints))} m. Drag a point to adjust it.`}
          </p>
          <div className={styles.mapBarActions}>
            <button type="button" className={styles.formCancel} onClick={undoDrawPoint} disabled={!drawPoints.length}>
              <Undo2 size={12} /> Undo
            </button>
            <button type="button" className={styles.formCancel} onClick={endDraw}>
              Cancel
            </button>
            <button
              type="button"
              className={styles.formSave}
              onClick={() => setDrawDetails({ name: '', category: 'footpath', saving: false, error: null })}
              disabled={drawPoints.length < 2}
            >
              Next
            </button>
          </div>
        </div>
      )}

      {drawing && drawDetails && (
        <div className={styles.mapBar}>
          <div className={styles.mapBarForm}>
            <div className={styles.fieldGroup}>
              <label htmlFor="draw-path-name">Name</label>
              <input
                id="draw-path-name"
                type="text"
                value={drawDetails.name}
                onChange={(e) => setDrawDetails((dd) => ({ ...dd, name: e.target.value, error: null }))}
                placeholder="e.g. Behind SOC shortcut"
                autoFocus
              />
            </div>
            <div className={styles.fieldGroup}>
              <label htmlFor="draw-path-category">Type</label>
              <select
                id="draw-path-category"
                value={drawDetails.category}
                onChange={(e) => setDrawDetails((dd) => ({ ...dd, category: e.target.value }))}
              >
                <option value="footpath">Footpath</option>
                <option value="shortcut">Shortcut</option>
              </select>
            </div>
          </div>
          {drawDetails.error && <p className={styles.mapBarError}>{drawDetails.error}</p>}
          <div className={styles.mapBarActions}>
            <button type="button" className={styles.formCancel} onClick={() => setDrawDetails(null)} disabled={drawDetails.saving}>
              Back
            </button>
            <button type="button" className={styles.formSave} onClick={saveDrawnPath} disabled={drawDetails.saving}>
              {drawDetails.saving ? 'Saving…' : 'Save path'}
            </button>
          </div>
        </div>
      )}

      {editContext && (
        <AdminEditModal
          editContext={editContext}
          onMovePin={movePin}
          hidden={moving}
          onClose={() => setEditContext(null)}
          onWaypointChanged={onWaypointsChanged}
          onSegmentChanged={onSegmentsChanged}
          adminKml={adminKml}
        />
      )}
    </>
  );
}