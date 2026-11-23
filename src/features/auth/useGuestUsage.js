import { useCallback, useState } from 'react';

// ── Guest navigation limit ──────────────────────────────────────────────
//
// New requirement (not in legacy — legacy had no usage cap): unauthenticated
// visitors get GUEST_NAV_LIMIT free *successful* navigations (arriving at a
// destination) before the app requires sign-in/sign-up to navigate again.
// Browsing the map, searching, and viewing place cards stay unrestricted for
// guests — only the "start navigation" action is gated (see MapPage.jsx's
// `guestNavBlocked` and NavigationController.jsx's `guestNavBlocked` prop).
//
// Enforcement is client-side only (localStorage), matching this app's
// pre-launch/no-real-users-yet stage — clearing storage resets the count.
// If/when this needs to be tamper-resistant, the count should move server
// side (e.g. a `guest_id` cookie + a Supabase table), but that's a bigger
// change than this hook's scope.
export const GUEST_NAV_LIMIT = 3;
const STORAGE_KEY = 'mbf_guest_nav_count';

function readCount() {
  if (typeof window === 'undefined') return 0;
  const raw = Number(window.localStorage.getItem(STORAGE_KEY));
  return Number.isFinite(raw) && raw > 0 ? raw : 0;
}

export function useGuestUsage() {
  const [count, setCount] = useState(readCount);

  // Called once per successful guest navigation (see
  // NavigationController.jsx's `arrivedAtDestination`). Functional update
  // reads localStorage fresh so two rapid calls never clobber each other.
  const recordUse = useCallback(() => {
    setCount(() => {
      const next = readCount() + 1;
      window.localStorage.setItem(STORAGE_KEY, String(next));
      return next;
    });
  }, []);

  // Called once a guest actually signs in/up — the cap only ever applies
  // while signed out, so a fresh account starts with a clean slate rather
  // than inheriting whatever the browser had racked up as a guest.
  const reset = useCallback(() => {
    window.localStorage.removeItem(STORAGE_KEY);
    setCount(0);
  }, []);

  return {
    count,
    limit: GUEST_NAV_LIMIT,
    remaining: Math.max(0, GUEST_NAV_LIMIT - count),
    limitReached: count >= GUEST_NAV_LIMIT,
    recordUse,
    reset,
  };
}
