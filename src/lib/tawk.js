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
// The callback pages: where someone lands if a payment won't confirm.
const TAWK_ROUTES = new Set(['/map', '/promote', '/promote/callback', '/event/callback']);

const reasons = new Set();
let chatOpen = false;
let injected = false;

// The embed snippet from the Tawk dashboard, plus offsets and callbacks this
// module listens to. Offsets are read once at load, so one set has to suit
// every chat route:
// - desktop 36px up: clears Leaflet's attribution on /map; just a corner
//   on /promote (right of the sticky summary card) and the callback page.
// - mobile 96px up: sits just above the map's 76px sheet peek bar and the
//   promote page's ~70px checkout bar, never on top of either.
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
  t.onLoad = () => {
    // Always start as the small bubble — never open over the page on load
    // (a dashboard greeting trigger can otherwise expand it by itself).
    try {
      if (t.isChatMaximized?.()) t.minimize();
    } catch {
      // ignore — widget still initialising
    }
    window.dispatchEvent(new Event('tawk:load'));
  };
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

// Hiding is immediate, so a corner card never lands on the bubble. Showing
// waits until no reason has been held for SHOW_DELAY_MS: when one reason
// lets go just as another takes over (the map settling right as the email
// opt-in card appears), the bubble would otherwise pop in and straight back
// out — a visible blink, repeated each time it happens.
const SHOW_DELAY_MS = 600;
let showTimer = null;

function shouldHide() {
  // Off-route always hides; other reasons yield to an open chat.
  return reasons.has('route') || (reasons.size > 0 && !chatOpen);
}

function apply() {
  const t = api();
  if (!t || typeof t.hideWidget !== 'function') return; // not loaded yet — re-applied on tawk:load
  clearTimeout(showTimer);
  showTimer = null;
  if (shouldHide()) {
    try {
      t.hideWidget();
    } catch {
      // widget mid-initialisation; the post-load re-checks below fix it
    }
    return;
  }
  showTimer = setTimeout(() => {
    showTimer = null;
    if (shouldHide()) return;
    try {
      t.showWidget();
    } catch {
      // widget mid-initialisation; next apply() fixes it
    }
  }, chatOpen ? 0 : SHOW_DELAY_MS);
}

// Tawk can still be finishing its own entrance just after onLoad and show
// itself over a card that asked it to hide, so re-check a little later too.
function applyAfterLoad() {
  apply();
  setTimeout(apply, 500);
  setTimeout(apply, 1500);
}

if (typeof window !== 'undefined') {
  window.addEventListener('tawk:load', applyAfterLoad);
  window.addEventListener('tawk:open', () => {
    chatOpen = true;
  });
  window.addEventListener('tawk:close', () => {
    chatOpen = false;
    apply();
  });
}

// Opens the chat window if the widget is loaded on this route. Returns false
// when it isn't (off-route or still loading) so callers can fall back to email.
export function openTawkChat() {
  const t = api();
  if (!t || typeof t.maximize !== 'function' || reasons.has('route')) return false;
  try {
    t.showWidget();
    t.maximize();
    return true;
  } catch {
    return false;
  }
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
