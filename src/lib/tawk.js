import { useEffect, useState } from 'react';

// Tawk.to live-chat widget.
//
// Only on TAWK_ROUTES: the script is injected the first time one of them is
// visited (other pages never download it), and the bubble is hidden again
// on any other route the SPA navigates to afterwards.
//
// The bubble floats bottom-right on every page. On the map that corner is
// shared with the WhatsApp channel prompt and, on mobile, sits over an
// expanded bottom sheet — so features ask for it to step aside with
// setTawkHidden(reason, true) and release it with (reason, false). It's
// shown again only once no reason is left. An open chat is never hidden.

const TAWK_SRC = 'https://embed.tawk.to/6ad143736df7e334c4c14ca3/1k50muv02';
const TAWK_ROUTES = new Set(['/map', '/promote']);

const reasons = new Set();
let chatOpen = false;
let injected = false;

// The embed snippet from the Tawk dashboard, plus offsets that keep the
// bubble clear of Leaflet's attribution (desktop) and the mobile bottom
// sheet's 76px peek bar, and callbacks this module listens to.
function loadTawk() {
  if (injected) return;
  injected = true;
  const t = (window.Tawk_API = window.Tawk_API || {});
  window.Tawk_LoadStart = new Date();
  t.customStyle = {
    visibility: {
      desktop: { position: 'br', xOffset: 20, yOffset: 36 },
      mobile: { position: 'br', xOffset: 12, yOffset: 96 },
    },
  };
  t.onLoad = () => window.dispatchEvent(new Event('tawk:load'));
  t.onChatMaximized = () => window.dispatchEvent(new Event('tawk:open'));
  t.onChatMinimized = () => window.dispatchEvent(new Event('tawk:close'));
  const s1 = document.createElement('script');
  s1.async = true;
  s1.src = TAWK_SRC;
  s1.charset = 'UTF-8';
  s1.setAttribute('crossorigin', '*');
  document.body.appendChild(s1);
}

function api() {
  return typeof window !== 'undefined' ? window.Tawk_API : undefined;
}

function apply() {
  const t = api();
  if (!t || typeof t.hideWidget !== 'function') return; // not loaded yet — re-applied on tawk:load
  try {
    // Off-route always hides; other reasons yield to an open chat.
    if (reasons.has('route') || (reasons.size > 0 && !chatOpen)) t.hideWidget();
    else t.showWidget();
  } catch {
    // widget mid-initialisation; next apply() fixes it
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('tawk:load', apply);
  window.addEventListener('tawk:open', () => {
    chatOpen = true;
  });
  window.addEventListener('tawk:close', () => {
    chatOpen = false;
    apply();
  });
}

export function setTawkHidden(reason, hidden) {
  if (hidden) reasons.add(reason);
  else reasons.delete(reason);
  apply();
}

// True while the chat window is expanded.
export function useTawkChatOpen() {
  const [open, setOpen] = useState(chatOpen);
  useEffect(() => {
    const onOpen = () => setOpen(true);
    const onClose = () => setOpen(false);
    window.addEventListener('tawk:open', onOpen);
    window.addEventListener('tawk:close', onClose);
    return () => {
      window.removeEventListener('tawk:open', onOpen);
      window.removeEventListener('tawk:close', onClose);
    };
  }, []);
  return open;
}

// Mounted once in App.jsx: loads the widget on TAWK_ROUTES, hides it elsewhere.
export function useTawkOnRoutes(pathname) {
  const allowed = TAWK_ROUTES.has(pathname);
  useEffect(() => {
    if (allowed) loadTawk();
    setTawkHidden('route', !allowed);
  }, [allowed]);
}
