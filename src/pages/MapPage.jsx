import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
import { useQuickChips } from '../features/search/useQuickChips';
import { useExplorePicks } from '../features/explore/useExplorePicks';
import DesktopSearchBar from '../features/search/DesktopSearchBar';
import MobileSearchBar from '../features/search/MobileSearchBar';
import MobileSearchOverlay from '../features/search/MobileSearchOverlay';
import QuickChips from '../features/search/QuickChips';
import ChipResultsPanel from '../features/search/ChipResultsPanel';
import { useGpsTracking } from '../features/navigation/useGpsTracking';
import MobFabCluster from '../features/navigation/MobFabCluster';
import { useAuth, friendlyError } from '../features/auth/useAuth';
import { useGuestUsage } from '../features/auth/useGuestUsage';
import { useAdminPin } from '../features/auth/useAdminPin';
import { useSeo } from '../lib/useSeo';
import SubmissionToast from '../features/waypoint-submissions/SubmissionToast';
import { usePresenceTracking } from '../features/analytics/usePresenceTracking';
import { setAnalyticsUser } from '../lib/analytics';
import { readPersistentState, writePersistentState } from '../lib/persistentState';

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

// Slice 13: same lazy tier as the other on-demand modals above — only
// mounts once a signed-in student actually opens "Suggest a place".
const SuggestWaypointModal = lazy(() => import('../features/waypoint-submissions/SuggestWaypointModal'));
const MyWaypointSubmissionsPanel = lazy(() => import('../features/waypoint-submissions/MyWaypointSubmissionsPanel'));

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
  // The live map is a real-time interactive tool, not static content —
  // keep it out of the search index (crawling/indexing a constantly
  // moving GPS/route view adds no search value and can look like thin
  // or duplicate content). The indexable summary of what this page
  // does lives in the static, prerendered "/" landing page instead.
  useSeo({
    title: 'Live Map — Maps By FUTA | FUTA Campus Navigation',
    robots: 'noindex, follow',
  });

  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState(() => readPersistentState('selected-place', null));
  const [isMobile] = useState(() => window.innerWidth <= 768);
  const [selectedSegmentId, setSelectedSegmentId] = useState(() => readPersistentState('selected-segment', null));

  const { waypoints, loading: waypointsLoading, refetch: refetchWaypoints } = useWaypoints();
  const typeVisibilityProps = useTypeVisibility(waypoints);
  const { segments, loading: segmentsLoading, refetch: refetchSegments } = useSegments();
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null;

  // ── Slice 7: search ─────────────────────────────────────────────────
  // `collapsed`/`sheetState` were promoted out of Sidebar/MobileSheet
  // (see their own header comments) so the floating search chrome can
  // shift/collapse in step with them, matching legacy's body-class-driven
  // CSS coupling without reaching for globals.
  const [collapsed, setCollapsed] = useState(() => readPersistentState('sidebar-collapsed', false));
  const [sheetState, setSheetState] = useState(() => readPersistentState('mobile-sheet-state', 'peek'));
  const [sheetActiveTab, setSheetActiveTab] = useState(() => readPersistentState('mobile-sheet-tab', 'layers'));
  const [mobileSearchOpen, setMobileSearchOpen] = useState(() => readPersistentState('mobile-search-open', false));
  const [activeChip, setActiveChip] = useState(() => readPersistentState('active-chip', null));
  const [mapView, setMapView] = useState(() => readPersistentState('map-view', null));

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
  const quickChips = useQuickChips();
  // Explore panel (mobile navbar "Explore" tab + desktop rail button):
  // derived straight from `waypoints` (no separate fetch/table — see
  // useExplorePicks.js's own header comment).
  const explorePicksState = useExplorePicks(waypoints);

  // ── Slice 9: GPS + Navigation ──────────────────────────────────────
  // `navOpen` gates whether <NavigationController> is mounted at all
  // (the actual lazy-load boundary — see its import comment above).
  // `navActive` mirrors legacy's `navActive` flag (true only once a route
  // is found and turn-by-turn has started, not just while "Where to?" is
  // open) and is what forces RAW view mode / hides the GPS dot, matching
  // legacy's `_prevInfoMode` save-restore (app.js ~5058–5063, ~5160–5163).
  const [navOpen, setNavOpen] = useState(() => readPersistentState('navigation-open', false));
  const [navActive, setNavActive] = useState(false);
  const [navSeedDest, setNavSeedDest] = useState(() => readPersistentState('navigation-seeded-destination', null));
  const [reviewTarget, setReviewTarget] = useState(null);
  const navControllerRef = useRef(null);
  const prevViewModeRef = useRef(null);

  const persistMapView = useCallback((view) => {
    const center = view?.center;
    if (!center) return;
    const next = { center: [center.lat, center.lng], zoom: view.zoom };
    setMapView(next);
    writePersistentState('map-view', next);
  }, []);

  useEffect(() => writePersistentState('selected-place', selected), [selected]);
  useEffect(() => writePersistentState('selected-segment', selectedSegmentId), [selectedSegmentId]);
  useEffect(() => writePersistentState('sidebar-collapsed', collapsed), [collapsed]);
  useEffect(() => writePersistentState('mobile-sheet-state', sheetState), [sheetState]);
  useEffect(() => writePersistentState('mobile-sheet-tab', sheetActiveTab), [sheetActiveTab]);
  useEffect(() => writePersistentState('active-chip', activeChip), [activeChip]);
  useEffect(() => writePersistentState('navigation-open', navOpen), [navOpen]);
  useEffect(() => writePersistentState('navigation-seeded-destination', navSeedDest), [navSeedDest]);
  useEffect(() => writePersistentState('mobile-search-open', mobileSearchOpen), [mobileSearchOpen]);

  const gps = useGpsTracking(map, { hidden: navActive });

  // ── Slice 10: Auth ────────────────────────────────────────────────
  // Called once here, same "lift shared state up, pass down as props"
  // convention `gps`/`viewMode`/`waypoints` already use in this file —
  // this codebase has no React Context anywhere (grep-confirmed), so
  // this doesn't introduce a new pattern for a value only a few
  // components need (Sidebar's footer, the mobile auth FAB, ReviewModal
  // for attribution, and later Slice 11's PIN gate).
  const auth = useAuth();

  // ── Slice 14: analytics identity + live presence ────────────────────
  // `setAnalyticsUser` keeps src/lib/analytics.js's track() calls carrying
  // the right user_id without every call site threading it through.
  // `usePresenceTracking` mounts the 'site-presence' Realtime channel
  // once here (same "call once, thread down as needed" convention as
  // useAuth/useGpsTracking above) — `updatePresence` is exposed to a
  // handful of call sites below (search-open, nav-start, admin-panel-
  // open, review-modal-open) so LiveTab.jsx's admin view shows something
  // more useful than a bare path.
  useEffect(() => {
    setAnalyticsUser(auth.user?.id ?? null);
  }, [auth.user]);
  const presence = usePresenceTracking(auth.user);

  // ── Guest navigation limit ────────────────────────────────────────
  // New requirement: signed-out visitors get `guestUsage.limit` (3) free
  // successful navigations before "Start Navigation" is blocked in favor
  // of the auth modal. Only gates navigation — browsing/search/place
  // cards stay open for guests. See useGuestUsage.js for the storage
  // model and NavigationController.jsx's header comment for why the gate
  // lives inside `startNavigation()` rather than only at first open.
  const guestUsage = useGuestUsage();
  const guestNavBlocked = !auth.user && guestUsage.limitReached;

  // Once someone actually signs in, their guest tally is irrelevant going
  // forward — clear it rather than leaving stale count around.
  useEffect(() => {
    if (auth.user) guestUsage.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auth.user]);

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
  // New: set only when the modal is opened because a guest hit the
  // navigation limit, so AuthModal can show a short explanation instead
  // of opening silently. Cleared on every other open path.
  const [authModalMessage, setAuthModalMessage] = useState(null);
  // Legacy's `openModal(tab)` (app.js ~7185–7189): always lands on the
  // profile tab if already signed in, regardless of the tab requested.
  function openAuthModal(tab, message = null) {
    closeOtherOverlays('auth');
    setAuthModalTab(auth.user ? 'profile' : (tab || 'login'));
    setAuthModalMessage(message);
    setAuthModalOpen(true);
  }

  // Shown whenever a guest tries to navigate after using up their free
  // tries — lands on Create Account since that's the likely next step,
  // but the modal still offers Sign In for guests who already have one.
  function handleGuestNavBlocked() {
    openAuthModal(
      'signup',
      `You've used all ${guestUsage.limit} free navigations as a guest. Sign in or create an account to keep navigating.`
    );
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

  // Bug fix (reported directly): "only the HUD should be up" once
  // navigation starts. `MobileSheet.jsx` already collapses its own sheet
  // on `navActive` (separate fix, same report), but that only covers the
  // Explore/Signal/Nav/Suggest panel — everything else that can be open
  // on top of the map is state MapPage owns directly and was never tied
  // to `navActive` at all: a selected waypoint's `PlaceCard` (this is
  // exactly how `handlePlaceCardNavigate` launches nav in the first
  // place — tapping "Navigate" on a card never closed that same card),
  // an open route-segment `DetailModal`, an expanded `ChipResultsPanel`
  // (`activeChip`), and the full-screen `MobileSearchOverlay`. All four
  // get cleared here, once, the moment `navActive` flips true.
  // Deliberately NOT touched: `authModalOpen`/`adminPanelOpen`/
  // `suggestModalOpen`/`mySubmissionsOpen`/`reviewTarget`. Those are
  // blocking modals for a deliberate task the person is mid-way through,
  // not ambient cards left open around the map — and in the auth case,
  // `handleNavLaunch`/`handleGuestNavBlocked` already guarantee nav can't
  // even start while that modal is what's blocking it. Flagged for a
  // future session rather than guessed at if that turns out wrong.
  useEffect(() => {
    if (navActive) {
      setSelected(null);
      setSelectedSegmentId(null);
      setActiveChip(null);
      setMobileSearchOpen(false);
    }
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
    adminPin.requestAdminAccess(() => {
      closeOtherOverlays('admin');
      setAdminPanelOpen(true);
      presence.updatePresence('in admin panel');
    });
  }

  // ── Slice 13: student waypoint submissions ────────────────────────────
  // `suggestModalOpen`/`mySubmissionsOpen` are two separate surfaces: the
  // submission form itself, and a signed-in student's own past-
  // submissions list. `pickedCoord`/`onCoordConsumed` reuse AdminPanel's
  // exact "hide the whole overlay, wait for one map click" flow
  // (`startPicking` there), rather than a second, separate implementation
  // of the same interaction.
  const [suggestModalOpen, setSuggestModalOpen] = useState(false);
  const [mySubmissionsOpen, setMySubmissionsOpen] = useState(false);
  const [suggestPickedCoord, setSuggestPickedCoord] = useState(null);
  const [submissionToast, setSubmissionToast] = useState(null);
  const dismissSubmissionToast = useCallback(() => setSubmissionToast(null), []);
  const suggestClickHandlerRef = useRef(null);

  useEffect(
    () => () => {
      if (suggestClickHandlerRef.current) map?.off('click', suggestClickHandlerRef.current);
    },
    [map]
  );

  // Bug fix (reported directly): "I can open three different things at
  // once and they won't give room for each other, the whole screen now
  // looks clustered." Every surface below (`selected`'s `PlaceCard`,
  // `selectedSegmentId`'s `DetailModal`, `activeChip`'s
  // `ChipResultsPanel`, `mobileSearchOpen`'s full-screen overlay,
  // `sheetState`'s mobile sheet, and the suggest/submissions/auth/admin/
  // review modals) used to be able to be open at the same time as any
  // other, since each was only ever opened or closed on its own. This
  // enforces the opposite: opening any one of them closes every other
  // one first, so at most one thing is ever stacked on top of the map —
  // matches this session's earlier `navActive` version of the same idea
  // (see the effect right below), just generalized to every open/close
  // path instead of only the nav-start moment. `keep` is whichever
  // surface is about to open, so its own state isn't clobbered by the
  // call that's opening it.
  const closeOtherOverlays = useCallback((keep) => {
    if (keep !== 'selected') setSelected(null);
    if (keep !== 'segment') setSelectedSegmentId(null);
    if (keep !== 'chip') setActiveChip(null);
    if (keep !== 'search') setMobileSearchOpen(false);
    if (keep !== 'sheet') setSheetState('peek');
    if (keep !== 'suggest') setSuggestModalOpen(false);
    if (keep !== 'submissions') setMySubmissionsOpen(false);
    if (keep !== 'review') setReviewTarget(null);
    if (keep !== 'admin') setAdminPanelOpen(false);
    if (keep !== 'auth') setAuthModalOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Same principle as `closeOtherOverlays` above, applied to the mobile
  // sheet specifically: every path that opens it (tab taps inside
  // `MobileSheet.jsx`, the search bar's "toggle sheet" button) goes
  // through `onSheetStateChange`, so wrapping that one prop covers all of
  // them at once rather than editing each call site inside that file.
  // Collapsing the sheet (`next === 'peek'`) doesn't need to close
  // anything else — only opening it does.
  const handleSheetStateChange = useCallback(
    (next) => {
      if (next !== 'peek') closeOtherOverlays('sheet');
      setSheetState(next);
    },
    [closeOtherOverlays]
  );

  const handleSelectPlace = useCallback(
    (wp) => {
      closeOtherOverlays('selected');
      setSelected(wp);
    },
    [closeOtherOverlays]
  );

  const handleViewSegment = useCallback(
    (id) => {
      closeOtherOverlays('segment');
      setSelectedSegmentId(id);
    },
    [closeOtherOverlays]
  );

  function handleSuggestPlaceClick() {
    // A sign-in prompt instead of letting the form open and fail at the
    // RLS layer.
    if (!auth.user) {
      openAuthModal('login', 'Sign in to suggest a place on the map.');
      return;
    }
    closeOtherOverlays('suggest');
    setSuggestModalOpen(true);
  }

  function handleRequestMapPick() {
    if (!map) return;
    setSuggestModalOpen(false);
    const handler = (e) => {
      setSuggestPickedCoord({ lat: e.latlng.lat, lng: e.latlng.lng });
      setSuggestModalOpen(true);
    };
    suggestClickHandlerRef.current = handler;
    map.once('click', handler);
  }

  function handleNavLaunch() {
    if (guestNavBlocked) {
      handleGuestNavBlocked();
      return;
    }
    if (navOpen) {
      navControllerRef.current?.requestLaunchToggle();
    } else {
      setNavOpen(true);
      presence.updatePresence('navigating');
    }
  }

  function handlePlaceCardNavigate(entry) {
    if (guestNavBlocked) {
      handleGuestNavBlocked();
      return;
    }
    setNavSeedDest(entry);
    setNavOpen(true);
    presence.updatePresence(`navigating to ${entry?.name || 'a destination'}`);
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
    const same = activeChip && (chip.id ? activeChip.id === chip.id : activeChip.label === chip.label);
    if (same) {
      setActiveChip(null);
      return;
    }
    closeOtherOverlays('chip');
    setActiveChip(chip);
  }

  return (
    <>
      <MapShell onMapReady={setMap} initialView={mapView} onViewChange={persistMapView} />
      {map && (
        <WaypointLayer
          map={map}
          waypoints={waypoints}
          isTypeVisible={typeVisibilityProps.isVisible}
          onSelect={handleSelectPlace}
          snaps={osmSnaps}
          badgeMerges={osmBadgeMerges}
        />
      )}
      {map && (
        <SegmentsLayer map={map} segments={segments} onViewDetails={handleViewSegment} />
      )}
      {map && (
        <StaticKmlLayer
          map={map}
          onSelect={handleSelectPlace}
          onAnnotationsChange={setKmlAnnotations}
          dedupSnaps={osmSnaps}
          dedupBadges={osmBadgeMerges}
        />
      )}
      {map && <OSMAnnotationLayer map={map} items={osmItems} onSelect={handleSelectPlace} />}
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
          onSheetStateChange={handleSheetStateChange}
          activeTab={sheetActiveTab}
          onActiveTabChange={setSheetActiveTab}
          gps={gps}
          navActive={navActive}
          onNavLaunch={handleNavLaunch}
          onAdminClick={handleAdminClick}
          onSuggestPlaceClick={handleSuggestPlaceClick}
          user={auth.user}
          onAuthClick={() => openAuthModal('login')}
          explorePicks={explorePicksState.picks}
          explorePicksLoading={waypointsLoading}
          onExploreSelect={handleSelectPlace}
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
          onSuggestPlaceClick={handleSuggestPlaceClick}
          guestNavRemaining={auth.user ? null : guestUsage.remaining}
          explorePicks={explorePicksState.picks}
          explorePicksLoading={waypointsLoading}
          onExploreSelect={handleSelectPlace}
        />
      )}

      {/* ── Slice 7: search ─────────────────────────────────────────── */}
      {isMobile ? (
        <>
          <MobileSearchBar
            onOpenSearch={() => {
              closeOtherOverlays('search');
              setMobileSearchOpen(true);
              presence.updatePresence('searching');
            }}
            onToggleSheet={() => handleSheetStateChange(sheetState === 'peek' ? 'half' : 'peek')}
            onNavigate={handleNavLaunch}
            activeChipLabel={activeChip?.label}
          />
          <MobileSearchOverlay
            open={mobileSearchOpen}
            map={map}
            searchIndex={searchIndex}
            onSelect={handleSelectPlace}
            onClose={() => setMobileSearchOpen(false)}
          />
        </>
      ) : (
        <DesktopSearchBar
          map={map}
          searchIndex={searchIndex}
          onSelect={handleSelectPlace}
          collapsed={collapsed}
          onToggleCollapsed={setCollapsed}
          onManualType={() => setActiveChip(null)}
          activeChipLabel={activeChip?.label}
          onNavigateClick={handleNavLaunch}
        />
      )}
      <QuickChips chips={quickChips.chips} activeChip={activeChip} onChipClick={handleChipClick} collapsed={collapsed} isMobile={isMobile} />
      <ChipResultsPanel
        activeChip={activeChip}
        waypoints={waypoints}
        kmlAnnotations={kmlAnnotations}
        waypointsLoaded={!waypointsLoading}
        searchIndex={searchIndex}
        map={map}
        onSelect={handleSelectPlace}
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
          guestNavRemaining={auth.user ? null : guestUsage.remaining}
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
            explorePicks={explorePicksState.picks}
            onRequestClose={() => {
              setNavOpen(false);
              setNavSeedDest(null);
            }}
            onActiveChange={setNavActive}
            onArrival={(dest) => {
              closeOtherOverlays('review');
              setReviewTarget(dest);
              presence.updatePresence(`reviewing ${dest?.name || 'a place'}`);
            }}
            guestNavBlocked={guestNavBlocked}
            onGuestBlocked={handleGuestNavBlocked}
            onNavigationSuccess={() => {
              if (!auth.user) guestUsage.recordUse();
            }}
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
            message={authModalMessage}
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
            user={auth.user}
            waypoints={waypoints}
            segments={segments}
            kmlAnnotations={kmlAnnotations}
            chips={quickChips.chips}
            onChipsChanged={quickChips.refetch}
            onClose={() => setAdminPanelOpen(false)}
            onWaypointsChanged={refetchWaypoints}
            onSegmentsChanged={refetchSegments}
            onSelect={handleSelectPlace}
            searchRegister={searchIndex.register}
          />
        </Suspense>
      )}

      {/* ── Slice 13: student waypoint submissions ─────────────────── */}
      {suggestModalOpen && (
        <Suspense fallback={null}>
          <SuggestWaypointModal
            user={auth.user}
            waypoints={waypoints}
            pickedCoord={suggestPickedCoord}
            onCoordConsumed={() => setSuggestPickedCoord(null)}
            onRequestMapPick={handleRequestMapPick}
            onClose={() => setSuggestModalOpen(false)}
            onSubmitted={(message) => setSubmissionToast(message)}
            onViewSubmissions={() => {
              closeOtherOverlays('submissions');
              setMySubmissionsOpen(true);
            }}
          />
        </Suspense>
      )}
      {mySubmissionsOpen && (
        <Suspense fallback={null}>
          <MyWaypointSubmissionsPanel user={auth.user} onClose={() => setMySubmissionsOpen(false)} />
        </Suspense>
      )}
      <SubmissionToast message={submissionToast} onDismiss={dismissSubmissionToast} />
    </>
  );
}