import { useEffect, useState } from "react";
import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import './index.css'
import LoadingScreen from './pages/LoadingScreen'
import HomeRoute from './pages/HomeRoute'
import NotFoundPage from './pages/NotFoundPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

import LandingPage from './pages/LandingPage'
import PromotePage from './features/promote/PromotePage'
import PromoteCallbackPage from './features/promote/PromoteCallbackPage'
import PrivacyPolicy from './pages/legal/PrivacyPolicy'
import TermsOfService from './pages/legal/TermsOfService'
import CookiePolicy from './pages/legal/CookiePolicy'
import { useTawkOnRoutes } from './lib/tawk'

// React Router doesn't reset scroll position on navigation by default —
// without this, clicking e.g. the footer's "Privacy Policy" link (or any
// link lower on a page) lands on the new route still scrolled down,
// forcing the user to manually scroll back up. Runs on every path change,
// instant (not smooth) so it doesn't fight the in-page smooth-scroll used
// for anchor links on the landing page itself.
function ScrollToTop() {
  const { pathname } = useLocation();
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);
  return null;
}

// Tawk.to live chat — /map, /promote and /promote/callback only (see lib/tawk.js).
function TawkChat() {
  useTawkOnRoutes(useLocation().pathname);
  return null;
}

// Pages the map stays alive behind once it has loaded. Going /map →
// /promote → back is instant: no reload, no second loading screen. Any
// other route (landing page, legal pages…) unmounts the map as before.
const KEEP_MAP_ALIVE = new Set(["/map", "/promote"]);

// `npm run build:app` (vite --mode app) builds the Android app, which has no
// landing page: "/" goes straight to the map. Build-time constant, so the
// web build is unchanged.
const IS_APP_BUILD = import.meta.env.MODE === "app";

// The map lives outside <Routes> so leaving /map for a keep-alive page
// hides it (display: none) instead of unmounting it.
function PersistentMap() {
  const { pathname } = useLocation();
  const onMap = pathname === "/map";
  const [loaded, setLoaded] = useState(onMap);

  useEffect(() => {
    if (onMap) setLoaded(true);
    else if (!KEEP_MAP_ALIVE.has(pathname)) setLoaded(false);
  }, [onMap, pathname]);

  if (!onMap && !(loaded && KEEP_MAP_ALIVE.has(pathname))) return null;
  return (
    <div style={{ display: onMap ? "contents" : "none" }}>
      <HomeRoute active={onMap} />
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <TawkChat />
      <Routes>
        <Route path="/" element={IS_APP_BUILD ? <Navigate to="/map" replace /> : <LandingPage />} />
        {/* Rendered by <PersistentMap /> below; this entry just keeps
            /map out of the catch-all 404. */}
        <Route path="/map" element={null} />
        {/* Landing spot for the "Forgot password?" email link. See
          useAuth.js's
            resetPassword() + ResetPasswordPage.jsx's header comment for
            why this route needs to exist at all (Supabase's recovery
            link auto-logs the browser in; this page is what turns that
            into an actual "choose a new password, then sign in again"
            flow instead of a silent auto-login). */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/loadingscreen" element={<LoadingScreen />} />
        <Route path="/promote" element={<PromotePage />} />
        {/* BACHS's success_url lands here (see
          features/promote/submitPromotion.js's create-promotion-checkout
          call + docs/payments.md) — polls the promotions
          row for a webhook-confirmed payment_status rather than trusting
          the redirect itself. cancel_url points back at /promote?cancelled=1
          instead, so a cancelled checkout never reaches this route. */}
        <Route path="/promote/callback" element={<PromoteCallbackPage />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <PersistentMap />
    </BrowserRouter>
  );
}

export default App;