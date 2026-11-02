import { useCallback, useEffect, useRef, useState } from 'react';
import { readPersistentState, writePersistentState } from '../../lib/persistentState';
import { track } from '../../lib/analytics';

// Shown once per device, ever. Not in mapSession's reset list, so a long
// absence doesn't bring it back.
const SEEN_KEY = 'friends-intro-seen';
const DOT_KEY = 'friends-nav-dot';

// Seconds of the person actually using the map before it's due.
const ACTIVE_SECONDS = 30;
// Only seconds within this long of a touch, click or key count.
const ACTIVE_WINDOW_MS = 10 * 1000;
// Never mid-gesture: nothing touched for this long before it opens.
const QUIET_MS = 2000;
// Corner prompts (WhatsApp, marketing, review) hold off this long after it
// closes, so one pop-up isn't followed straight away by another.
const HOLD_PROMPTS_MS = 60 * 1000;

const INTERACTIONS = ['pointerdown', 'keydown', 'wheel', 'touchstart'];

function typing() {
  const el = document.activeElement;
  return !!el && (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA' || el.isContentEditable);
}

/**
 * When to introduce Meet a friend / Race to a place. `blocked` is everything
 * else that could be on screen or in progress (MapPage): while it's true the
 * seconds still add up, but the pop-up waits and opens at the next clear,
 * quiet moment. `navDot` marks the Nav tab from then until they first open it.
 */
export function useFriendsIntro({ blocked, onMap }) {
  const [seen, setSeen] = useState(() => readPersistentState(SEEN_KEY, false));
  const [open, setOpen] = useState(false);
  const [navDot, setNavDot] = useState(() => readPersistentState(DOT_KEY, false));
  const [holdPrompts, setHoldPrompts] = useState(false);
  const blockedRef = useRef(blocked);
  blockedRef.current = blocked;

  useEffect(() => {
    if (seen || open || !onMap) return undefined;
    let lastTouch = 0;
    let active = 0;
    const touched = () => {
      lastTouch = Date.now();
    };
    INTERACTIONS.forEach((e) => window.addEventListener(e, touched, { capture: true, passive: true }));
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      const since = Date.now() - lastTouch;
      if (since <= ACTIVE_WINDOW_MS) active += 1;
      if (active < ACTIVE_SECONDS || blockedRef.current || since < QUIET_MS || typing()) return;
      // Counted as seen once it opens, so a reload can't show it twice.
      writePersistentState(SEEN_KEY, true);
      writePersistentState(DOT_KEY, true);
      setSeen(true);
      setNavDot(true);
      setOpen(true);
      track('friends_intro', { action: 'shown' });
    }, 1000);
    return () => {
      clearInterval(id);
      INTERACTIONS.forEach((e) => window.removeEventListener(e, touched, { capture: true }));
    };
  }, [seen, open, onMap]);

  useEffect(() => {
    if (!holdPrompts) return undefined;
    const t = setTimeout(() => setHoldPrompts(false), HOLD_PROMPTS_MS);
    return () => clearTimeout(t);
  }, [holdPrompts]);

  const close = useCallback((action) => {
    setOpen(false);
    setHoldPrompts(true);
    track('friends_intro', { action });
  }, []);

  // They opened the Nav menu: the dot has done its job.
  const clearNavDot = useCallback(() => {
    setNavDot(false);
    writePersistentState(DOT_KEY, false);
  }, []);

  // They found the feature on their own (the Nav menu, an invite, a session
  // already running): nothing left to introduce.
  const retire = useCallback(() => {
    writePersistentState(SEEN_KEY, true);
    setSeen(true);
    clearNavDot();
  }, [clearNavDot]);

  return { open, navDot, holdPrompts, close, clearNavDot, retire };
}
