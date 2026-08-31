import { StrictMode } from 'react'
import { createRoot, hydrateRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

const rootEl = document.getElementById('root')

// dist/index.html ships with the landing page ("/") prerendered to
// real HTML at build time (see scripts/prerender.mjs) so crawlers get
// content on first response. On that route we hydrate into the
// existing markup instead of wiping and re-rendering. Every other
// route (e.g. /map) is served the same static index.html file by
// Vercel's SPA rewrite but wasn't prerendered for that path, so we
// clear the (mismatched) landing markup and mount fresh.
if (window.location.pathname === '/' && rootEl.childElementCount > 0) {
  hydrateRoot(
    rootEl,
    <StrictMode>
      <App />
    </StrictMode>,
  )
} else {
  rootEl.innerHTML = ''
  createRoot(rootEl).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
