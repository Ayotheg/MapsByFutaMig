import { lazy, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import MapShell from '../features/map/MapShell';
import WaypointLayer from '../features/waypoints/WaypointLayer';
import PlaceCard from '../features/waypoints/PlaceCard';
import { useWaypoints } from '../features/waypoints/useWaypoints';
import { useTypeVisibility } from '../features/legend/useTypeVisibility';
import Sidebar from '../features/legend/Sidebar';
import MobileSheet from '../features/legend/MobileSheet';
import SegmentsLayer from '../features/segments/SegmentsLayer';
import { useSegments } from '../features/segments/useSegments';
import StaticKmlLayer from '../features/kml/StaticKmlLayer';
import { useOSMAnnotations } from '../features/osm-annotations/useOSMAnnotations';
import { useViewMode } from '../features/osm-annotations/useViewMode';
import OSMAnnotationLayer from '../features/osm-annotations/OSMAnnotationLayer';
import ViewModeToggle from '../features/osm-annotations/ViewModeToggle';
import { useSearchIndex } from '../features/search/useSearchIndex';
import DesktopSearchBar from '../features/search/DesktopSearchBar';
import MobileSearchBar from '../features/search/MobileSearchBar';
import MobileSearchOverlay from '../features/search/MobileSearchOverlay';
import QuickChips from '../features/search/QuickChips';
import ChipResultsPanel from '../features/search/ChipResultsPanel';
import { useGpsTracking } from '../features/navigation/useGpsTracking';
import MobFabCluster from '../features/navigation/MobFabCluster';
import { useAuth, friendlyError } from '../features/auth/useAuth';
import { useAdminPin } from '../features/auth/useAdminPin';

// Slice 4: bundle-size policy (CLAUDE.md, effective starting this slice) —
// DetailModal isn't needed for first paint, only mounts on a click, so it's
// lazy-loaded per the exact pattern the policy specifies.
const DetailModal = lazy(() => import('../features/segments/DetailModal'));

// Slice 9: the actual reason this slice is a lazy-load candidate — OSRM
// routing, the "Where to?" panel, turn-by-turn HUD, and voice only mount
// once the user actually opens/starts navigation, matching CLAUDE.md's own
// bundle-size note for this slice. `useGpsTracking` (imported directly
// above, NOT lazy) is a deliberately different call — see its own header
// comment for why the accuracy-gauge/tracking logic has to warm up
// unconditionally on first paint, matching legacy exactly, while the much
// heavier Navigation feature behind it does not.
const NavigationController = lazy(() => import('../features/navigation/NavigationController'));

// Slice 9: ReviewModal was built in Slice 8 with nothing to trigger it —
// this is that trigger landing. Same lazy tier as DetailModal/SaveModal
// per ReviewModal.jsx's own wiring instructions.
const ReviewModal = lazy(() => import('../features/reviews/ReviewModal'));

// Slice 10: explicit "known candidate" in CLAUDE.md's bundle-size policy
// — the auth modal only mounts once opened, same lazy tier as the other
// modals above.
const AuthModal = lazy(() => import('../features/auth/AuthModal'));

// AdminPinGate was previously built (Slice 10) but never rendered anywhere
// — the Sidebar's Admin button had no onClick at all. Wired up here: same
// lazy tier as the other on-demand modals, only mounted once the Admin
// button is actually clicked.
const AdminPinGate = lazy(() => import('../features/auth/AdminPinGate'));

// Slice 11: the real admin panel (waypoint/segment/KML CRUD). Same lazy
// tier as the rest — a large, admin-only surface with no reason to be in
// the first-paint bundle.
const AdminPanel = lazy(() => import('../features/admin/AdminPanel'));

/**
 * First page-level composition of the map with feature chrome around it.
 * Per CLAUDE.md's own note on MapShell being mounted directly at `/`
 * "until a future slice adds chrome around the map" — Slice 2's place
 * card was that chrome; Slice 3 adds the sidebar/legend on top.
 *
 * `useWaypoints()` now lives here instead of inside WaypointLayer — the
 * legend's place-type filter needs the same list (for counts), so this
 * page fetches once and passes it down to both, instead of doubling the
 * Supabase read.
 *
 * Desktop vs mobile chrome is decided once on mount via
 * `window.innerWidth`, matching legacy's own `initMobileLayout`'s
 * `isMobile()` check (app.js ~5546) — that check also only runs once at
 * script load, not on every resize. Kept as an intentional 1:1 match
 * rather than "improving" it into a resize listener.
 *
 * Slice 9 (GPS + Navigation) lands two genuinely different-tier pieces
 * here: `useGpsTracking` is called directly (non-lazy — its warm-up
 * watcher has to start on first paint, matching legacy exactly, and its
 * live state feeds both the sidebar/sheet's GPS panel and the mobile FAB
 * cluster's locate button), while `NavigationController` (OSRM routing +
 * the "Where to?" panel + turn-by-turn HUD + voice) is lazy and only
 * mounted once `navOpen` is set — see its own import comment for why
 * that split, not "the whole slice," is the real lazy-load boundary.
 */
export default function MapPage({ onReadinessChange }) {
  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState(null);
  const [isMobile] = useState(() => window.innerWidth <= 768);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);

  const { waypoints, loading: waypointsLoading, refetch: refetchWaypoints } = useWaypoints();
  const typeVisibilityProps = useTypeVisibility(waypoints);
  const { segments, loading: segmentsLoading, refetch: refetchSegments } = useSegments();
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null;

  // ── Slice 7: search ─────────────────────────────────────────────────
  // `collapsed`/`sheetState` were promoted out of Sidebar/MobileSheet
  // (see their own header comments) so the floating search chrome can
  // shift/collapse in step with them, matching legacy's body-class-driven
  // CSS coupling without reaching for globals.
  const [collapsed, setCollapsed] = useState(false);
  const [sheetState, setSheetState] = useState('peek');
  const [sheetActiveTab, setSheetActiveTab] = useState('layers');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeChip, setActiveChip] = useState(null);

  // ── Slice 6: OSM annotations + dedup ──────────────────────────────────
  // `kmlAnnotations` is reported up by StaticKmlLayer as it loads (named
  // points only); combined with `waypoints` into the live dedup index
  // `useOSMAnnotations` checks each fetched OSM POI against. See
  // useOSMAnnotations.js's header comment for why this is reactive rather
  // than a one-shot check like legacy's.
  const [kmlAnnotations, setKmlAnnotations] = useState([]);
  const dedupIndex = useMemo(
    () => [
      ...waypoints.map((wp) => ({ id: wp.id, lat: wp.lat, lng: wp.lng, name: wp.name, source: 'waypoint' })),
      ...kmlAnnotations.map((a) => ({ ...a, source: 'kml' })),
    ],
    [waypoints, kmlAnnotations]
  );
  const { items: osmItems, snaps: osmSnaps, badgeMerges: osmBadgeMerges } = useOSMAnnotations(dedupIndex);
  const { viewMode, toggle: toggleViewMode, setViewMode } = useViewMode();

  const searchIndex = useSearchIndex({ waypoints, segments, kmlAnnotations });

  // ── Slice 9: GPS + Navigation ──────────────────────────────────────
  // `navOpen` gates whether <NavigationController> is mounted at all
  // (the actual lazy-load boundary — see its import comment above).
  // `navActive` mirrors legacy's `navActive` flag (true only once a route
  // is found and turn-by-turn has started, not just while "Where to?" is
  // open) and is what forces RAW view mode / hides the GPS dot, matching
  // legacy's `_prevInfoMode` save-restore (app.js ~5058–5063, ~5160–5163).
  const [navOpen, setNavOpen] = useState(false);
  const [navActive, setNavActive] = useState(false);
  const [navSeedDest, setNavSeedDest] = useState(null);
  const [reviewTarget, setReviewTarget] = useState(null);
  const navControllerRef = useRef(null);
  const prevViewModeRef = useRef(null);

  const gps = useGpsTracking(map, { hidden: navActive });

  // ── Slice 10: Auth ────────────────────────────────────────────────
  // Called once here, same "lift shared state up, pass down as props"
  // convention `gps`/`viewMode`/`waypoints` already use in this file —
  // this codebase has no React Context anywhere (grep-confirmed), so
  // this doesn't introduce a new pattern for a value only a few
  // components need (Sidebar's footer, the mobile auth FAB, ReviewModal
  // for attribution, and later Slice 11's PIN gate).
  const auth = useAuth();

  // Real boot-readiness signal for App's loading screen — no fake timer,
  // just the same loading flags this page already tracks for its own
  // data hooks (map init, waypoints, segments, session restore).
  useEffect(() => {
    onReadinessChange?.({
      mapReady: !!map,
      waypointsReady: !waypointsLoading,
      segmentsReady: !segmentsLoading,
      authReady: !auth.loading,
    });
  }, [map, waypointsLoading, segmentsLoading, auth.loading, onReadinessChange]);

  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [authModalTab, setAuthModalTab] = useState('login');
  // Legacy's `openModal(tab)` (app.js ~7185–7189): always lands on the
  // profile tab if already signed in, regardless of the tab requested.
  function openAuthModal(tab) {
    setAuthModalTab(auth.user ? 'profile' : (tab || 'login'));
    setAuthModalOpen(true);
  }

  useEffect(() => {
    if (navActive) {
      if (prevViewModeRef.current === null) prevViewModeRef.current = viewMode;
      if (viewMode !== 'raw') setViewMode('raw');
    } else if (prevViewModeRef.current !== null) {
      setViewMode(prevViewModeRef.current);
      prevViewModeRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [navActive]);

  // ── Admin panel (Slice 11) ────────────────────────────────────────────
  // Sidebar's Admin button previously had no onClick handler; a prior
  // stopgap (superseded here) pointed it at `ImportTrigger`'s KML/GPX
  // import panel since that was "the only real admin capability currently
  // built." That stopgap's own premise doesn't hold up against legacy's
  // actual `index.html`: `#adminImportBtn`/`#adminImportInput` — the
  // trigger `ImportTrigger.jsx` was built to eventually "relocate inside
  // the admin overlay" — don't exist anywhere in legacy's real markup.
  // That whole import flow is dead/unreachable in the live legacy app, not
  // "reserved for Slice 11." Clicking Admin now opens the real, ported
  // `#adminOverlay` (`AdminPanel.jsx`) instead. `ImportTrigger` itself has
  // since been unmounted from this page entirely (its fixed bottom-left
  // position overlapped the sidebar rail once collapsed) — its lazy-loaded
  // `KmlImportPanel.jsx` pipeline is unreached until a real entry point is
  // decided on, likely inside `AdminPanel.jsx`.
  const [adminPanelOpen, setAdminPanelOpen] = useState(false);
  const adminPin = useAdminPin(auth.user, openAuthModal);

  function handleAdminClick() {
    adminPin.requestAdminAccess(() => setAdminPanelOpen(true));
  }

  function handleNavLaunch() {
    if (navOpen) {
      navControllerRef.current?.requestLaunchToggle();
    } else {
      setNavOpen(true);
    }
  }

  function handlePlaceCardNavigate(entry) {
    setNavSeedDest(entry);
    setNavOpen(true);
  }

  function handleMobNavTrigger() {
    setSheetActiveTab('navigate');
    setSheetState((s) => (s === 'peek' ? 'half' : s));
  }

  // Legacy: `map.on('click', function() { if (_activeChip) closeResultsPanel(); })`
  // (app.js ~6857–6859) — a map click also dismisses the place card
  // (handled by the effect just below); both listen independently, same
  // as legacy's two separate `map.on('click', ...)` registrations.
  useEffect(() => {
    if (!map) return;
    const handler = () => setActiveChip(null);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map]);

  // Legacy: `map.on('click', function() { if (_isOpen) closeCard(); })` —
  // a click on the map background (not a marker, which already stops
  // propagation in WaypointLayer) dismisses the open place card.
  useEffect(() => {
    if (!map) return;
    const handler = () => setSelected(null);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map]);

  function handleChipClick(chip) {
    setActiveChip((prev) => (prev?.label === chip.label ? null : chip));
  }

  return (
    <>
      <MapShell onMapReady={setMap} />
      {map && (
        <WaypointLayer
          map={map}
          waypoints={waypoints}
          isTypeVisible={typeVisibilityProps.isVisible}
          onSelect={setSelected}
          snaps={osmSnaps}
          badgeMerges={osmBadgeMerges}
        />
      )}
      {map && (
        <SegmentsLayer map={map} segments={segments} onViewDetails={setSelectedSegmentId} />
      )}
      {map && (
        <StaticKmlLayer
          map={map}
          onSelect={setSelected}
          onAnnotationsChange={setKmlAnnotations}
          dedupSnaps={osmSnaps}
          dedupBadges={osmBadgeMerges}
        />
      )}
      {map && <OSMAnnotationLayer map={map} items={osmItems} onSelect={setSelected} />}
      {!isMobile && !navActive && <ViewModeToggle viewMode={viewMode} onToggle={toggleViewMode} />}
      <PlaceCard
        data={selected}
        onClose={() => setSelected(null)}
        onNavigate={handlePlaceCardNavigate}
        collapsed={!isMobile && collapsed}
        isMobile={isMobile}
      />
      {selectedSegment && (
        <Suspense fallback={null}>
          <DetailModal segment={selectedSegment} onClose={() => setSelectedSegmentId(null)} />
        </Suspense>
      )}
      {isMobile ? (
        <MobileSheet
          map={map}
          typeVisibilityProps={typeVisibilityProps}
          sheetState={sheetState}
          onSheetStateChange={setSheetState}
          activeTab={sheetActiveTab}
          onActiveTabChange={setSheetActiveTab}
          gps={gps}
          navActive={navActive}
          onNavLaunch={handleNavLaunch}
          onAdminClick={handleAdminClick}
        />
      ) : (
        <Sidebar
          map={map}
          typeVisibilityProps={typeVisibilityProps}
          collapsed={collapsed}
          onCollapsedChange={setCollapsed}
          gps={gps}
          navActive={navActive}
          onNavLaunch={handleNavLaunch}
          user={auth.user}
          onAuthClick={() => openAuthModal('login')}
          onAdminClick={handleAdminClick}
        />
      )}

      {/* ── Slice 7: search ─────────────────────────────────────────── */}
      {isMobile ? (
        <>
          <MobileSearchBar
            onOpenSearch={() => {
              setMobileSearchOpen(true);
              setSheetState('peek');
            }}
            onToggleSheet={() => setSheetState((s) => (s === 'peek' ? 'half' : 'peek'))}
            onNavigate={handleMobNavTrigger}
            activeChipLabel={activeChip?.label}
          />
          <MobileSearchOverlay
            open={mobileSearchOpen}
            map={map}
            searchIndex={searchIndex}
            onSelect={setSelected}
            onClose={() => setMobileSearchOpen(false)}
          />
        </>
      ) : (
        <DesktopSearchBar
          map={map}
          searchIndex={searchIndex}
          onSelect={setSelected}
          collapsed={collapsed}
          onToggleCollapsed={setCollapsed}
          onManualType={() => setActiveChip(null)}
          activeChipLabel={activeChip?.label}
          onNavigateClick={handleNavLaunch}
        />
      )}
      <QuickChips activeChip={activeChip} onChipClick={handleChipClick} collapsed={collapsed} isMobile={isMobile} />
      <ChipResultsPanel
        activeChip={activeChip}
        waypoints={waypoints}
        waypointsLoaded={!waypointsLoading}
        searchIndex={searchIndex}
        map={map}
        onSelect={setSelected}
        onNavigate={handlePlaceCardNavigate}
        onClose={() => setActiveChip(null)}
        isMobile={isMobile}
        collapsed={collapsed}
      />

      {/* ── Slice 9: GPS + Navigation ────────────────────────────────── */}
      {isMobile && (
        <MobFabCluster
          sheetState={sheetState}
          tracking={gps.isTracking}
          onLocateClick={gps.toggleTracking}
          onViewToggleClick={toggleViewMode}
          onAuthClick={() => openAuthModal('login')}
          user={auth.user}
        />
      )}
      {map && navOpen && (
        <Suspense fallback={null}>
          <NavigationController
            ref={navControllerRef}
            map={map}
            gps={gps}
            searchIndex={searchIndex}
            initialDest={navSeedDest}
            onRequestClose={() => {
              setNavOpen(false);
              setNavSeedDest(null);
            }}
            onActiveChange={setNavActive}
            onArrival={setReviewTarget}
          />
        </Suspense>
      )}
      {reviewTarget && (
        <Suspense fallback={null}>
          <ReviewModal dest={reviewTarget} onClose={() => setReviewTarget(null)} onSubmitted={refetchWaypoints} user={auth.user} />
        </Suspense>
      )}
      {authModalOpen && (
        <Suspense fallback={null}>
          <AuthModal
            initialTab={authModalTab}
            user={auth.user}
            onClose={() => setAuthModalOpen(false)}
            signInWithGoogle={auth.signInWithGoogle}
            signInWithEmail={auth.signInWithEmail}
            signUpWithEmail={auth.signUpWithEmail}
            resetPassword={auth.resetPassword}
            signOut={auth.signOut}
            friendlyError={friendlyError}
          />
        </Suspense>
      )}
      {adminPin.pinOpen && (
        <Suspense fallback={null}>
          <AdminPinGate
            open={adminPin.pinOpen}
            onSuccess={adminPin.handleSuccess}
            onClose={adminPin.closePinGate}
          />
        </Suspense>
      )}
      {map && adminPanelOpen && (
        <Suspense fallback={null}>
          <AdminPanel
            map={map}
            waypoints={waypoints}
            segments={segments}
            onClose={() => setAdminPanelOpen(false)}
            onWaypointsChanged={refetchWaypoints}
            onSegmentsChanged={refetchSegments}
            onSelect={setSelected}
            searchRegister={searchIndex.register}
          />
        </Suspense>
      )}
    </>
  );
}