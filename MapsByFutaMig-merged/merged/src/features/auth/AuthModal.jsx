import { useEffect, useState } from 'react';
import { CheckCircle2, TriangleAlert } from 'lucide-react';
import styles from './AuthModal.module.css';
import { supabase } from '../../lib/supabase';
import { displayName, initials } from './useAuth';

/**
 * Login / Signup / Profile tabbed modal — ported from legacy
 * `#authModalOverlay` (index.html ~1216–1336) + `initFutaAuth()`
 * (app.js ~7073–7421 — see `useAuth.js`'s header comment for the
 * MIGRATION_PLAN.md line-range correction).
 *
 * Does NOT reuse `components/ui/Modal.jsx`. Legacy itself uses a wholly
 * separate CSS namespace for this (`.auth-modal-overlay`/`.auth-modal`/
 * `.auth-modal-close`, grep-confirmed distinct from `.modal-overlay`/
 * `.modal`/`.modal-header`/`.modal-close` that DetailModal/SaveModal/
 * ReviewModal/AdminPinGate all share) — no `.modal-header`/`.modal-body`
 * structure at all, just an absolutely-positioned close button over a
 * brand block + tab switcher + panels. Forcing this through the shared
 * Modal shell (which enforces header+body(+footer)) would mean *inventing*
 * a structure legacy doesn't have, the opposite of "match what's there."
 *
 * Bundle-size policy (CLAUDE.md, Slice 10's own "known candidate" entry):
 * lazy-loaded from MapPage.jsx, only mounts once opened.
 *
 * `initialTab` mirrors legacy's `openModal(tab)` — MapPage passes
 * `user ? 'profile' : 'login'` (app.js ~7185–7189's exact same gate).
 */
