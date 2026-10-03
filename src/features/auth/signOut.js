// ── Sign-out result handling ─────────────────────────────────────────────
//
// `supabase.auth.signOut()` does not throw on failure — it resolves with
// `{ error }`. The previous `signOut` ignored that value, so the modal
// closed as though sign-out had worked even when the request failed (and,
// for network failures, supabase-js keeps the local session — the user is
// still signed in).
//
// `client` is a supabase-js `auth` client (`supabase.auth`); injected so the
// behaviour is unit-testable without the real client.

export const SIGN_OUT_FAILED_MESSAGE = "Couldn't sign you out. Check your connection and try again.";

export async function signOutOrThrow(authClient) {
  let result;
  try {
    result = await authClient.signOut();
  } catch (err) {
    // Some failures (e.g. fetch rejecting) can surface as a throw instead.
    throw err instanceof Error ? err : new Error(String(err));
  }
  if (result?.error) throw result.error;
}
