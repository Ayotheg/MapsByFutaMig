import { useCallback, useRef, useState } from 'react';

/**
 * Orchestrates legacy's `window._requireAdminPin(cb)` (app.js ~3668–3688):
 * require a real signed-in user before ever showing the PIN pad (a PIN
 * alone grants no Supabase access — RLS only trusts `auth.uid()`, same
 * reasoning as legacy's Firestore-Security-Rules comment, see
 * `adminPin.js`), then show `AdminPinGate`.
 *
 * NOT CALLED FROM ANYWHERE YET — this is the machinery Slice 11 wires up
 * when it builds the actual admin panel and its trigger. Usage, once
 * Slice 11 exists:
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
 * Legacy's one-shot `futa:authchange` listener (app.js ~3677–3683) is
 * replaced with a plain `pendingRef` flag checked by the *caller* — once
 * Slice 11 re-renders this hook with a non-null `user` while a request is
 * pending, `useAdminPin` has no `useEffect` of its own to react to that
 * automatically. Flagged here rather than guessed: Slice 11 should watch
 * `user` itself and call `requestAdminAccess` again on the same callback
 * once it goes non-null, OR this hook should grow a `useEffect` at that
 * point — deferred rather than built speculatively against a caller that
 * doesn't exist yet.
 */
export function useAdminPin(user, openAuthModal) {
  const [pinOpen, setPinOpen] = useState(false);
  const successRef = useRef(null);

  const requestAdminAccess = useCallback((onGranted) => {
    if (!user) {
      // Legacy: a blocking `alert()` (app.js ~3672) — matched as-is,
      // it's a rare admin-only path, not worth a styled toast for.
      window.alert('Please sign in with your admin account first, then reopen the admin panel.');
      openAuthModal?.('login');
      return;
    }
    successRef.current = onGranted;
    setPinOpen(true);
  }, [user, openAuthModal]);

  const handleSuccess = useCallback(() => {
    setPinOpen(false);
    successRef.current?.();
    successRef.current = null;
  }, []);

  const closePinGate = useCallback(() => {
    setPinOpen(false);
    successRef.current = null;
  }, []);

  return { pinOpen, requestAdminAccess, handleSuccess, closePinGate };
}
