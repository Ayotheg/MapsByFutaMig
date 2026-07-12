import { useState } from 'react'
import { BrowserRouter, Routes, Route } from "react-router-dom";
import './index.css'
import LandingPage from './LandingPage'
import LoadingScreen from './LoadingScreen'
import NotFound from './404-page'


function App() {
  return ( 
   <BrowserRouter>
      <Routes>
        <Route path="/" element={<LandingPage />} />
        <Route path="/loadingscreen" element={<LoadingScreen />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
   );
}

export default App;