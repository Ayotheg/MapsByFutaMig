import { useEffect, useRef, useState } from 'react';
import { CheckCircle2, TriangleAlert, X, Mail, LogOut, Megaphone } from 'lucide-react';
import styles from './AuthModal.module.css';
import AuthFlow from './AuthFlow';
import { supabase } from '../../lib/supabase';
import { displayName, initials } from './useAuth';
import { fetchProfileStats, statTileValue } from './profileStats';
import { fetchActivePromotion } from '../promote/activePromotion';
import { SIGN_OUT_FAILED_MESSAGE } from './signOut';
import WhatsAppIcon from '../../lib/WhatsAppIcon';
import { CONTACT_EMAIL, WHATSAPP_CHAT_URL } from '../../lib/contactInfo';
import { track } from '../../lib/analytics';

/**
 * Auth surface: sign-in flow when signed out, account card when signed in.
 * Lazy-loaded per the bundle-size policy (CLAUDE.md) — only mounts once
 * opened. Deliberately not built on `components/ui/Modal.jsx`.
 *
 * Signed out → AuthFlow.jsx (email-first Welcome → Password → Create
 * account). Any `initialTab` other than 'profile' (with a user) lands here.
 *
 * Signed in → account card (Auth Redesign canvas, Oct 2026,
 * "ProfileMobile"/"ProfileDesktop" artboards): avatar + name + email,
 * a three-cell stats strip (Reviews / Navigations / Joined), Sign out.
 *  - Mobile: centered card over a scrim, "Your account" header + close.
 *  - Desktop (>768px, where the Sidebar is shown): a popover with no scrim.
 *    The canvas anchors it under a top-right avatar, but the app's account
 *    button lives in the Sidebar footer, so it opens beside that instead.
 *  - Kept beyond the artboards so nothing is lost: the running-ad card
 *    (only for advertisers) and the Email / WhatsApp support links.
 */