export default function AuthModal({ initialTab, user, onClose, signInWithGoogle, signInWithEmail, signUpWithEmail, resetPassword, signOut, friendlyError, message }) {
  const [tab, setTab] = useState(initialTab);

  // Login fields
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPw, setLoginPw] = useState('');
  const [loginShowPw, setLoginShowPw] = useState(false);
  const [loginStatus, setLoginStatus] = useState(null); // { text, error }
  const [loginBusy, setLoginBusy] = useState(false);

  // Signup fields
  const [signupName, setSignupName] = useState('');
  const [signupEmail, setSignupEmail] = useState('');
  const [signupPw, setSignupPw] = useState('');
  const [signupShowPw, setSignupShowPw] = useState(false);
  const [signupStatus, setSignupStatus] = useState(null);
  const [signupBusy, setSignupBusy] = useState(false);

  // Profile stats — legacy's `loadProfileStats()` (app.js ~7379–7415),
  // fetched live each time the profile tab is shown.
  const [stats, setStats] = useState({ reviews: '…', navs: '…' });

  useEffect(() => {
    if (tab !== 'profile' || !user) return;
    let cancelled = false;
    (async () => {
      // Legacy reads `users/{uid}.reviewCount`/`.navCount` directly.
      // This port reads the same two counters from `profiles` (see
      // FIREBASE_TO_SUPABASE_MIGRATION.md's "Step 7") — `review_count`
      // is kept accurate by a trigger on every `reviews` insert (same
      // "recompute, don't trust a client increment" pattern Step 6
      // already used for waypoints' avg_rating). `nav_count` has no
      // writer wired yet — see this file's own flag further down and
      // Step 7's note — it will read back `0` until something increments
      // it, which is accurate (zero tracked so far), not broken.
      const { data, error } = await supabase
        .from('profiles')
        .select('review_count, nav_count')
        .eq('id', user.id)
        .single();
      if (cancelled) return;
      if (error) {
        setStats({ reviews: '—', navs: '—' });
      } else {
        setStats({ reviews: data.review_count ?? 0, navs: data.nav_count ?? 0 });
      }
    })();
    return () => { cancelled = true; };
  }, [tab, user]);

  function switchTab(next) {
    setTab(next);
  }

  async function handleGoogle() {
    try {
      await signInWithGoogle();
      // Full-page redirect — nothing more happens client-side here.
    } catch (err) {
      const setStatus = tab === 'signup' ? setSignupStatus : setLoginStatus;
      setStatus({ text: friendlyError(err), error: true });
    }
  }

  async function handleLogin() {
    setLoginStatus(null);
    if (!loginEmail.trim() || !loginPw) {
      setLoginStatus({ text: 'Please fill in all fields.', error: true });
      return;
    }
    setLoginBusy(true);
    try {
      await signInWithEmail(loginEmail.trim(), loginPw);
      onClose();
    } catch (err) {
      setLoginStatus({ text: friendlyError(err), error: true });
    } finally {
      setLoginBusy(false);
    }
  }

  async function handleForgot() {
    if (!loginEmail.trim()) {
      setLoginStatus({ text: 'Enter your email above first.', error: true });
      return;
    }
    try {
      await resetPassword(loginEmail.trim());
      setLoginStatus({ text: 'Reset email sent — check your inbox.', error: false });
    } catch (err) {
      setLoginStatus({ text: friendlyError(err), error: true });
    }
  }

  async function handleSignup() {
    setSignupStatus(null);
    if (!signupName.trim() || !signupEmail.trim() || !signupPw) {
      setSignupStatus({ text: 'Please fill in all fields.', error: true });
      return;
    }
    setSignupBusy(true);
    try {
      await signUpWithEmail(signupName.trim(), signupEmail.trim(), signupPw);
      onClose();
    } catch (err) {
      setSignupStatus({ text: friendlyError(err), error: true });
    } finally {
      setSignupBusy(false);
    }
  }

  async function handleSignOut() {
    await signOut();
    onClose();
  }

  function enterSubmits(handler) {
    return (e) => { if (e.key === 'Enter') handler(); };
  }

  const showTabs = tab !== 'profile';
  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

  return (
    <div className={styles.overlay} onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className={styles.modal}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
            <line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>

        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <svg width="28" height="28" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="10" r="4" stroke="var(--primary)" strokeWidth="1.8" />
              <path d="M12 2C7.03 2 3 6.03 3 11c0 5.25 7.5 11 9 11s9-5.75 9-11c0-4.97-4.03-9-9-9z" stroke="var(--primary)" strokeWidth="1.8" fill="rgba(221,183,255,0.10)" />
            </svg>
          </div>
          <div className={styles.brandText}>Maps By Futa</div>
          <div className={styles.brandSub}>Your campus, navigated.</div>
        </div>

        {message && <div className={styles.limitMessage}>{message}</div>}

        {showTabs && (
          <div className={styles.tabs}>
            <button type="button" className={`${styles.tab} ${tab === 'login' ? styles.tabActive : ''}`} onClick={() => switchTab('login')}>
              Sign In
            </button>
            <button type="button" className={`${styles.tab} ${tab === 'signup' ? styles.tabActive : ''}`} onClick={() => switchTab('signup')}>
              Create Account
            </button>
          </div>
        )}

        {tab === 'login' && (
          <div className={styles.panel}>
            <GoogleButton label="Continue with Google" onClick={handleGoogle} />
            <Divider />
            <Field label="Email">
              <input type="email" value={loginEmail} onChange={(e) => setLoginEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" onKeyDown={enterSubmits(handleLogin)} />
            </Field>
            <Field label="Password">
              <PasswordInput value={loginPw} onChange={setLoginPw} show={loginShowPw} onToggleShow={() => setLoginShowPw((s) => !s)} autoComplete="current-password" onKeyDown={enterSubmits(handleLogin)} />
            </Field>
            <button type="button" className={styles.forgotLink} onClick={handleForgot}>Forgot password?</button>
            {loginStatus && <StatusMsg status={loginStatus} />}
            <button type="button" className={styles.submitBtn} onClick={handleLogin} disabled={loginBusy}>
              {loginBusy ? 'Please wait…' : 'Sign In'}
            </button>
          </div>
        )}

        {tab === 'signup' && (
          <div className={styles.panel}>
            <GoogleButton label="Sign up with Google" onClick={handleGoogle} />
            <Divider />
            <Field label="Full Name">
              <input type="text" value={signupName} onChange={(e) => setSignupName(e.target.value)} placeholder="e.g. Ayo Adeleke" autoComplete="name" onKeyDown={enterSubmits(handleSignup)} />
            </Field>
            <Field label="Email">
              <input type="email" value={signupEmail} onChange={(e) => setSignupEmail(e.target.value)} placeholder="your@email.com" autoComplete="email" onKeyDown={enterSubmits(handleSignup)} />
            </Field>
            <Field label="Password">
              <PasswordInput value={signupPw} onChange={setSignupPw} show={signupShowPw} onToggleShow={() => setSignupShowPw((s) => !s)} placeholder="Min. 6 characters" autoComplete="new-password" onKeyDown={enterSubmits(handleSignup)} />
            </Field>
            {signupStatus && <StatusMsg status={signupStatus} />}
            <button type="button" className={styles.submitBtn} onClick={handleSignup} disabled={signupBusy}>
              {signupBusy ? 'Please wait…' : 'Create Account'}
            </button>
          </div>
        )}

        {tab === 'profile' && user && (
          <div className={styles.panel}>
            <div className={styles.profileAvatarWrap}>
              {avatarUrl ? (
                <img className={styles.profileAvatar} src={avatarUrl} alt="" />
              ) : (
                <div className={styles.profileInitials}>{initials(user)}</div>
              )}
            </div>
            <div className={styles.profileName}>{displayName(user)}</div>
            <div className={styles.profileEmail}>{user.email}</div>
            {joined && <div className={styles.profileJoined}>Member since {joined}</div>}

            <div className={styles.statsRow}>
              <div className={styles.stat}>
                <div className={styles.statVal}>{stats.reviews}</div>
                <div className={styles.statLabel}>Reviews</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statVal}>{stats.navs}</div>
                <div className={styles.statLabel}>Navigations</div>
              </div>
            </div>

            <button type="button" className={styles.signoutBtn} onClick={handleSignOut}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" /><polyline points="16 17 21 12 16 7" /><line x1="21" y1="12" x2="9" y2="12" />
              </svg>
              Sign Out
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function GoogleButton({ label, onClick }) {
  return (
    <button type="button" className={styles.googleBtn} onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      {label}
    </button>
  );
}

function Divider() {
  return <div className={styles.divider}><span>or</span></div>;
}

function Field({ label, children }) {
  return (
    <div className={styles.field}>
      <label>{label}</label>
      {children}
    </div>
  );
}

function PasswordInput({ value, onChange, show, onToggleShow, placeholder = '••••••••', autoComplete, onKeyDown }) {
  return (
    <div className={styles.passwordWrap}>
      <input
        type={show ? 'text' : 'password'}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        onKeyDown={onKeyDown}
      />
      <button type="button" className={styles.pwToggle} onClick={onToggleShow}>
        {show ? (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94" />
            <path d="M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19" />
            <line x1="1" y1="1" x2="23" y2="23" />
          </svg>
        ) : (
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
          </svg>
        )}
      </button>
    </div>
  );
}

function StatusMsg({ status }) {
  return (
    <div className={`${styles.status} ${status.error ? styles.statusError : styles.statusOk}`}>
      {status.error ? <TriangleAlert size={12} /> : <CheckCircle2 size={12} />} {status.text}
    </div>
  );
}
