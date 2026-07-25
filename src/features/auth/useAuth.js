import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';

// ── FUTA Auth — Supabase Auth port of legacy's `initFutaAuth()` ────────────
//
// Legacy source: app.js ~7073–7421 (the real `initFutaAuth` IIFE — NOT
// ~2744–3095 as MIGRATION_PLAN.md's Slice 10 entry originally said; that
// range is actually `_cacheRead`/OSM-dedup code, unrelated to auth. Same
// "plan's line range is a starting pointer, not gospel" lesson Slices
// 4/5/7/8 already hit — found by grepping for `initFutaAuth`/`FUTA_AUTH`.
// Corrected in MIGRATION_PLAN.md's Slice 10 row).
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
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setLoading(false);
    });
    return () => listener.subscription.unsubscribe();
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
  // NOT YET CONFIRMED LIVE: needs the Google OAuth client re-registered
  // under Supabase Auth (FIREBASE_TO_SUPABASE_MIGRATION.md's Step 5) —
  // flagged in MIGRATION_PLAN.md's tracker row, not assumed done here.
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
  // counts is created separately by a DB trigger, see
  // FIREBASE_TO_SUPABASE_MIGRATION.md's new "Step 7".
  const signUpWithEmail = useCallback(async (name, email, password) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { display_name: name } },
    });
    if (error) throw error;
  }, []);

  // Legacy: `auth.sendPasswordResetEmail(email)` (app.js ~7264–7275).
  const resetPassword = useCallback(async (email) => {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin,
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
  }, []);

  return { user, loading, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut };
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
  invalid_credentials: 'Email or password is incorrect.',
  user_already_exists: 'This email is already registered. Sign in instead.',
  weak_password: 'Password must be at least 6 characters.',
  email_not_confirmed: 'Please confirm your email before signing in.',
  over_email_send_rate_limit: 'Too many attempts. Try again later.',
  validation_failed: 'Please enter a valid email address.',
};

export function friendlyError(err) {
  return ERROR_MESSAGES[err?.code] || err?.message || 'Something went wrong. Try again.';
}
