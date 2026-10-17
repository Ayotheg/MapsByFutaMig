import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import { DEFAULT_TIMEOUT_MS } from '../../lib/networkTimeout';
import { signOutOrThrow } from './signOut';

// ── FUTA Auth — Supabase Auth port of legacy's `initFutaAuth()` ────────────
//
// Legacy is Firebase Auth (compat SDK) with a global `window.FUTA_USER` +
// a `futa:authchange` DOM event other modules listen to. This port has no
// global mutable state or DOM events — `useAuth()` is called once in
// `MapPage.jsx` (same "lift shared state up, pass down as props" pattern
// already established for `gps`/`viewMode`/`waypoints` — this codebase
// doesn't use React Context anywhere, confirmed by grep, so this doesn't
// introduce a new pattern) and its `user` is threaded down to
// `Sidebar`/`MobFabCluster`/`AuthModal`/(later) `AdminPinGate`.
//
// Supabase's `onAuthStateChange` fires immediately on subscribe with the
// current session (or null), which is what `loading` below tracks — no
// separate `getSession()` call needed before subscribing.
export function useAuth() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // `settled` guards against the failsafe below firing after the real
    // callback already has — whichever happens first wins, the other is
    // a no-op.
    let settled = false;

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      settled = true;
      setUser(session?.user ?? null);
      setLoading(false);
    });

    // Failsafe, same family as useWaypoints.js/useSegments.js's own 8s
    // per-request timeouts. `onAuthStateChange` fires immediately with a
    // *cached* session in the normal case, but Supabase still needs a
    // network round-trip to validate/refresh a stored token — on a
    // degraded connection that request can hang with nothing here to time
    // it out otherwise, which is exactly the "one thing still gets stuck"
    // gap HomeRoute.jsx's BOOT_TIMEOUT_MS was covering for from the
    // outside. Treating "no answer within a reasonable window" as
    // signed-out is a fine default for boot purposes: the map itself
    // doesn't require auth, and anyone who really is signed in can just
    // retry once their connection is better — what matters here is that
    // `authReady` can't stay false forever.
    const timer = setTimeout(() => {
      if (!settled) {
        settled = true;
        setLoading(false);
      }
    }, DEFAULT_TIMEOUT_MS);

    return () => {
      clearTimeout(timer);
      listener.subscription.unsubscribe();
    };
  }, []);

  // ── Google OAuth ──────────────────────────────────────────────────────
  // Legacy: `new firebase.auth.GoogleAuthProvider()` + `signInWithPopup`
  // (app.js ~7224–7236). Supabase Auth doesn't do a same-tab popup for
  // OAuth — `signInWithOAuth` redirects the whole page to Google, then
  // back to `redirectTo` with the session in the URL, which supabase-js
  // auto-detects on load. Real, flagged behavior difference from legacy's
  // popup (no `auth/popup-closed-by-user` case here — closing/cancelling
  // just leaves the user on Google's page or bounces back with no
  // session, `onAuthStateChange` simply never fires a signed-in event).
  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: `${window.location.origin}/map` },
    });
    if (error) throw error;
  }, []);

  // ── Email/Password ───────────────────────────────────────────────────
  const signInWithEmail = useCallback(async (email, password) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  // Legacy also sets `updateProfile({ displayName: name })` and writes a
  // Firestore `users/{uid}` doc (app.js ~7287–7303). Supabase equivalent:
  // pass `data: { display_name }` as OAuth-style user metadata on signUp
  // (lands in `auth.users.raw_user_meta_data`, no separate table write
  // needed for the name itself) — the `profiles` row for review/nav
  // counts is created separately by a DB trigger (`handle_new_user`).
  // Email confirmation is turned off in Supabase, so `data.session` is set
  // and the person is signed in straight away. Returned so the caller can
  // tell if confirmation is ever switched back on (session would be null).
  // `marketing_opt_in` is copied into profiles once the account is
  // confirmed (supabase/marketing_optin.sql C3), never before.
  const signUpWithEmail = useCallback(async (name, email, password, marketingOptIn = false) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name, marketing_opt_in: marketingOptIn === true } },
    });
    if (error) throw error;
    return data;
  }, []);

  // 'none' | 'password' | 'oauth', or null if the check itself failed
  // (e.g. supabase/auth_email_status.sql not run yet). Used by AuthFlow
  // after a failed password sign-in to decide between "Wrong password"
  // and "Create your account".
  const checkEmailStatus = useCallback(async (email) => {
    const { data, error } = await supabase.rpc('auth_email_status', { p_email: email });
    if (error) {
      console.error('auth_email_status failed:', error);
      return null;
    }
    return data;
  }, []);

  // Legacy: `auth.sendPasswordResetEmail(email)` (app.js ~7264–7275).
  //
  // redirectTo points at `/reset-password`, NOT the site root. Supabase's
  // recovery link logs the browser into a real (if short-lived) session
  // the instant it's clicked — landing that on `/` with no dedicated
  // handler means `onAuthStateChange` above just sees "a session showed
  // up" and treats it like any other sign-in, dropping the person straight
  // into the app already authenticated and skipping the "choose a new
  // password" step entirely. `/reset-password` (ResetPasswordPage.jsx)
  // is the dedicated landing spot: it catches the `PASSWORD_RECOVERY`
  // event, prompts for a new password via `updateUser`, then signs out
  // and sends them to sign in again with it — matching the intended
  // "reset, then log in with the new password" flow instead of an
  // auto-login side effect of the link.
  //
  // Oct 2026: the sign-in card now resets with a code instead of the link.
  // The "Reset Password" email template in Supabase must show
  // `{{ .Token }}` (the code) — see AuthFlow.jsx. redirectTo is kept only
  // so any old link still lands on ResetPasswordPage, not a silent login.
  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    if (error) throw error;
  }, []);

  // Code-based reset (AuthFlow's "Reset your password" step). verifyOtp
  // briefly signs the person in on a recovery session — needed to call
  // updateUser — then we sign straight out so they sign in again with the
  // new password. Split in two because a code is single use: if the new
  // password is rejected, the retry only calls setNewPassword.
  const verifyRecoveryCode = useCallback(async (email, code) => {
    const { error } = await supabase.auth.verifyOtp({ email, token: code, type: 'recovery' });
    if (error) throw error;
  }, []);

  // Change email (account card). Re-checks the current password first, so
  // an unattended signed-in device can't be used to move the account to
  // another inbox. Supabase then emails a code to the NEW address only —
  // requires "Secure email change" OFF (otherwise the old inbox, which the
  // person may have lost, must confirm too) and the "Change Email Address"
  // template showing `{{ .Token }}`.
  const requestEmailChange = useCallback(async (currentEmail, password, newEmail) => {
    const { error: pwError } = await supabase.auth.signInWithPassword({ email: currentEmail, password });
    if (pwError) {
      if (pwError.code === 'invalid_credentials') {
        const wrong = new Error('Wrong password.');
        wrong.code = 'wrong_current_password';
        throw wrong;
      }
      throw pwError;
    }
    const { error } = await supabase.auth.updateUser({ email: newEmail });
    if (error) throw error;
  }, []);

  const confirmEmailChange = useCallback(async (newEmail, code) => {
    const { error } = await supabase.auth.verifyOtp({ email: newEmail, token: code, type: 'email_change' });
    if (error) throw error;
  }, []);

  const setNewPassword = useCallback(async (password) => {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    await signOutOrThrow(supabase.auth);
  }, []);

  // `supabase.auth.signOut()` resolves with `{ error }` rather than throwing,
  // so it used to look successful even when it failed. `signOutOrThrow`
  // rethrows that error; callers (AuthModal) must catch it and keep the
  // user informed instead of assuming they're signed out. See signOut.js.
  const signOut = useCallback(() => signOutOrThrow(supabase.auth), []);

  return { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, checkEmailStatus, resetPassword, verifyRecoveryCode, setNewPassword, requestEmailChange, confirmEmailChange, signOut };
}

