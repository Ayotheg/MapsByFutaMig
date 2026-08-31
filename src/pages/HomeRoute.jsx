import { useEffect, useState } from "react";
import MapPage from './MapPage'
import LoadingScreen from './LoadingScreen'

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
  });
  const fontsReady = useFontsReady();
  const [booted, setBooted] = useState(false);

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

  return (
    <>
      <MapPage onReadinessChange={setReadiness} />
      {!booted && (
        <LoadingScreen
          steps={BOOT_STEPS}
          current={completed}
          onComplete={allReady ? () => setBooted(true) : undefined}
        />
      )}
    </>
  );
}

export default HomeRoute
