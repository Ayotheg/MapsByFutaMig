import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, EyeOff, TriangleAlert, CheckCircle2, X } from 'lucide-react';
import styles from './AuthFlow.module.css';
import { openTawkChat } from '../../lib/tawk';
import { CONTACT_EMAIL } from '../../lib/contactInfo';
import senateBuilding from '../../assets/SENATE_BUILDING.jpg';
import albertIlemobade from '../../assets/ALBERT-ILEMOBADE LIBRARY.jpg';
import sls from '../../assets/SLS.jpg';
import tiFrancis from '../../assets/TI_FRANCIS.jpg';

/**
 * Sign-in / sign-up card (Auth Redesign canvas, Oct 2026). One email-first
 * flow instead of Sign In / Create Account tabs:
 *
 *   email ──Continue──▶ password ──Continue──▶ signed in
 *                            │  wrong password → "Wrong password" + Forgot
 *                            └─ no account     → create ──▶ signed in
 *
 * Supabase answers `invalid_credentials` for both a wrong password and an
 * unknown email, so after that error we ask `checkEmailStatus` (the
 * `auth_email_status` RPC, supabase/auth_email_status.sql) which it was.
 * If that check fails we can't tell, so "Wrong password" also offers
 * "Create an account".
 *
 * Forgot password? → we email a code (no link) and the card fades to
 * "Reset your password": code + new password + confirm. Saving verifies
 * the code (a short recovery session), sets the password, signs out, and
 * returns to the password step so they sign in with the new one. The
 * Supabase "Reset Password" email template must show `{{ .Token }}`.
 *
 * "Can't access this email?" (quiet link under the password step's
 * button) → a help step: know your password → sign in and change email
 * from the account card; forgot it too → live chat / email support, since
 * moving an account with neither password nor inbox needs a human check.
 *
 * Steps fade out/in (FADE_MS) on Continue / Change. On desktop the card
 * sits beside a campus photo slideshow; on mobile it's the card alone.
 */

const FADE_MS = 160;
const SLIDE_MS = 5000;
const DESKTOP_QUERY = '(min-width: 1024px) and (min-height: 600px)';
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SLIDES = [
  { place: 'Senate Building', photo: senateBuilding },
  { place: 'Albert Ilemobade Library', photo: albertIlemobade },
  { place: 'SLS', photo: sls },
  { place: 'TI Francis', photo: tiFrancis },
];

const TITLES = {
  email: 'Welcome',
  password: 'Enter your password',
  create: 'Create your account',
  reset: 'Reset your password',
  help: 'Can’t access your email?',
};

function prefersReducedMotion() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function useMediaQuery(query) {
  const [matches, setMatches] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const mq = window.matchMedia(query);
    const onChange = () => setMatches(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, [query]);
  return matches;
}

