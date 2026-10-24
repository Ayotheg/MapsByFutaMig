import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, CheckCircle2, ChevronLeft, TriangleAlert, X, Mail, LogOut, Megaphone } from 'lucide-react';
import styles from './AuthModal.module.css';
import AuthFlow from './AuthFlow';
import { supabase } from '../../lib/supabase';
import { displayName, initials } from './useAuth';
import { fetchProfileStats, statTileValue } from './profileStats';
import { fetchActivePromotion } from '../promote/activePromotion';
import { fetchMyEvents } from '../events/myEvents';
import { fetchMarketingConsent, saveMarketingConsent } from './marketingConsent';
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
 *  - "Change" beside the email (password accounts only — a Google
 *    account's email belongs to Google) swaps the card to Change email:
 *    new email + current password → code sent to the new inbox → done.
 *    For people who lost their old inbox; see useAuth's requestEmailChange.
 */
export default function AuthModal({ initialTab, user, onClose, signInWithGoogle, signInWithEmail, signUpWithEmail, checkEmailStatus, resetPassword, verifyRecoveryCode, setNewPassword, requestEmailChange, confirmEmailChange, signOut, friendlyError, message }) {
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

  // The account's listed events (myEvents.js) — same card as the ad above:
  // not paid yet, waiting for approval, live, or recently not approved.
  const [myEvents, setMyEvents] = useState([]);
  useEffect(() => {
    if (tab !== 'profile' || !userId) return;
    let cancelled = false;
    fetchMyEvents(userId).then((result) => {
      if (!cancelled && result.status === 'ok') setMyEvents(result.events);
    });
    return () => { cancelled = true; };
  }, [tab, userId]);

  // "Email updates" switch (profiles.marketing_opt_in). Turning it off
  // marks the Resend contact unsubscribed (marketing_optin.sql). Hidden
  // until loaded so it never shows a guessed state.
  const [optIn, setOptIn] = useState(null); // null = loading / unavailable
  const [optInBusy, setOptInBusy] = useState(false);
  const [optInError, setOptInError] = useState(null);
  useEffect(() => {
    if (tab !== 'profile' || !userId) return;
    let cancelled = false;
    setOptIn(null);
    setOptInError(null);
    fetchMarketingConsent(userId).then((consent) => {
      if (!cancelled && consent) setOptIn(consent.optIn);
    });
    return () => { cancelled = true; };
  }, [tab, userId]);

  async function handleOptInChange(next) {
    if (optInBusy) return;
    setOptInError(null);
    setOptInBusy(true);
    setOptIn(next);
    const ok = await saveMarketingConsent(next);
    if (!ok) {
      setOptIn(!next);
      setOptInError('Couldn’t update email preferences. Try again.');
    }
    setOptInBusy(false);
  }

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

  // Change email: view 'account' | 'email'; phase 'request' | 'code'.
  const [view, setView] = useState('account');
  const [phase, setPhase] = useState('request');
  const [newEmail, setNewEmail] = useState('');
  const [currentPw, setCurrentPw] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailBusy, setEmailBusy] = useState(false);
  const [emailStatus, setEmailStatus] = useState(null); // { text, error }
  const [accountNotice, setAccountNotice] = useState(null);

  function openChangeEmail() {
    setNewEmail('');
    setCurrentPw('');
    setEmailCode('');
    setEmailStatus(null);
    setAccountNotice(null);
    setPhase('request');
    setView('email');
  }

  async function handleSendEmailCode(e) {
    e?.preventDefault();
    if (emailBusy) return;
    const target = newEmail.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(target)) {
      setEmailStatus({ text: 'Enter a valid email address.', error: true });
      return;
    }
    if (target.toLowerCase() === user.email?.toLowerCase()) {
      setEmailStatus({ text: 'That’s already your email.', error: true });
      return;
    }
    if (!currentPw) {
      setEmailStatus({ text: 'Enter your current password.', error: true });
      return;
    }
    setEmailBusy(true);
    setEmailStatus(null);
    try {
      await requestEmailChange(user.email, currentPw, target);
      setNewEmail(target);
      setEmailCode('');
      setPhase('code');
      setEmailStatus({ text: `We sent a code to ${target}.`, error: false });
    } catch (err) {
      setEmailStatus({ text: friendlyError(err), error: true });
    } finally {
      setEmailBusy(false);
    }
  }

  async function handleConfirmEmail(e) {
    e.preventDefault();
    if (emailBusy) return;
    const token = emailCode.replace(/\s/g, '');
    if (!/^\d{6,8}$/.test(token)) {
      setEmailStatus({ text: 'Enter the code from your email.', error: true });
      return;
    }
    setEmailBusy(true);
    setEmailStatus(null);
    try {
      await confirmEmailChange(newEmail, token);
      setCurrentPw('');
      setView('account');
      setAccountNotice(`Your email is now ${newEmail}.`);
    } catch (err) {
      setEmailStatus({ text: friendlyError(err), error: true });
    } finally {
      setEmailBusy(false);
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
  // Only email+password accounts can change email here; a Google-only
  // account's address comes from Google.
  const hasPassword = (user.app_metadata?.providers || [user.app_metadata?.provider]).includes('email');

  return (
    <div
      className={`${styles.overlay} ${styles.accountOverlay}`}
      onClick={closeOnBackdrop}
      onKeyDown={(e) => { if (e.key === 'Escape') onClose(); }}
    >
      <div className={styles.account} role="dialog" aria-modal="true" aria-labelledby={view === 'email' ? 'change-email-title' : 'account-name'} tabIndex={-1} ref={accountRef}>
        {view === 'email' ? (
          <div className={styles.viewIn} key={phase}>
            <div className={`${styles.accountHeader} ${styles.accountHeaderShown}`}>
              <button type="button" className={styles.backBtn} onClick={() => setView('account')} aria-label="Back to your account">
                <ChevronLeft size={18} />
              </button>
              <h2 id="change-email-title" className={styles.viewTitle}>Change email</h2>
              <button type="button" className={`${styles.close} ${styles.closeMobile}`} onClick={onClose} aria-label="Close">
                <X size={18} strokeWidth={2} />
              </button>
            </div>

            {phase === 'request' ? (
              <form className={styles.form} onSubmit={handleSendEmailCode} noValidate>
                <p className={styles.formNote}>Currently <strong>{user.email}</strong></p>
                <label className={styles.label} htmlFor="new-email">New email</label>
                <input id="new-email" className={styles.input} type="email" inputMode="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} autoFocus />
                <label className={styles.label} htmlFor="current-password">Current password</label>
                <input id="current-password" className={styles.input} type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
                {emailStatus && <StatusMsg status={emailStatus} />}
                <button type="submit" className={styles.primaryBtn} disabled={emailBusy}>
                  {emailBusy ? 'Sending…' : 'Send code'}
                </button>
              </form>
            ) : (
              <form className={styles.form} onSubmit={handleConfirmEmail} noValidate>
                <p className={styles.formNote}>Enter the code we sent to <strong>{newEmail}</strong>.</p>
                <label className={styles.label} htmlFor="email-code">Code</label>
                <input id="email-code" className={`${styles.input} ${styles.codeInput}`} type="text" inputMode="numeric" autoComplete="one-time-code" maxLength={8} placeholder="123456" value={emailCode} onChange={(e) => setEmailCode(e.target.value.replace(/\D/g, ''))} autoFocus />
                {emailStatus && <StatusMsg status={emailStatus} />}
                <button type="submit" className={styles.primaryBtn} disabled={emailBusy}>
                  {emailBusy ? 'Confirming…' : 'Confirm new email'}
                </button>
                <div className={styles.formLinks}>
                  <button type="button" className={styles.textBtn} onClick={() => handleSendEmailCode()} disabled={emailBusy}>Resend code</button>
                  <button type="button" className={styles.textBtn} onClick={() => { setEmailStatus(null); setPhase('request'); }}>Use a different email</button>
                </div>
              </form>
            )}
          </div>
        ) : (
        <div className={`${styles.accountBody} ${accountNotice ? styles.viewIn : ''}`}>
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
            <div className={styles.emailRow}>
              <span className={styles.email}>{user.email}</span>
              {hasPassword && (
                <button type="button" className={styles.emailChange} onClick={openChangeEmail} aria-label="Change email">
                  Change
                </button>
              )}
            </div>
          </div>
        </div>

        {accountNotice && <StatusMsg status={{ text: accountNotice, error: false }} />}

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

        {myEvents.map((ev) => {
          const day = new Date(ev.startsAt).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
          return (
            <div key={ev.id} className={styles.adCard}>
              <CalendarDays size={16} className={ev.state === 'rejected' ? styles.adIconMuted : styles.adIcon} />
              <div className={styles.adText}>
                <div className={styles.adTitle}>
                  {ev.state === 'unpaid' && 'Event not paid yet'}
                  {ev.state === 'review' && 'Event waiting for approval'}
                  {ev.state === 'live' && (ev.isFeatured ? 'Event featured in Explore' : 'Event live in Explore')}
                  {ev.state === 'rejected' && 'Event not approved'} · {ev.title}
                </div>
                <div className={styles.adMeta}>
                  {ev.state === 'unpaid' && (
                    <>
                      Pay the listing fee to send it for review.{' '}
                      <Link
                        className={styles.adAction}
                        to={`/event/callback?event=${encodeURIComponent(ev.id)}&cancelled=1`}
                        onClick={onClose}
                      >
                        Pay now
                      </Link>
                    </>
                  )}
                  {ev.state === 'review' && `For ${day}. It shows in Explore once it's approved.`}
                  {ev.state === 'live' && (
                    <>
                      <strong>{day}</strong> · showing until the end of the day
                    </>
                  )}
                  {ev.state === 'rejected' && (ev.rejectionReason ? `Reason: ${ev.rejectionReason}` : 'Contact us if you have questions.')}
                </div>
              </div>
            </div>
          );
        })}

        {optIn !== null && (
          <label className={styles.prefRow}>
            <span className={styles.prefText}>
              <span className={styles.prefTitle}>Email updates</span>
              <span className={styles.prefSub}>Occasional product updates</span>
            </span>
            <span className={styles.switch}>
              <input
                type="checkbox"
                role="switch"
                checked={optIn}
                disabled={optInBusy}
                onChange={(e) => handleOptInChange(e.target.checked)}
              />
              <span className={styles.switchTrack}>
                <span className={styles.switchKnob} />
              </span>
            </span>
          </label>
        )}
        {optInError && <StatusMsg status={{ text: optInError, error: true }} />}

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
        )}
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
