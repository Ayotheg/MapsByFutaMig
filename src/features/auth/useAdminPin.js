import { useCallback, useEffect, useRef, useState } from 'react';

/**
 * Orchestrates legacy's `window._requireAdminPin(cb)` (app.js ~3668–3688):
 * require a real signed-in user before ever showing the PIN pad (a PIN
 * alone grants no Supabase access — RLS only trusts `auth.uid()`, same
 * reasoning as legacy's Firestore-Security-Rules comment, see
 * `adminPin.js`), then show `AdminPinGate`.
 *
 * Usage (Slice 11, `MapPage.jsx`):
 *
 *   const { pinOpen, requestAdminAccess, closePinGate } = useAdminPin(user, openAuthModal);
 *   <button onClick={() => requestAdminAccess(() => setAdminPanelOpen(true))}>Admin</button>
 *   <AdminPinGate open={pinOpen} onSuccess={...} onClose={closePinGate} />
 *
 * `user` and `openAuthModal` are passed in rather than read from context
 * (this codebase has no Context anywhere — MapPage already owns `user`
 * from `useAuth()` and an `openAuthAt(tab)` opener for the auth modal;
 * Slice 11 threads both straight through, same prop-passing convention
 * as `gps`/`viewMode` elsewhere).
 *
 * Legacy's one-shot `futa:authchange` listener (app.js ~3676–3683) — retry
 * automatically once the user signs in, so they don't have to click Admin
 * a second time — is reproduced below via a `useEffect` watching `user`
 * instead of a DOM event: `pendingRef` records that a request bailed on
 * "not signed in"; once this hook re-renders with a real `user` while
 * that's still true, it resumes with the same `onGranted` callback
 * already stashed in `successRef`. (Originally shipped without this
 * effect — flagged as a known gap in an earlier session, fixed here.)
 */
export function useAdminPin(user, openAuthModal) {
  const [pinOpen, setPinOpen] = useState(false);
  const successRef = useRef(null);
  const pendingRef = useRef(false);

  const requestAdminAccess = useCallback((onGranted) => {
    if (!user) {
      // Legacy: a blocking `alert()` (app.js ~3672) — matched as-is,
      // it's a rare admin-only path, not worth a styled toast for.
      window.alert('Please sign in with your admin account first, then reopen the admin panel.');
      successRef.current = onGranted;
      pendingRef.current = true;
      openAuthModal?.('login');
      return;
    }
    successRef.current = onGranted;
    setPinOpen(true);
  }, [user, openAuthModal]);

  // Legacy: the one-shot `futa:authchange` retry (app.js ~3676–3683).
  useEffect(() => {
    if (user && pendingRef.current) {
      pendingRef.current = false;
      setPinOpen(true);
    }
  }, [user]);

  const handleSuccess = useCallback(() => {
    setPinOpen(false);
    successRef.current?.();
    successRef.current = null;
  }, []);

  const closePinGate = useCallback(() => {
    setPinOpen(false);
    successRef.current = null;
    pendingRef.current = false;
  }, []);

  return { pinOpen, requestAdminAccess, handleSuccess, closePinGate };
}
