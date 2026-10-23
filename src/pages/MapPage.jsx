import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react';

import MapShell from '../features/map/MapShell';
import ZoomHint from '../features/map/ZoomHint';
import ChannelPrompt from '../features/whatsapp/ChannelPrompt';
import MarketingOptInPrompt from '../features/auth/MarketingOptInPrompt';
import { setTawkHidden } from '../lib/tawk';
import { useLocation } from 'react-router-dom';
import WaypointLayer from '../features/waypoints/WaypointLayer';
import PlaceCard from '../features/waypoints/PlaceCard';
import { useWaypoints } from '../features/waypoints/useWaypoints';
import { useTypeVisibility } from '../features/legend/useTypeVisibility';
import Sidebar from '../features/legend/Sidebar';
import MobileSheet from '../features/legend/MobileSheet';
import { useSegments } from '../features/segments/useSegments';
import { useOSMAnnotations } from '../features/osm-annotations/useOSMAnnotations';
import { useViewMode } from '../features/osm-annotations/useViewMode';
import OSMAnnotationLayer from '../features/osm-annotations/OSMAnnotationLayer';
import { useSearchIndex } from '../features/search/useSearchIndex';
import { useQuickChips } from '../features/search/useQuickChips';
import { useExplorePicks } from '../features/explore/useExplorePicks';
import DesktopSearchBar from '../features/search/DesktopSearchBar';
import MobileSearchBar from '../features/search/MobileSearchBar';
import MobileSearchOverlay from '../features/search/MobileSearchOverlay';
import QuickChips from '../features/search/QuickChips';
import ChipResultsPanel from '../features/search/ChipResultsPanel';
import { useGpsTracking } from '../features/navigation/useGpsTracking';
import { useAuth, friendlyError } from '../features/auth/useAuth';
import { useGuestUsage } from '../features/auth/useGuestUsage';
import { flushPendingNavCompletions, reportNavigationCompletion } from '../features/navigation/navCompletionClient';
import { useAdminPin } from '../features/auth/useAdminPin';
import { useSeo } from '../lib/useSeo';
import { useOnlineStatus } from '../lib/useOnlineStatus';
import SubmissionToast from '../features/waypoint-submissions/SubmissionToast';
import OfflineBanner from '../features/offline/OfflineBanner';
import { usePresenceTracking } from '../features/analytics/usePresenceTracking';
import { setAnalyticsUser } from '../lib/analytics';
import { readPersistentState, writePersistentState } from '../lib/persistentState';
import { markMapActive, reloadIfIdle, resetIdleMapSession } from '../features/navigation/mapSession';
import DetailModal from '../features/segments/DetailModal';
import NavigationController from '../features/navigation/NavigationController';
import ReviewModal from '../features/reviews/ReviewModal';
import AuthModal from '../features/auth/AuthModal';
import AdminPinGate from '../features/auth/AdminPinGate';
import AdminPanel from '../features/admin/AdminPanel';
import SuggestWaypointModal from '../features/waypoint-submissions/SuggestWaypointModal';
import MyWaypointSubmissionsPanel from '../features/waypoint-submissions/MyWaypointSubmissionsPanel';
import MapPickBanner from '../features/map/MapPickBanner';
import { osmCardData, waypointCardData } from '../features/waypoints/placeCardData';
import { rememberVisit } from '../features/reviews/pendingReview';

// Only shown an hour after a visit — not needed for first paint.
const ReviewPrompt = lazy(() => import('../features/reviews/ReviewPrompt'));

// Stable empty reference for the retired StaticKmlLayer's `kmlAnnotations`
// data — see the comment where it's used below for why this stays a
// constant instead of ripping the prop out everywhere at once.
const EMPTY_KML_ANNOTATIONS = [];

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
const CHAT_SETTLE_MS = 20 * 1000;