// ── Display helpers ──────────────────────────────────────────────────────
// Mirrors legacy's inline `user.displayName || 'You'`/`'Futarian'` and
// `initials()` (app.js ~7163–7166, ~7328, ~7393).
export function displayName(user) {
  return user?.user_metadata?.display_name || user?.email?.split('@')[0] || 'Futarian';
}

export function initials(user) {
  const name = user?.user_metadata?.display_name || user?.email;
  if (!name) return '?';
  return name
    .split(/[\s@]+/)
    .filter(Boolean)
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();
}

// ── Error messages ────────────────────────────────────────────────────────
// Legacy's `friendlyError()` (app.js ~7142–7155) maps Firebase's
// `err.code` (e.g. `auth/wrong-password`) to plain English. Supabase
// GoTrue errors use a different, flatter `error.code` vocabulary (e.g.
// `invalid_credentials`, `user_already_exists`) — this is a genuinely
// different error surface, not a guess at what Firebase would say, so
// mapped fresh from Supabase's own codes rather than reusing legacy's
// Firebase-specific map verbatim.
const ERROR_MESSAGES = {
  invalid_credentials: 'Email or password is incorrect. If you signed up with Google, please use the Google button.',
  user_already_exists: 'This email is already registered. Sign in instead.',
  weak_password: 'Password must be at least 6 characters.',
  email_not_confirmed: 'Please confirm your email before signing in (Check your email for the confirmation link).',
  over_email_send_rate_limit: 'Too many attempts. Try again later.',
  validation_failed: 'Please enter a valid email address.',
  otp_expired: 'That code is wrong or has expired. Check the latest email, or resend a new code.',
  same_password: 'Choose a password different from your old one.',
  wrong_current_password: 'Wrong password.',
  email_exists: 'Another account already uses that email.',
  over_request_rate_limit: 'Too many attempts. Wait a minute and try again.',
};

export function friendlyError(err) {
  return ERROR_MESSAGES[err?.code] || err?.message || 'Something went wrong. Try again.';
}
