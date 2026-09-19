import { useEffect } from "react";
import { BrowserRouter, Routes, Route, useLocation } from "react-router-dom";
import './index.css'
import HomeRoute from './pages/HomeRoute'
import LoadingScreen from './pages/LoadingScreen'
import NotFoundPage from './pages/NotFoundPage'
import ResetPasswordPage from './pages/ResetPasswordPage'

import LandingPage from './pages/LandingPage'
import PrivacyPolicy from './pages/legal/PrivacyPolicy'
import TermsOfService from './pages/legal/TermsOfService'
import CookiePolicy from './pages/legal/CookiePolicy'

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

function App() {
  return (
    <BrowserRouter>
      <ScrollToTop />
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/map" element={<HomeRoute />} />
        {/* Landing spot for the "Forgot password?" email link. See
          useAuth.js's
            resetPassword() + ResetPasswordPage.jsx's header comment for
            why this route needs to exist at all (Supabase's recovery
            link auto-logs the browser in; this page is what turns that
            into an actual "choose a new password, then sign in again"
            flow instead of a silent auto-login). */}
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/loadingscreen" element={<LoadingScreen />} />
        <Route path="/privacy" element={<PrivacyPolicy />} />
        <Route path="/terms" element={<TermsOfService />} />
        <Route path="/cookies" element={<CookiePolicy />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;