export default function AuthModal({ initialTab, user, onClose, signInWithGoogle, signInWithEmail, signUpWithEmail, checkEmailStatus, resetPassword, verifyRecoveryCode, setNewPassword, signOut, friendlyError, message }) {
  // Opened signed out → stays the sign-in flow even if a session appears
  // mid-flow (the code reset briefly signs in before signing back out).
  const tab = initialTab === 'profile' && user ? 'profile' : 'auth';

  // Profile stats — legacy's `loadProfileStats()` (app.js ~7379–7415),
  // fetched live each time the account card is shown, from `profiles`
  // (supabase/profile_stats.sql). Four explicit states (profileStats.js):
  // only `ready` shows numbers — a missing row or a failed query is shown
  // as "—" plus a message and Retry, never as a valid-looking 0.
  const [stats, setStats] = useState({ status: 'loading' });
  const [statsAttempt, setStatsAttempt] = useState(0);
  const userId = user?.id;

  useEffect(() => {
    if (tab !== 'profile' || !userId) return;
    let cancelled = false;
    setStats({ status: 'loading' });
    fetchProfileStats(supabase, userId).then((result) => {
      if (!cancelled) setStats(result);
    });
    return () => { cancelled = true; };
  }, [tab, userId, statsAttempt]);

  // The account's running ad, if any (activePromotion.js) — re-fetched each
  // time the card opens, so "days left" counts down day by day.
  const [activeAd, setActiveAd] = useState(null);
  useEffect(() => {
    if (tab !== 'profile' || !userId) return;
    let cancelled = false;
    fetchActivePromotion(userId).then((result) => {
      if (!cancelled) setActiveAd(result);
    });
    return () => { cancelled = true; };
  }, [tab, userId]);

  // Sign-out: `signOut` rejects when Supabase returns an error (useAuth.js
  // → signOut.js). Only a resolved call closes the card; a failure keeps
  // it open with the reason shown, since the user may still be signed in.
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState(null);

  async function handleSignOut() {
    if (signOutBusy) return;
    setSignOutError(null);
    setSignOutBusy(true);
    try {
      await signOut();
      onClose();
    } catch (err) {
      console.error('Sign out failed:', err);
      setSignOutError(SIGN_OUT_FAILED_MESSAGE);
      setSignOutBusy(false);
    }
  }

  // Focus the card on open so Escape works (desktop has no visible close).
  const accountRef = useRef(null);
  useEffect(() => {
    if (tab === 'profile') accountRef.current?.focus();
  }, [tab]);

  const closeOnBackdrop = (e) => { if (e.target === e.currentTarget) onClose(); };

  if (tab === 'auth') {
    return (
      <div className={styles.overlay} onClick={closeOnBackdrop}>
        <AuthFlow
          onClose={onClose}
          signInWithGoogle={signInWithGoogle}
          signInWithEmail={signInWithEmail}
          signUpWithEmail={signUpWithEmail}
          checkEmailStatus={checkEmailStatus}
          resetPassword={resetPassword}
          verifyRecoveryCode={verifyRecoveryCode}
          setNewPassword={setNewPassword}
          signOut={signOut}
          friendlyError={friendlyError}
          message={message}
        />
      </div>
    );
  }

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const joined = joinedLabel(user.created_at);

  return (
    <div
      className={`${styles.overlay} ${styles.accountOverlay}`}
      onClick={closeOnBackdrop}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className={styles.account} role="dialog" aria-modal="true" aria-labelledby="account-name" tabIndex={-1} ref={accountRef}>
        <div className={styles.accountHeader}>
          <span className={styles.eyebrow}>Your account</span>
          <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
            <X size={18} strokeWidth={2} />
          </button>
        </div>

        <div className={styles.identity}>
          {avatarUrl ? (
            <img className={styles.avatar} src={avatarUrl} alt="" />
          ) : (
            <div className={styles.avatar} aria-hidden="true">{initials(user)}</div>
          )}
          <div className={styles.identityText}>
            <h2 id="account-name" className={styles.name}>{displayName(user)}</h2>
            <span className={styles.email}>{user.email}</span>
          </div>
        </div>

        <div className={styles.statsGrid}>
          <div className={styles.statCell}>
            <span className={styles.statVal}>{statTileValue(stats, 'reviews')}</span>
            <span className={styles.statLabel}>Reviews</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statVal}>{statTileValue(stats, 'navs')}</span>
            <span className={styles.statLabel}>Navigations</span>
          </div>
          <div className={styles.statCell}>
            <span className={styles.statVal}>{joined || '—'}</span>
            <span className={styles.statLabel}>Joined</span>
          </div>
        </div>

        {(stats.status === 'error' || stats.status === 'missing') && (
          <div className={`${styles.status} ${styles.statusError}`} role="alert">
            <TriangleAlert size={14} />
            <span className={styles.statusText}>{stats.message}</span>
            <button type="button" className={styles.statusAction} onClick={() => setStatsAttempt((n) => n + 1)}>
              Retry
            </button>
          </div>
        )}

        {activeAd?.status === 'live' && (
          <div className={styles.adCard}>
            <Megaphone size={16} className={styles.adIcon} />
            <div className={styles.adText}>
              <div className={styles.adTitle}>Ad running · {activeAd.businessName}</div>
              <div className={styles.adMeta}>
                <strong>{activeAd.daysLeft} day{activeAd.daysLeft === 1 ? '' : 's'} left</strong>
                {' '}of {activeAd.days} · ends {new Date(activeAd.endsAt).toLocaleDateString()}
              </div>
            </div>
          </div>
        )}
        {activeAd?.status === 'review' && (
          <div className={styles.adCard}>
            <Megaphone size={16} className={styles.adIcon} />
            <div className={styles.adText}>
              <div className={styles.adTitle}>Ad waiting for approval · {activeAd.businessName}</div>
              <div className={styles.adMeta}>
                Paid for {activeAd.days} day{activeAd.days === 1 ? '' : 's'}. The countdown starts once it's approved.
              </div>
            </div>
          </div>
        )}

        {signOutError && <StatusMsg status={{ text: signOutError, error: true }} />}
        <button type="button" className={styles.signoutBtn} onClick={handleSignOut} disabled={signOutBusy}>
          <LogOut size={17} />
          {signOutBusy ? 'Signing out…' : 'Sign out'}
        </button>

        {/* Support links — quiet footer under Sign out, separated by a
            hairline so they can't be mis-tapped as part of it. */}
        <div className={styles.supportFooter}>
          <span>Need help?</span>
          <a
            href={`mailto:${CONTACT_EMAIL}`}
            onClick={() => track('contact_click', { channel: 'email', source: 'profile_card' })}
          >
            <Mail size={14} strokeWidth={2} aria-hidden="true" />
            Email
          </a>
          <a
            href={WHATSAPP_CHAT_URL}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() => track('contact_click', { channel: 'whatsapp', source: 'profile_card' })}
          >
            <WhatsAppIcon size={14} className={styles.supportWaIcon} />
            WhatsApp
          </a>
        </div>
      </div>
    </div>
  );
}

// "Jul ’26" — month + two-digit year, as on the canvas.
function joinedLabel(createdAt) {
  if (!createdAt) return '';
  const d = new Date(createdAt);
  if (Number.isNaN(d.getTime())) return '';
  const month = d.toLocaleDateString('en-NG', { month: 'short' });
  return `${month} ’${String(d.getFullYear()).slice(-2)}`;
}

function StatusMsg({ status }) {
  return (
    <div className={`${styles.status} ${status.error ? styles.statusError : styles.statusOk}`}>
      {status.error ? <TriangleAlert size={14} /> : <CheckCircle2 size={14} />}
      <span className={styles.statusText}>{status.text}</span>
    </div>
  );
}
