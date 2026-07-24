import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Analytics } from '@vercel/analytics/react';
import './index.css'
import MapPage from './pages/MapPage'
import LoadingScreen from './pages/LoadingScreen'
import NotFoundPage from './pages/NotFoundPage'

import LandingPage from './pages/LandingPage'
import TermsOfService from './pages/legal/TermsOfService'
import PrivacyPolicy from './pages/legal/PrivacyPolicy'
import CookiePolicy from './pages/legal/CookiePolicy'

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
function HomeRoute() {
  const [readiness, setReadiness] = useState({
    mapReady: false,
    waypointsReady: false,
    segmentsReady: false,
    authReady: false,
  });
  const fontsReady = useFontsReady();
  const [booted, setBooted] = useState(false);

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

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map" element={<HomeRoute />} />
        <Route path="/loadingscreen" element={<LoadingScreen />} />
        <Route path="/terms-of-service" element={<TermsOfService />} />
        <Route path="/privacy-policy" element={<PrivacyPolicy />} />
        <Route path="/cookie-policy" element={<CookiePolicy />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <Analytics />
    </BrowserRouter>
  );
}

export default App;