import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import { supabase } from '../lib/supabase';
import styles from './ResetPasswordPage.module.css';

// ── Password recovery landing page ──────────────────────────────────────
//
// This is where `resetPassword()`'s email link (useAuth.js) redirects to,
// instead of the site root. Clicking that link makes supabase-js parse a
// recovery token out of the URL and establish a real session automatically
// — `onAuthStateChange` fires a `PASSWORD_RECOVERY` event for it. Landing
// that anywhere else (e.g. `/`) means the app just sees "a session showed
// up" and treats it like a normal sign-in, so the person ends up logged
// in with their OLD password never having changed. This page exists
// specifically to intercept that moment: confirm the recovery session,
// collect a new password via `supabase.auth.updateUser()`, then sign out
// so they come back through the normal Sign In form with the new one —
// matching "reset password → set new password → log in again", not
// "click link → silently logged in."
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  // 'verifying' | 'ready' | 'invalid' | 'success'
  const [status, setStatus] = useState('verifying');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const { data: listener } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') setStatus('ready');
    });

    // The PASSWORD_RECOVERY event only fires once, at the moment
    // supabase-js finishes parsing the link's token out of the URL —
    // if that already happened a beat before this listener subscribed,
    // we'd miss it. Fall back to checking for a live session directly;
    // if neither shows up after a couple seconds, the link is dead
    // (expired/already used) rather than just slow.
    let cancelled = false;
    supabase.auth.getSession().then(({ data }) => {
      if (cancelled) return;
      if (data.session) {
        setStatus((s) => (s === 'verifying' ? 'ready' : s));
      } else {
        setTimeout(() => {
          if (!cancelled) setStatus((s) => (s === 'verifying' ? 'invalid' : s));
        }, 2500);
      }
    });

    return () => {
      cancelled = true;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function handleSubmit() {
    setError('');
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    try {
      const { error: updateError } = await supabase.auth.updateUser({ password });
      if (updateError) throw updateError;
      // Don't leave them signed in on the recovery session — send them
      // back through a real sign-in with the password they just set.
      await supabase.auth.signOut();
      setStatus('success');
    } catch (err) {
      setError(err?.message || 'Something went wrong. Try again.');
    } finally {
      setBusy(false);
    }
  }

  function enterSubmits(e) {
    if (e.key === 'Enter') handleSubmit();
  }

  return (
    <div className={styles.page}>
      <div className={styles.card}>
        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="10" r="4" stroke="var(--primary)" strokeWidth="1.8" />
              <path d="M12 2C7.03 2 3 6.03 3 11c0 5.25 7.5 11 9 11s9-5.75 9-11c0-4.97-4.03-9-9-9z" stroke="var(--primary)" strokeWidth="1.8" fill="rgba(221,183,255,0.10)" />
            </svg>
          </div>
          <div className={styles.brandText}>Maps By Futa</div>
        </div>

        {status === 'verifying' && (
          <p className={styles.info}>Verifying your reset link…</p>
        )}

        {status === 'invalid' && (
          <>
            <h1 className={styles.title}>Link expired</h1>
            <p className={styles.info}>
              This password reset link is invalid or has expired. Go back and request a new one from the Sign In screen.
            </p>
            <Link to="/" className={styles.submitBtn}>Back to Maps By Futa</Link>
          </>
        )}

        {status === 'ready' && (
          <>
            <h1 className={styles.title}>Set a new password</h1>
            <p className={styles.info}>Choose a new password for your account.</p>

            <div className={styles.field}>
              <label>New password</label>
              <div className={styles.passwordWrap}>
                <input
                  type={showPw ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min. 6 characters"
                  autoComplete="new-password"
                  onKeyDown={enterSubmits}
                />
                <button type="button" className={styles.pwToggle} onClick={() => setShowPw((s) => !s)}>
                  {showPw ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>

            <div className={styles.field}>
              <label>Confirm password</label>
              <input
                type={showPw ? 'text' : 'password'}
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                placeholder="Re-enter password"
                autoComplete="new-password"
                onKeyDown={enterSubmits}
              />
            </div>

            {error && (
              <div className={`${styles.status} ${styles.statusError}`}>
                <TriangleAlert size={12} /> {error}
              </div>
            )}

            <button type="button" className={styles.submitBtn} onClick={handleSubmit} disabled={busy}>
              {busy ? 'Saving…' : 'Save new password'}
            </button>
          </>
        )}

        {status === 'success' && (
          <>
            <div className={`${styles.status} ${styles.statusOk}`}>
              <CheckCircle2 size={14} /> Password updated — please sign in with your new password.
            </div>
            <button type="button" className={styles.submitBtn} onClick={() => navigate('/')}>
              Go to sign in
            </button>
          </>
        )}
      </div>
    </div>
  );
}
