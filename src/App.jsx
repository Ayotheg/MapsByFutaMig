import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css'
import MapShell from './features/map/MapShell'
import LoadingScreen from './pages/LoadingScreen'
import NotFoundPage from './pages/NotFoundPage'

// LandingPage isn't wired into a route yet — earmarked for a future
// "how the map works" explainer page, not in scope for this slice.
// import LandingPage from './pages/LandingPage'

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<MapShell />} />
        <Route path="/loadingscreen" element={<LoadingScreen />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;