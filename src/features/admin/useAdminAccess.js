import { useCallback, useEffect, useState } from 'react';
import { useAuth, friendlyError } from '../auth/useAuth';
import { fetchIsAdmin } from '../waypoints/submitWaypoint';

/**
 * Gate for the /admin page. Signing in with email + password is the whole
 * flow: the database trusts `auth.uid()` and `profiles.is_admin`, so that
 * is what's checked here too (no PIN).
 *
 * status: 'loading' | 'signed-out' | 'checking' | 'denied' | 'ready'
 */
export function useAdminAccess() {
  const auth = useAuth();
  const { user, loading: authLoading, signInWithEmail, signOut } = auth;
  const [isAdmin, setIsAdmin] = useState(null); // null = not checked yet
  const [checkError, setCheckError] = useState(null);

  const userId = user?.id;
  useEffect(() => {
    let cancelled = false;
    setIsAdmin(null);
    setCheckError(null);
    if (!userId) return undefined;
    fetchIsAdmin(userId)
      .then((admin) => !cancelled && setIsAdmin(admin))
      .catch((e) => {
        if (cancelled) return;
        setCheckError(friendlyError(e));
        setIsAdmin(false);
      });
    return () => {
      cancelled = true;
    };
  }, [userId]);

  const signIn = useCallback(
    async (email, password) => {
      await signInWithEmail(email.trim(), password);
    },
    [signInWithEmail]
  );

  let status = 'ready';
  if (authLoading) status = 'loading';
  else if (!user) status = 'signed-out';
  else if (isAdmin === null) status = 'checking';
  else if (!isAdmin) status = 'denied';

  return { status, user, signIn, signOut, checkError };
}