export default function MapPage({ onReadinessChange }) {
  // First, before any state below reads storage: a visit after a long
  // absence starts fresh (mapSession.js).
  useState(() => resetIdleMapSession());

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
  // Not restored across reloads (nor are the segment, chip and mobile
  // search below): Explore opens on every load (handleZoomHintDone), and a
  // restored card or panel would block it. Only an active trip comes back.
  const [selected, setSelected] = useState(null);
  const [isMobile] = useState(() => window.innerWidth <= 768);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);

  // Live connectivity signal, separate from waypointsOffline/segmentsOffline
  // below — those only flip on a fetch outcome (a cache fallback or a
  // timeout), so they never notice the browser going offline mid-session
  // with nothing new being fetched. This mirrors the browser's own
  // `online`/`offline` events instead, so OfflineBanner reacts the instant
  // connectivity actually drops, not just the next time something tries
  // to talk to Supabase.
  const browserOnline = useOnlineStatus();

  const {
    waypoints,
    loading: waypointsLoading,
    isOffline: waypointsOffline,
    cachedAt: waypointsCachedAt,
    refetch: refetchWaypoints,
  } = useWaypoints();
  const typeVisibilityProps = useTypeVisibility(waypoints);
  const {
    segments,
    loading: segmentsLoading,
    isOffline: segmentsOffline,
    cachedAt: segmentsCachedAt,
    refetch: refetchSegments,
  } = useSegments();
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null;

  // ── Slice 7: search ─────────────────────────────────────────────────
  // `collapsed`/`sheetState` were promoted out of Sidebar/MobileSheet
  // (see their own header comments) so the floating search chrome can
  // shift/collapse in step with them, matching legacy's body-class-driven
  // CSS coupling without reaching for globals.
  const [collapsed, setCollapsed] = useState(() => readPersistentState('sidebar-collapsed', false));
  // Not restored: the sheet opens on Explore, so a sheet left open made
  // Explore pop up by itself on every later visit.
  const [sheetState, setSheetState] = useState('peek');
  const [sheetActiveTab, setSheetActiveTab] = useState(() => readPersistentState('mobile-sheet-tab', 'layers'));
  // Desktop search bar's menu button → Sidebar opens/closes Explore.
  const [exploreRequest, setExploreRequest] = useState(0);
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeChip, setActiveChip] = useState(null);
  const [mapView, setMapView] = useState(() => readPersistentState('map-view', null));

  // ── Slice 6: OSM annotations + dedup ──────────────────────────────────
  // `kmlAnnotations` used to come from StaticKmlLayer.jsx (the 12
  // bundled `public/kml/test*.kml` files) — deleted along with those
  // files once their re-annotated points were slated to move into the
  // `waypoints` table directly instead. Kept as a stable empty constant
  // rather than ripping the prop out of QuickChipsTab/ChipResultsPanel/
  // useSearchIndex/chipConfig.js too: all four already treat it as
  // optional (`(kmlAnnotations || [])`), so `[]` is behaviorally
  // identical to "no KML layer" with no risk of a half-finished
  // multi-file prop removal breaking search/admin in the meantime. Once
  // the re-annotated points are confirmed live in `waypoints`, this
  // constant (and the now-unused prop threading downstream) can come out
  // for real.
  const kmlAnnotations = EMPTY_KML_ANNOTATIONS;
  const dedupIndex = useMemo(
    () => [
      ...waypoints.map((wp) => ({ id: wp.id, lat: wp.lat, lng: wp.lng, name: wp.name, source: 'waypoint' })),
      ...kmlAnnotations.map((a) => ({ ...a, source: 'kml' })),
    ],
    [waypoints, kmlAnnotations]
  );
  const { items: osmItems, snaps: osmSnaps, badgeMerges: osmBadgeMerges } = useOSMAnnotations(dedupIndex);
  // Everything the map shows as a pin, in the shape the mid-trip "Nearby
  // places" list needs: snapped position + the same card data a pin tap
  // opens.
  const nearbyCandidates = useMemo(
    () => [
      ...waypoints
        .filter((wp) => !wp.isPerson && !wp.isChannel && !wp.isBusiness && wp.lat != null && wp.lng != null)
        .map((wp) => {
          const key = `waypoint:${wp.id}`;
          const card = waypointCardData(wp, osmSnaps?.[key], osmBadgeMerges?.[key]);
          return { key, id: wp.id, name: wp.name, type: wp.type, lat: card.lat, lng: card.lng, card };
        }),
      ...osmItems.map((item) => ({
        key: `osm:${item.name}:${item.lat}:${item.lng}`,
        id: null,
        name: item.name,
        type: 'poi',
        lat: item.lat,
        lng: item.lng,
        card: osmCardData(item),
      })),
    ],
    [waypoints, osmItems, osmSnaps, osmBadgeMerges]
  );
  // The desktop INFO/RAW toggle was removed (Oct 2026); the map stays in
  // INFO mode except while navigating, which still switches to RAW itself.
  // ViewModeToggle.jsx is kept in features/osm-annotations/ in case it's
  // wanted back.
  const { viewMode, setViewMode } = useViewMode();

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
  const navActiveRef = useRef(false);
  navActiveRef.current = navActive;
  const navOpenRef = useRef(navOpen);
  navOpenRef.current = navOpen;
  // True while NavigationController is fetching GPS + the route after
  // "Start Navigation" — its panel must stay open until that finishes.
  const navStartingRef = useRef(false);
  // Bumped to close DesktopSearchBar's dropdown, which owns its own open state.
  const [searchDismissKey, setSearchDismissKey] = useState(0);
  const [navSeedDest, setNavSeedDest] = useState(() => readPersistentState('navigation-seeded-destination', null));
  const [reviewTarget, setReviewTarget] = useState(null);
  // Bumped when a review is submitted so an open place card reloads its
  // Reviews list.
  const [reviewsVersion, setReviewsVersion] = useState(0);
  const navControllerRef = useRef(null);
  const prevViewModeRef = useRef(null);

  const persistMapView = useCallback((view) => {
    const center = view?.center;
    if (!center) return;
    const next = { center: [center.lat, center.lng], zoom: view.zoom };
    setMapView(next);
    writePersistentState('map-view', next);
  }, []);

  // Fill an open card's rating and area from the loaded waypoint, whichever
  // way it was opened (pin, search, chip results, Explore — some of those
  // build their own card data without them) and after a refetch (e.g. a
  // review was just submitted). Re-runs whenever the card data is replaced
  // (re-opening the same place from Explore/Nearby builds new data without
  // the area). Only sets when something differs, so it can't loop.
  useEffect(() => {
    if (!selected?.id || selected.isBusiness) return;
    const wp = waypoints.find((w) => w.id === selected.id);
    if (!wp) return;
    const area = wp.area || '';
    if (wp.avgRating !== selected.avgRating || wp.reviewCount !== selected.reviewCount || area !== (selected.area || '')) {
      setSelected((s) =>
        s && s.id === wp.id ? { ...s, avgRating: wp.avgRating, reviewCount: wp.reviewCount, area } : s
      );
    }
  }, [waypoints, selected]);
  useEffect(() => writePersistentState('sidebar-collapsed', collapsed), [collapsed]);
  useEffect(() => writePersistentState('mobile-sheet-tab', sheetActiveTab), [sheetActiveTab]);
  useEffect(() => writePersistentState('navigation-open', navOpen), [navOpen]);
  useEffect(() => writePersistentState('navigation-seeded-destination', navSeedDest), [navSeedDest]);

  const gps = useGpsTracking(map, { hidden: navActive });

  // Last-active stamp for the idle reset. Refreshed only while visible, so
  // time spent hidden or with the screen off counts as away; coming back
  // after too long reloads the page into a fresh map.
  useEffect(() => {
    markMapActive();
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && reloadIfIdle()) return;
      markMapActive();
    };
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') markMapActive();
    }, 60 * 1000);
    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pagehide', markMapActive);
    return () => {
      clearInterval(id);
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pagehide', markMapActive);
    };
  }, []);

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

  // Retry any completed navigations that couldn't be recorded earlier
  // (offline / database unavailable). Safe to repeat: the server counts a
  // given trip at most once. See navCompletion.js.
  const signedInUserId = auth.user?.id ?? null;
  useEffect(() => {
    if (signedInUserId) flushPendingNavCompletions(signedInUserId);
  }, [signedInUserId]);

  const handleRetryData = useCallback(() => {
    refetchWaypoints();
    refetchSegments();
  }, [refetchWaypoints, refetchSegments]);

  // Merges two different signals that both mean "this isn't live data
  // right now": waypointsOffline/segmentsOffline (a fetch fell back to
  // cache or timed out) and browserOnline (the browser's own connectivity
  // state, which can flip mid-session with no fetch involved at all —
  // e.g. turning off mobile data while already looking at a loaded map).
  // Without browserOnline in the mix, that second case triggers nothing.
  const isOffline = !browserOnline || waypointsOffline || segmentsOffline;
  const cachedAt = waypointsCachedAt || segmentsCachedAt || null;

  // Real boot-readiness signal for App's loading screen — the loading
  // flags this page already tracks for its own data hooks (map init,
  // waypoints, segments, session restore), plus enough extra info
  // (isOffline/cachedAt, and a manual retry hook) for HomeRoute's
  // failsafe timer to offer a real "retry" / "continue with saved data"
  // choice instead of just hanging if the network is bad. See
  // HomeRoute.jsx's BOOT_TIMEOUT_MS comment for why that failsafe exists.
  useEffect(() => {
    onReadinessChange?.({
      mapReady: !!map,
      waypointsReady: !waypointsLoading,
      segmentsReady: !segmentsLoading,
      authReady: !auth.loading,
      isOffline,
      cachedAt,
      retry: handleRetryData,
    });
  }, [
    map,
    waypointsLoading,
    segmentsLoading,
    auth.loading,
    isOffline,
    cachedAt,
    handleRetryData,
    onReadinessChange,
  ]);

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
  const wasNavActiveRef = useRef(false);
  useEffect(() => {
    if (navActive) {
      setSelected(null);
      setSelectedSegmentId(null);
      setActiveChip(null);
      setMobileSearchOpen(false);
    } else if (wasNavActiveRef.current) {
      // A card opened mid-trip uses the trip layout; close it when the trip
      // ends rather than letting it jump to the normal one.
      setSelected(null);
    }
    wasNavActiveRef.current = navActive;
  }, [navActive]);

  // The desktop sidebar is hidden during nav; the map stretches over its
  // space (MapShell.module.css) so no empty strip is left behind. Leaflet
  // needs a resize once the 0.3s `left` transition finishes.
  useEffect(() => {
    document.body.classList.toggle('nav-active', navActive);
    const id = setTimeout(() => map?.invalidateSize({ animate: false }), 320);
    return () => {
      clearTimeout(id);
      document.body.classList.remove('nav-active');
    };
  }, [navActive, map]);
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
    // The PIN prompt is a surface too.
    closeOtherOverlays('admin');
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
  // Same corner as ChannelPrompt — the WhatsApp nudge waits while it's up.
  const [optInPromptOpen, setOptInPromptOpen] = useState(false);
  const [reviewPromptOpen, setReviewPromptOpen] = useState(false);
  const suggestClickHandlerRef = useRef(null);
  const [suggestPicking, setSuggestPicking] = useState(false);

  // Closing the form (directly or via closeOtherOverlays) mid-pick drops
  // the pending map click, so a later tap doesn't reopen it.
  useEffect(() => {
    if (suggestModalOpen) return;
    setSuggestPicking(false);
    if (suggestClickHandlerRef.current) {
      map?.off('click', suggestClickHandlerRef.current);
      suggestClickHandlerRef.current = null;
    }
  }, [suggestModalOpen, map]);

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
  // The nav "Where to?" panel, the desktop search dropdown and the expanded
  // desktop sidebar are part of the same rule. An active trip is never
  // cancelled from here — only its End button does that.
  const closeOtherOverlays = useCallback((keep) => {
    if (keep !== 'nav' && !navActiveRef.current && !navStartingRef.current) {
      setNavOpen(false);
      setNavSeedDest(null);
    }
    if (keep !== 'search') setSearchDismissKey((k) => k + 1);
    // The search dropdown sits over the map, clear of the sidebar, and
    // collapsing it would slide the search bar while someone types.
    if (keep !== 'sidebar' && keep !== 'search' && !isMobile && !navActiveRef.current) setCollapsed(true);
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

  // Explore features new places, so open it on every load: right away for
  // returning visitors, after the zoom hint (pinched in, or "Got it") on a
  // first visit — unless something else is already open (`mapBusy`, below:
  // a place, search, suggest form, the sheet…), since opening Explore
  // closes every other overlay.
  const [exploreOpenRequest, setExploreOpenRequest] = useState(0);
  const mapBusyRef = useRef(false);
  const handleZoomHintDone = useCallback(() => {
    if (navActiveRef.current || mapBusyRef.current) return;
    if (isMobile) {
      setSheetActiveTab('layers');
      handleSheetStateChange('half');
    } else {
      setExploreOpenRequest((n) => n + 1);
    }
  }, [isMobile, handleSheetStateChange]);

  const handleCollapsedChange = useCallback(
    (next) => {
      if (!next) closeOtherOverlays('sidebar');
      setCollapsed(next);
    },
    [closeOtherOverlays]
  );

  // A reload restores each surface separately, so several could come back
  // at once. Keep the most important one and close the rest.
  useEffect(() => {
    const restored =
      (navOpen && 'nav') ||
      (selected && 'selected') ||
      (selectedSegmentId && 'segment') ||
      (activeChip && 'chip') ||
      (isMobile && mobileSearchOpen && 'search') ||
      (isMobile && sheetState !== 'peek' && 'sheet') ||
      (!isMobile && !collapsed && 'sidebar');
    if (restored) closeOtherOverlays(restored);
    if (!isMobile) setMobileSearchOpen(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSelectPlace = useCallback(
    (wp) => {
      // Allowed mid-trip (people check what's around them); PlaceCard's
      // `duringNav` layout keeps it clear of the HUD.
      closeOtherOverlays('selected');
      setSelected(wp);
    },
    [closeOtherOverlays]
  );

  // Map pins: while "Where to?" is open, a pin tap picks the destination
  // (the panel's own hint says to) instead of opening a place card.
  const handleMapPinSelect = useCallback(
    (wp) => {
      if (navOpenRef.current && !navActiveRef.current) {
        setNavSeedDest({ lat: wp.lat, lng: wp.lng, name: wp.name, id: wp.id, type: wp.type });
        return;
      }
      handleSelectPlace(wp);
    },
    [handleSelectPlace]
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

  // The form stays mounted (just hidden) while picking, so its draft
  // survives the trip to the map.
  function handleRequestMapPick() {
    if (!map) return;
    setSuggestPicking(true);
    const handler = (e) => {
      suggestClickHandlerRef.current = null;
      setSuggestPickedCoord({ lat: e.latlng.lat, lng: e.latlng.lng });
      setSuggestPicking(false);
    };
    suggestClickHandlerRef.current = handler;
    map.once('click', handler);
  }

  function handleCancelMapPick() {
    if (suggestClickHandlerRef.current) {
      map?.off('click', suggestClickHandlerRef.current);
      suggestClickHandlerRef.current = null;
    }
    setSuggestPicking(false);
  }

  function handleNavLaunch() {
    if (guestNavBlocked) {
      handleGuestNavBlocked();
      return;
    }
    if (navOpen) {
      navControllerRef.current?.requestLaunchToggle();
    } else {
      closeOtherOverlays('nav');
      setNavOpen(true);
      presence.updatePresence('navigating');
    }
  }

  function handlePlaceCardNavigate(entry) {
    if (navActiveRef.current) return;
    if (guestNavBlocked) {
      handleGuestNavBlocked();
      return;
    }
    closeOtherOverlays('nav');
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

  // Something is open on the map. The WhatsApp prompt waits for this to
  // clear, and the Tawk chat bubble steps aside meanwhile so it doesn't sit
  // on top of panels/the expanded mobile sheet.
  const mapBusy =
    !!selected ||
    !!selectedSegment ||
    !!activeChip ||
    mobileSearchOpen ||
    navOpen ||
    !!reviewTarget ||
    authModalOpen ||
    adminPin.pinOpen ||
    adminPanelOpen ||
    suggestModalOpen ||
    mySubmissionsOpen ||
    !!submissionToast ||
    (isMobile && sheetState !== 'peek');
  mapBusyRef.current = mapBusy;
  const onMapRoute = useLocation().pathname === '/map';
  useEffect(() => {
    setTawkHidden('map-busy', onMapRoute && mapBusy);
    return () => setTawkHidden('map-busy', false);
  }, [onMapRoute, mapBusy]);

  // The chat bubble doesn't arrive with the map: it stays hidden until the
  // person first zooms/drags the map, or CHAT_SETTLE_MS passes.
  const [mapSettled, setMapSettled] = useState(false);
  useEffect(() => {
    if (!map || mapSettled) return undefined;
    const settle = () => setMapSettled(true);
    const timer = setTimeout(settle, CHAT_SETTLE_MS);
    map.once('zoomstart dragstart', settle);
    return () => {
      clearTimeout(timer);
      map.off('zoomstart dragstart', settle);
    };
  }, [map, mapSettled]);
  useEffect(() => {
    setTawkHidden('map-settling', onMapRoute && !mapSettled);
    return () => setTawkHidden('map-settling', false);
  }, [onMapRoute, mapSettled]);

  return (
    <>
      <MapShell onMapReady={setMap} initialView={mapView} onViewChange={persistMapView} />
      <ZoomHint map={map} onDone={handleZoomHintDone} />
      <OfflineBanner
        isOffline={isOffline}
        cachedAt={cachedAt}
        onRetry={handleRetryData}
      />
      {/* Pins are hidden during a trip by CSS (body.nav-active, see
          waypointMarkers.css) — the "Nearby places" list replaces them.
          Kept mounted so ending a trip doesn't rebuild every marker. */}
      {map && (
        <WaypointLayer
          map={map}
          waypoints={waypoints}
          isTypeVisible={typeVisibilityProps.isVisible}
          onSelect={handleMapPinSelect}
          snaps={osmSnaps}
          badgeMerges={osmBadgeMerges}
        />
      )}
      {map && <OSMAnnotationLayer map={map} items={osmItems} onSelect={handleMapPinSelect} />}
      <PlaceCard
        data={selected}
        onClose={() => setSelected(null)}
        onNavigate={handlePlaceCardNavigate}
        collapsed={!isMobile && collapsed && !navActive}
        isMobile={isMobile}
        duringNav={navActive}
        reviewsVersion={reviewsVersion}
        onWriteReview={(dest) => {
          // The card stays open underneath, so the new review shows in it
          // as soon as it's submitted (reviewsVersion).
          setReviewTarget(dest);
          presence.updatePresence(`reviewing ${dest?.name || 'a place'}`);
        }}
      />
      {selectedSegment && (
        <DetailModal segment={selectedSegment} onClose={() => setSelectedSegmentId(null)} />
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
        // Hidden (not unmounted) during nav so its body.sidebar-collapsed
        // class stays put and the map doesn't shift.
        <div style={navActive ? { display: 'none' } : undefined}>
        <Sidebar
          map={map}
          typeVisibilityProps={typeVisibilityProps}
          collapsed={collapsed}
          onCollapsedChange={handleCollapsedChange}
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
          exploreRequest={exploreRequest}
          exploreOpenRequest={exploreOpenRequest}
          placeOpen={!!selected}
        />
        </div>
      )}

      {/* ── Slice 7: search ─────────────────────────────────────────── */}
      {/* Hidden during active nav so only the nav HUD/panel shows. */}
      {navActive ? null : isMobile ? (
        <>
          <MobileSearchBar
            onOpenSearch={() => {
              closeOtherOverlays('search');
              setMobileSearchOpen(true);
              presence.updatePresence('searching');
            }}
            onToggleSheet={() => {
              // Menu button opens the sheet on Explore (the 'layers' tab);
              // pressed again while Explore is showing, it closes the sheet.
              if (sheetActiveTab === 'layers' && sheetState !== 'peek') {
                handleSheetStateChange('peek');
                return;
              }
              setSheetActiveTab('layers');
              if (sheetState === 'peek') handleSheetStateChange('half');
            }}
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
          onToggleCollapsed={() => setExploreRequest((n) => n + 1)}
          dismissKey={searchDismissKey}
          onDropdownOpen={() => closeOtherOverlays('search')}
          onManualType={() => setActiveChip(null)}
          activeChipLabel={activeChip?.label}
          onNavigateClick={handleNavLaunch}
        />
      )}
      {!navActive && (
        <QuickChips
          chips={quickChips.chips}
          activeChip={activeChip}
          onChipClick={handleChipClick}
          onAllPlacesOpen={() => setActiveChip(null)}
          collapsed={collapsed}
          isMobile={isMobile}
        />
      )}
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
      {/* MobFabCluster (floating profile / view-mode / locate buttons) is
          intentionally not rendered — the Layers panel / bottom-sheet tabs
          (Signal, Profile) cover the same actions. Component file is kept
          in features/navigation/ in case it needs to be restored. */}
      {map && navOpen && (
        <NavigationController
          ref={navControllerRef}
          map={map}
          gps={gps}
          searchIndex={searchIndex}
          segments={segments}
          userId={auth.user?.id ?? null}
          initialDest={navSeedDest}
          explorePicks={explorePicksState.picks}
          onRequestClose={() => {
            setNavOpen(false);
            setNavSeedDest(null);
          }}
          onActiveChange={setNavActive}
          placeCardOpen={!!selected}
          nearbyCandidates={nearbyCandidates}
          selectedPlace={selected}
          onNearbySelect={(place) => handleSelectPlace(place.card)}
          isMobile={isMobile}
          onStartingChange={(starting) => {
            navStartingRef.current = starting;
          }}
          onArrival={(dest) => {
            // Not reviewed on arrival (they haven't had the service yet):
            // ReviewPrompt asks an hour later.
            rememberVisit(dest);
          }}
          guestNavBlocked={guestNavBlocked}
          onGuestBlocked={handleGuestNavBlocked}
          onNavigationSuccess={({ tripId } = {}) => {
            // Fired once per genuinely completed trip (see
            // NavigationController's header). Guests feed the free-nav
            // tally; signed-in users feed the profile's Navigations stat.
            if (!auth.user) guestUsage.recordUse();
            else reportNavigationCompletion(auth.user.id, tripId);
          }}
        />
      )}
      {reviewTarget && (
        <ReviewModal
          dest={reviewTarget}
          onClose={() => setReviewTarget(null)}
          onSubmitted={() => {
            refetchWaypoints();
            setReviewsVersion((v) => v + 1);
          }}
          user={auth.user}
        />
      )}
      {authModalOpen && (
        <AuthModal
          initialTab={authModalTab}
          user={auth.user}
          onClose={() => setAuthModalOpen(false)}
          signInWithGoogle={auth.signInWithGoogle}
          signInWithEmail={auth.signInWithEmail}
          signUpWithEmail={auth.signUpWithEmail}
          checkEmailStatus={auth.checkEmailStatus}
          resetPassword={auth.resetPassword}
          verifyRecoveryCode={auth.verifyRecoveryCode}
          setNewPassword={auth.setNewPassword}
          requestEmailChange={auth.requestEmailChange}
          confirmEmailChange={auth.confirmEmailChange}
          signOut={auth.signOut}
          friendlyError={friendlyError}
          message={authModalMessage}
        />
      )}
      {adminPin.pinOpen && (
        <AdminPinGate
          open={adminPin.pinOpen}
          onSuccess={adminPin.handleSuccess}
          onClose={adminPin.closePinGate}
        />
      )}
      {map && adminPanelOpen && (
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
      )}

      {/* ── Slice 13: student waypoint submissions ─────────────────── */}
      {suggestModalOpen && (
        <SuggestWaypointModal
          user={auth.user}
          waypoints={waypoints}
          pickedCoord={suggestPickedCoord}
          onCoordConsumed={() => setSuggestPickedCoord(null)}
          onRequestMapPick={handleRequestMapPick}
          onClose={() => setSuggestModalOpen(false)}
          onSubmitted={(message) => setSubmissionToast(message)}
          hidden={suggestPicking}
          onViewSubmissions={() => {
            closeOtherOverlays('submissions');
            setMySubmissionsOpen(true);
          }}
        />
      )}
      {suggestModalOpen && suggestPicking && (
        <MapPickBanner message="Tap the map where the place is" onCancel={handleCancelMapPick} />
      )}
      {mySubmissionsOpen && (
        <MyWaypointSubmissionsPanel user={auth.user} onClose={() => setMySubmissionsOpen(false)} />
      )}
      <SubmissionToast message={submissionToast} onDismiss={dismissSubmissionToast} />
      {/* One corner card at a time: a due review goes first, then the
          marketing opt-in, then the WhatsApp channel nudge. */}
      <Suspense fallback={null}>
        <ReviewPrompt
          ready={!!map && !waypointsLoading}
          isMobile={isMobile}
          blocked={mapBusy || isOffline || optInPromptOpen}
          onVisibleChange={setReviewPromptOpen}
          onRate={(dest) => {
            closeOtherOverlays('review');
            setReviewTarget(dest);
            presence.updatePresence(`reviewing ${dest?.name || 'a place'}`);
          }}
        />
      </Suspense>
      <MarketingOptInPrompt
        user={auth.loading ? null : auth.user}
        ready={!!map && !waypointsLoading}
        isMobile={isMobile}
        blocked={mapBusy || isOffline || reviewPromptOpen}
        onVisibleChange={setOptInPromptOpen}
      />
      <ChannelPrompt
        ready={!!map && !waypointsLoading && !auth.loading}
        isMobile={isMobile}
        userId={auth.loading ? null : auth.user?.id || null}
        blocked={mapBusy || isOffline || optInPromptOpen || reviewPromptOpen}
      />
    </>
  );
}