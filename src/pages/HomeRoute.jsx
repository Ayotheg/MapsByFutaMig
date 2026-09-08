import { useEffect, useRef, useState } from "react";
import MapPage from './MapPage'
import LoadingScreen from './LoadingScreen'

// Hard ceiling on how long we'll wait for every readiness flag before
// offering the user a way out. Not a substitute for the real flags above —
// it only kicks in if one of them never resolves (a hung Supabase request
// on a degraded connection, for example — see useWaypoints.js/
// useSegments.js's own 8s per-request timeout for the first line of
// defense; this is the second, in case something upstream of those still
// stalls, e.g. session restore). Picked to sit comfortably above normal
// boot time (map + two Supabase reads + font load usually finish in low
// single-digit seconds) without making a genuinely stuck user wait long.
const BOOT_TIMEOUT_MS = 10000;

// One entry per real boot milestone tracked below — order matches roughly
// how they resolve in practice (map init is near-instant; Supabase reads
// and session restore take longer). Text doubles as each step's status
// label in the loading screen.
const BOOT_STEPS = [
  "Initializing map shell",
  "Loading waypoints",
  "Loading segments",
  "Restoring session",
  "Loading fonts",
];

// Real browser signal, not a guess — resolves once every requested
// @fontsource face has actually finished downloading/parsing.
function useFontsReady() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    let cancelled = false;
    if (document.fonts?.ready) {
      document.fonts.ready.then(() => {
        if (!cancelled) setReady(true);
      });
    } else {
      // Font Loading API unsupported — don't block boot on it.
      setReady(true);
    }
    return () => {
      cancelled = true;
    };
  }, []);
  return ready;
}

// Mounts MapPage immediately (so its data hooks start fetching right
// away) and overlays the loading screen on top, driven by MapPage's own
// mapReady/waypointsReady/segmentsReady/authReady flags plus fontsReady
// here — no artificial timer standing in for real progress.
//
// Lives in its own file (rather than inline in App.jsx) so both the
// real /map route (behind RequireLaunch) and the /gearlify dev route
// (unguarded — see GearlifyGate.jsx) can mount the exact same map
// experience without duplicating this component.
function HomeRoute() {
  const [readiness, setReadiness] = useState({
    mapReady: false,
    waypointsReady: false,
    segmentsReady: false,
    authReady: false,
    isOffline: false,
    cachedAt: null,
    retry: null,
  });
  const fontsReady = useFontsReady();
  const [booted, setBooted] = useState(false);

  // Failsafe timer for BOOT_TIMEOUT_MS — see its comment above. Restarts
  // whenever the person hits Retry, so a second slow attempt gets its own
  // full window instead of inheriting whatever was left of the first.
  const [timedOut, setTimedOut] = useState(false);
  const timerRef = useRef(null);
  const startBootTimer = () => {
    clearTimeout(timerRef.current);
    setTimedOut(false);
    timerRef.current = setTimeout(() => setTimedOut(true), BOOT_TIMEOUT_MS);
  };
  useEffect(() => {
    startBootTimer();
    return () => clearTimeout(timerRef.current);
  }, []);

  // Bug fix (reported directly): "only the map should be able to be
  // zoomed in or out, sometimes when you try to zoom the map, the
  // interface moves along... forcing you to refresh the page." Root
  // cause: index.html's `<meta name="viewport">` only ever set
  // `initial-scale=1`, with no `maximum-scale`/`user-scalable` — so nothing
  // stopped the *browser's own page-level* pinch-zoom from firing instead
  // of (or alongside) Leaflet's own zoom handling on `.map` (which already
  // sets `touch-action: none`, MapShell.module.css, specifically so the
  // browser hands raw touch events to Leaflet instead of doing anything
  // with them itself — that only works if the page beneath it isn't also
  // zoomable). Same scoping as the `map-viewport` body class right below:
  // only while this route is mounted, restored after, since the landing
  // page is normal scrollable content that should stay pinch-zoomable for
  // accessibility (WCAG 1.4.4) — this app's map view is the one screen
  // that specifically needs to behave like a native map, not a webpage.
  // Not airtight on every browser — recent Safari/Chrome versions
  // deliberately ignore `user-scalable=no` for the same accessibility
  // reason — but this removes the page-level zoom as a *competing*
  // gesture handler on the browsers that do respect it, which is what was
  // producing the "interface moves/gets stuck" symptom.
  useEffect(() => {
    const meta = document.querySelector('meta[name="viewport"]');
    const original = meta?.getAttribute('content') ?? null;
    meta?.setAttribute('content', 'width=device-width, initial-scale=1, maximum-scale=1, user-scalable=no, viewport-fit=cover');
    return () => {
      if (original !== null) meta?.setAttribute('content', original);
    };
  }, []);

  // Lock the viewport for the map's fixed-canvas layout, only while
  // this route is mounted — the landing page at "/" needs normal
  // document scroll instead. See the .map-viewport rule in index.css.
  useEffect(() => {
    document.body.classList.add("map-viewport");
    return () => {
      document.body.classList.remove("map-viewport");
    };
  }, []);

  const completed =
    Number(readiness.mapReady) +
    Number(readiness.waypointsReady) +
    Number(readiness.segmentsReady) +
    Number(readiness.authReady) +
    Number(fontsReady);
  const allReady = completed >= BOOT_STEPS.length;

  // "Continue anyway" only makes sense once the map itself exists — with
  // no map instance there's nothing underneath the loading screen to
  // reveal. Waypoints/segments already can't hang past their own 8s
  // per-request timeout (useWaypoints.js/useSegments.js), so by the time
  // this failsafe's 10s fires they're realistically always resolved one
  // way or another (live data, cached data, or empty) — it's auth/font
  // loading that has no such ceiling of its own, which is the gap this
  // covers.
  const canContinueAnyway = readiness.mapReady;

  const handleRetry = () => {
    readiness.retry?.();
    startBootTimer();
  };

  return (
    <>
      <MapPage onReadinessChange={setReadiness} />
      {!booted && (
        <LoadingScreen
          steps={BOOT_STEPS}
          current={completed}
          onComplete={allReady ? () => setBooted(true) : undefined}
          stuck={timedOut && !allReady}
          isOffline={readiness.isOffline}
          onRetry={readiness.retry ? handleRetry : undefined}
          onContinue={canContinueAnyway ? () => setBooted(true) : undefined}
        />
      )}
    </>
  );
}

export default HomeRoute