export default function AuthFlow({ onClose, signInWithGoogle, signInWithEmail, signUpWithEmail, checkEmailStatus, resetPassword, verifyRecoveryCode, setNewPassword, signOut, friendlyError, message }) {
  const isDesktop = useMediaQuery(DESKTOP_QUERY);

  const [step, setStep] = useState('email');
  const [leaving, setLeaving] = useState(false);
  const fadeTimer = useRef(null);
  useEffect(() => () => clearTimeout(fadeTimer.current), []);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw] = useState(false);
  const [name, setName] = useState('');
  const [busy, setBusy] = useState(false);
  // { text, error, kind } — kind: 'wrong' | 'wrong-unknown' | 'google' adds an action
  const [status, setStatus] = useState(null);

  // Reset step
  const [code, setCode] = useState('');
  const [confirmPw, setConfirmPw] = useState('');
  // True once the code is verified and a recovery session exists. If the
  // card closes before the new password is saved, sign that session out
  // so the code never leaves anyone signed in.
  const recoveryOpen = useRef(false);
  const signOutRef = useRef(signOut);
  signOutRef.current = signOut;
  useEffect(() => () => {
    if (recoveryOpen.current) signOutRef.current().catch((err) => console.error('Recovery sign-out failed:', err));
  }, []);

  function goTo(next, nextStatus = null) {
    setStatus(null);
    const ms = prefersReducedMotion() ? 0 : FADE_MS;
    setLeaving(true);
    clearTimeout(fadeTimer.current);
    fadeTimer.current = setTimeout(() => {
      setStep(next);
      setStatus(nextStatus);
      setLeaving(false);
    }, ms);
  }

  function changeEmail() {
    endRecovery();
    setPassword('');
    setConfirmPw('');
    setShowPw(false);
    goTo('email');
  }

  async function handleGoogle() {
    setStatus(null);
    try {
      await signInWithGoogle();
      // Full-page redirect — nothing more happens client-side here.
    } catch (err) {
      setStatus({ text: friendlyError(err), error: true });
    }
  }

  function handleEmailContinue(e) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!EMAIL_RE.test(trimmed)) {
      setStatus({ text: 'Enter a valid email address.', error: true });
      return;
    }
    setEmail(trimmed);
    goTo('password');
  }

  async function handlePasswordContinue(e) {
    e.preventDefault();
    if (busy) return;
    if (!password) {
      setStatus({ text: 'Enter your password.', error: true });
      return;
    }
    setStatus(null);
    setBusy(true);
    try {
      await signInWithEmail(email, password);
      onClose();
      return;
    } catch (err) {
      if (err?.code !== 'invalid_credentials') {
        setStatus({ text: friendlyError(err), error: true });
        return;
      }
      const account = await checkEmailStatus(email);
      if (account === 'none') {
        goTo('create');
      } else if (account === 'oauth') {
        setStatus({ text: 'This email signs in with Google.', error: true, kind: 'google' });
      } else {
        setStatus({ text: 'Wrong password.', error: true, kind: account === 'password' ? 'wrong' : 'wrong-unknown' });
      }
    } finally {
      setBusy(false);
    }
  }

  async function sendCode() {
    await resetPassword(email);
    return { text: `We sent a code to ${email}. It may take a minute to arrive.`, error: false };
  }

  async function handleForgot() {
    if (busy) return;
    setBusy(true);
    try {
      const sent = await sendCode();
      setCode('');
      setPassword('');
      setConfirmPw('');
      setShowPw(false);
      goTo('reset', sent);
    } catch (err) {
      setStatus({ text: friendlyError(err), error: true, kind: status?.kind });
    } finally {
      setBusy(false);
    }
  }

  async function handleResend() {
    if (busy) return;
    setBusy(true);
    try {
      setStatus(await sendCode());
    } catch (err) {
      setStatus({ text: friendlyError(err), error: true });
    } finally {
      setBusy(false);
    }
  }

  async function handleReset(e) {
    e.preventDefault();
    if (busy) return;
    const token = code.replace(/\s/g, '');
    if (!recoveryOpen.current && !/^\d{6,8}$/.test(token)) {
      setStatus({ text: 'Enter the code from your email.', error: true });
      return;
    }
    if (password.length < 6) {
      setStatus({ text: 'Password must be at least 6 characters.', error: true });
      return;
    }
    if (password !== confirmPw) {
      setStatus({ text: 'Passwords do not match.', error: true });
      return;
    }
    setStatus(null);
    setBusy(true);
    try {
      if (!recoveryOpen.current) {
        await verifyRecoveryCode(email, token);
        recoveryOpen.current = true;
      }
      await setNewPassword(password);
      recoveryOpen.current = false;
      setPassword('');
      setConfirmPw('');
      setShowPw(false);
      goTo('password', { text: 'Password changed. Sign in with your new password.', error: false });
    } catch (err) {
      setStatus({ text: friendlyError(err), error: true });
    } finally {
      setBusy(false);
    }
  }

  // Live chat only exists on the map/promote pages; elsewhere fall back to email.
  function handleChat() {
    if (openTawkChat()) onClose();
    else window.location.href = `mailto:${CONTACT_EMAIL}`;
  }

  function endRecovery() {
    if (!recoveryOpen.current) return;
    recoveryOpen.current = false;
    signOut().catch((err) => console.error('Recovery sign-out failed:', err));
  }

  function handleResetBack() {
    endRecovery();
    setPassword('');
    setConfirmPw('');
    goTo('password');
  }

  async function handleCreate(e) {
    e.preventDefault();
    if (busy) return;
    if (!name.trim()) {
      setStatus({ text: 'Enter your full name.', error: true });
      return;
    }
    if (password.length < 6) {
      setStatus({ text: 'Password must be at least 6 characters.', error: true });
      return;
    }
    setStatus(null);
    setBusy(true);
    try {
      const data = await signUpWithEmail(name.trim(), email, password);
      if (data?.session) {
        onClose();
      } else {
        setStatus({ text: `Check ${email} for a link to confirm your account.`, error: false });
      }
    } catch (err) {
      setStatus({ text: friendlyError(err), error: true });
    } finally {
      setBusy(false);
    }
  }

  const passwordField = (autoComplete) => (
    <div className={styles.inputWrap}>
      <input
        id="auth-password"
        className={styles.hasToggle}
        type={showPw ? 'text' : 'password'}
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        autoComplete={autoComplete}
        autoFocus={step === 'password'}
      />
      <button type="button" className={styles.pwToggle} onClick={() => setShowPw((s) => !s)} aria-label={showPw ? 'Hide password' : 'Show password'}>
        {showPw ? <EyeOff size={18} /> : <Eye size={18} />}
      </button>
    </div>
  );

  // Hidden username field so password managers pair the saved password
  // with the right email on the password / create steps.
  const usernameField = (
    <input className={styles.srOnly} type="email" name="username" autoComplete="username" value={email} readOnly tabIndex={-1} aria-hidden="true" />
  );

  const emailChip = (
    <div className={styles.emailChip}>
      <span className={styles.chipAvatar} aria-hidden="true">{email.charAt(0).toUpperCase()}</span>
      <span className={styles.chipEmail}>{email}</span>
      <button type="button" className={styles.linkBtn} onClick={changeEmail}>Change</button>
    </div>
  );

  return (
    <div className={styles.shell} role="dialog" aria-modal="true" aria-labelledby="auth-title">
      <div className={styles.cardCol}>
        <div className={`${styles.step} ${leaving ? styles.stepOut : styles.stepIn}`} key={step}>
          <img className={styles.logo} src="/android-chrome-512x512.png" alt="" width={40} height={40} />
          <h2 id="auth-title" className={styles.title}>{TITLES[step]}</h2>
          {step === 'email' && <p className={styles.subtitle}>Sign in or create an account with your email.</p>}

          {message && step === 'email' && <div className={styles.limitMessage}>{message}</div>}

          {step === 'email' && (
            <form className={styles.form} onSubmit={handleEmailContinue} noValidate>
              <GoogleButton onClick={handleGoogle} />
              <div className={styles.divider}><span>or</span></div>
              <label className={styles.label} htmlFor="auth-email">Email address</label>
              <input
                id="auth-email"
                className={styles.input}
                type="email"
                inputMode="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@gmail.com"
                autoComplete="email"
              />
              {status && <StatusMsg status={status} />}
              <button type="submit" className={styles.primaryBtn}>Continue</button>
            </form>
          )}

          {step === 'password' && (
            <form className={styles.form} onSubmit={handlePasswordContinue} noValidate>
              {emailChip}
              {usernameField}
              <label className={styles.label} htmlFor="auth-password">Password</label>
              {passwordField('current-password')}
              {status && (
                <StatusMsg status={status}>
                  {(status.kind === 'wrong' || status.kind === 'wrong-unknown') && (
                    <button type="button" className={styles.statusAction} onClick={handleForgot} disabled={busy}>Forgot password?</button>
                  )}
                </StatusMsg>
              )}
              {status?.kind === 'wrong-unknown' && (
                <button type="button" className={`${styles.linkBtn} ${styles.altLink}`} onClick={() => goTo('create')}>
                  New here? Create an account
                </button>
              )}
              {status?.kind === 'google' ? (
                <GoogleButton onClick={handleGoogle} />
              ) : (
                <button type="submit" className={styles.primaryBtn} disabled={busy}>
                  {busy ? 'Please wait…' : 'Continue'}
                </button>
              )}
              <button type="button" className={styles.quietLink} onClick={() => goTo('help')}>
                Can’t access this email?
              </button>
            </form>
          )}

          {step === 'help' && (
            <div className={styles.form}>
              {emailChip}
              <p className={styles.helpText}>
                <strong>Still know your password?</strong> Sign in, then open your account and tap <strong>Change</strong> next to your email.
              </p>
              <button type="button" className={styles.primaryBtn} onClick={() => goTo('password')} autoFocus>
                Back to sign in
              </button>
              <p className={`${styles.helpText} ${styles.helpTextSpaced}`}>
                <strong>Forgot your password too?</strong> We can move your account to a new email after a quick check that it’s yours.
              </p>
              <div className={styles.helpActions}>
                <button type="button" className={styles.secondaryBtn} onClick={handleChat}>Chat with us</button>
                <a className={styles.secondaryBtn} href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent('Can’t access my email')}&body=${encodeURIComponent(`Account email: ${email}\n\n`)}`}>
                  Email us
                </a>
              </div>
            </div>
          )}

          {step === 'reset' && (
            <form className={styles.form} onSubmit={handleReset} noValidate>
              {emailChip}
              {usernameField}
              <label className={styles.label} htmlFor="auth-code">Code from your email</label>
              <input
                id="auth-code"
                className={`${styles.input} ${styles.codeInput}`}
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={8}
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                placeholder="123456"
                autoFocus
              />
              <label className={styles.label} htmlFor="auth-password">New password</label>
              {passwordField('new-password')}
              <label className={styles.label} htmlFor="auth-confirm">Confirm new password</label>
              <input
                id="auth-confirm"
                className={styles.input}
                type={showPw ? 'text' : 'password'}
                value={confirmPw}
                onChange={(e) => setConfirmPw(e.target.value)}
                autoComplete="new-password"
              />
              <div className={styles.hint}>At least 6 characters.</div>
              {status && <StatusMsg status={status} />}
              <button type="submit" className={styles.primaryBtn} disabled={busy}>
                {busy ? 'Saving…' : 'Save password'}
              </button>
              <div className={styles.resetLinks}>
                <button type="button" className={styles.linkBtn} onClick={handleResend} disabled={busy}>Resend code</button>
                <button type="button" className={styles.linkBtn} onClick={handleResetBack}>Back to sign in</button>
              </div>
            </form>
          )}

          {step === 'create' && (
            <form className={styles.form} onSubmit={handleCreate} noValidate>
              {emailChip}
              {usernameField}
              <label className={styles.label} htmlFor="auth-name">Full name</label>
              <input
                id="auth-name"
                className={styles.input}
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                autoComplete="name"
                autoFocus
              />
              <label className={styles.label} htmlFor="auth-password">Password</label>
              {passwordField('new-password')}
              <div className={styles.hint}>At least 6 characters.</div>
              {status && <StatusMsg status={status} />}
              <button type="submit" className={styles.primaryBtn} disabled={busy}>
                {busy ? 'Creating account…' : 'Create account'}
              </button>
              <p className={styles.legalLine}>
                By creating an account, you agree to our{' '}
                <Link to="/terms" onClick={onClose}>Terms</Link> and{' '}
                <Link to="/privacy" onClick={onClose}>Privacy Policy</Link>.
              </p>
            </form>
          )}
        </div>
      </div>

      {isDesktop && <Slideshow />}

      <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
        <X size={18} strokeWidth={2.25} />
      </button>
    </div>
  );
}

function Slideshow() {
  const [current, setCurrent] = useState(0);
  const [tick, setTick] = useState(0); // bumped on manual navigation to restart the timer

  useEffect(() => {
    if (prefersReducedMotion()) return;
    const id = setInterval(() => setCurrent((c) => (c + 1) % SLIDES.length), SLIDE_MS);
    return () => clearInterval(id);
  }, [tick]);

  function goTo(i) {
    setCurrent((i + SLIDES.length) % SLIDES.length);
    setTick((t) => t + 1);
  }

  return (
    <div className={styles.slideshow}>
      {SLIDES.map((s, i) => (
        <img
          key={s.place}
          className={`${styles.slide} ${i === current ? styles.slideActive : ''}`}
          src={s.photo}
          alt={i === current ? s.place : ''}
          aria-hidden={i === current ? undefined : 'true'}
        />
      ))}
      <div className={styles.slideScrim} />
      <div className={styles.caption}>
        <span className={styles.eyebrow}>On campus</span>
        <h3 className={styles.place} aria-live="polite">{SLIDES[current].place}</h3>
        <p className={styles.blurb}>Search any place on campus and get walking directions in a few taps.</p>
        <div className={styles.controls}>
          <div className={styles.dots}>
            {SLIDES.map((s, i) => (
              <button key={s.place} type="button" className={styles.dotBtn} onClick={() => goTo(i)} aria-label={`Show ${s.place}`} aria-current={i === current ? 'true' : undefined}>
                <span className={`${styles.dot} ${i === current ? styles.dotActive : ''}`} />
              </button>
            ))}
          </div>
          <div className={styles.arrows}>
            <button type="button" className={styles.glassBtn} onClick={() => goTo(current - 1)} aria-label="Previous place">
              <ChevronLeft size={18} />
            </button>
            <button type="button" className={styles.glassBtn} onClick={() => goTo(current + 1)} aria-label="Next place">
              <ChevronRight size={18} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function GoogleButton({ onClick }) {
  return (
    <button type="button" className={styles.googleBtn} onClick={onClick}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4" />
        <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853" />
        <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05" />
        <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335" />
      </svg>
      Continue with Google
    </button>
  );
}

function StatusMsg({ status, children }) {
  return (
    <div className={`${styles.status} ${status.error ? styles.statusError : styles.statusOk}`} role={status.error ? 'alert' : 'status'}>
      {status.error ? <TriangleAlert size={14} /> : <CheckCircle2 size={14} />}
      <span className={styles.statusText}>{status.text}</span>
      {children}
    </div>
  );
}
