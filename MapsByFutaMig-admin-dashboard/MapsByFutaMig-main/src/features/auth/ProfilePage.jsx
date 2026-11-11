import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Bell,
  CalendarDays,
  CalendarRange,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  LogOut,
  Mail,
  Megaphone,
  Play,
  Smartphone,
  Star,
  TriangleAlert,
  X,
} from 'lucide-react';
import styles from './ProfilePage.module.css';
import { supabase } from '../../lib/supabase';
import { displayName, initials } from './useAuth';
import { fetchProfileStats, statTileValue } from './profileStats';
import { fetchActivePromotion } from '../promote/activePromotion';
import { fetchMyEvents, removeMyUnpaidEvent, MAX_EVENT_CARDS } from '../events/myEvents';
import { eventNoticeKey, loadClearedNotices, saveClearedNotices } from './clearedNotices';
import { shortDate } from '../explore/eventsData';
import { fetchMarketingConsent, saveMarketingConsent } from './marketingConsent';
import { SIGN_OUT_FAILED_MESSAGE } from './signOut';
import WhatsAppIcon from '../../lib/WhatsAppIcon';
import { CONTACT_EMAIL, WHATSAPP_CHAT_URL } from '../../lib/contactInfo';
import { track } from '../../lib/analytics';
import { isInstalled, openInstallVideo } from '../install/installVideo';
import {
  PUSH_PREFS,
  fetchPushPrefs,
  forgetThisDevice,
  isThisDeviceOn,
  pushSupport,
  savePushPref,
  turnOffPush,
  turnOnPush,
} from '../notifications/pushClient';

/**
 * The signed-in person's profile, as its own page: full screen on phones,
 * a wide floating panel over the map on desktop (two columns). Everything
 * the old account card had, in sections, plus Notifications.
 *
 * Sections: top card (avatar, name, email + Change, stats) · Your listings
 * (running ad, events — only when there are some) · Notifications (turn on,
 * one switch per kind, Email updates) · App (install) · Help · Sign out.
 * "Change" swaps the page to the Change email form (password accounts
 * only — a Google account's email belongs to Google).
 */
export default function ProfilePage({ user, onClose, signOut, requestEmailChange, confirmEmailChange, friendlyError }) {
  const userId = user.id;

  // Stats — four explicit states (profileStats.js): only `ready` shows
  // numbers; a missing row or failed query shows "—" plus Retry.
  const [stats, setStats] = useState({ status: 'loading' });
  const [statsAttempt, setStatsAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    setStats({ status: 'loading' });
    fetchProfileStats(supabase, userId).then((result) => {
      if (!cancelled) setStats(result);
    });
    return () => { cancelled = true; };
  }, [userId, statsAttempt]);

  // Running ad, re-fetched on open so "days left" counts down.
  const [activeAd, setActiveAd] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchActivePromotion(userId).then((result) => {
      if (!cancelled) setActiveAd(result);
    });
    return () => { cancelled = true; };
  }, [userId]);

  // Listed events: not paid yet, waiting, live, or recently not approved.
  const [myEvents, setMyEvents] = useState([]);
  const [eventsAttempt, setEventsAttempt] = useState(0);
  useEffect(() => {
    let cancelled = false;
    fetchMyEvents(userId).then((result) => {
      if (!cancelled && result.status === 'ok') setMyEvents(result.events);
    });
    return () => { cancelled = true; };
  }, [userId, eventsAttempt]);

  const [confirmRemoveId, setConfirmRemoveId] = useState(null);
  const [removingId, setRemovingId] = useState(null);
  const [removeError, setRemoveError] = useState(null); // { id, message }
  async function handleRemoveEvent(id) {
    setRemovingId(id);
    setRemoveError(null);
    try {
      await removeMyUnpaidEvent(id);
      setMyEvents((list) => list.filter((e) => e.id !== id));
      setConfirmRemoveId(null);
      setEventsAttempt((n) => n + 1);
    } catch (e) {
      setRemoveError({ id, message: e.message });
    } finally {
      setRemovingId(null);
    }
  }

  // "Clear" on a declined event hides it on this device (clearedNotices.js).
  const [clearedKeys, setClearedKeys] = useState([]);
  useEffect(() => {
    setClearedKeys(loadClearedNotices(userId));
  }, [userId]);
  function clearNotice(key) {
    setClearedKeys((keys) => {
      const next = keys.includes(key) ? keys : [...keys, key];
      saveClearedNotices(userId, next);
      return next;
    });
  }
  const visibleEvents = myEvents.filter((ev) => !clearedKeys.includes(eventNoticeKey(ev))).slice(0, MAX_EVENT_CARDS);
  const listingCount = visibleEvents.length + (activeAd?.status === 'live' || activeAd?.status === 'review' ? 1 : 0);

  // Email updates (profiles.marketing_opt_in). Hidden until loaded so it
  // never shows a guessed state.
  const [optIn, setOptIn] = useState(null);
  const [optInBusy, setOptInBusy] = useState(false);
  const [optInError, setOptInError] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetchMarketingConsent(userId).then((consent) => {
      if (!cancelled && consent) setOptIn(consent.optIn);
    });
    return () => { cancelled = true; };
  }, [userId]);
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

  // Push: can this browser do it, is this device on, and the switches.
  const [support, setSupport] = useState(null); // null = checking
  const [deviceOn, setDeviceOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushError, setPushError] = useState(null);
  const [prefs, setPrefs] = useState(null);
  useEffect(() => {
    let cancelled = false;
    pushSupport().then(async (s) => {
      const on = s === 'ok' ? await isThisDeviceOn() : false;
      if (!cancelled) {
        setSupport(s);
        setDeviceOn(on);
      }
    });
    fetchPushPrefs(userId).then((p) => {
      if (!cancelled) setPrefs(p);
    });
    return () => { cancelled = true; };
  }, [userId]);

  async function handleTurnOn() {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    const res = await turnOnPush();
    setPushBusy(false);
    if (res.ok) {
      setDeviceOn(true);
      track('push_enabled', { source: 'profile' });
    } else {
      setPushError(res.message);
    }
  }
  async function handleTurnOff() {
    if (pushBusy) return;
    setPushBusy(true);
    setPushError(null);
    const ok = await turnOffPush();
    setPushBusy(false);
    if (ok) {
      setDeviceOn(false);
      track('push_disabled', { source: 'profile' });
    } else {
      setPushError('Couldn’t turn notifications off. Try again.');
    }
  }
  async function handlePrefChange(key, on) {
    setPrefs((p) => ({ ...p, [key]: on }));
    const ok = await savePushPref(key, on);
    if (!ok) {
      setPrefs((p) => ({ ...p, [key]: !on }));
      setPushError('Couldn’t save that setting. Try again.');
    }
  }

  // Sign out: this device stops getting the account's notifications first.
  const [signOutBusy, setSignOutBusy] = useState(false);
  const [signOutError, setSignOutError] = useState(null);
  async function handleSignOut() {
    if (signOutBusy) return;
    setSignOutError(null);
    setSignOutBusy(true);
    try {
      await forgetThisDevice();
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

  // Focus the page on open so Escape works.
  const pageRef = useRef(null);
  useEffect(() => {
    pageRef.current?.focus();
  }, []);

  const avatarUrl = user.user_metadata?.avatar_url || user.user_metadata?.picture;
  const joined = joinedLabel(user.created_at);
  const hasPassword = (user.app_metadata?.providers || [user.app_metadata?.provider]).includes('email');
  const showInstall = !isInstalled();

  const identity = (
    <section className={styles.card} style={{ order: 1 }}>
      <div className={styles.identity}>
        {avatarUrl ? (
          <img className={styles.avatar} src={avatarUrl} alt="" />
        ) : (
          <div className={styles.avatar} aria-hidden="true">{initials(user)}</div>
        )}
        <div className={styles.identityText}>
          <h2 id="profile-name" className={styles.name}>{displayName(user)}</h2>
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
    </section>
  );

  const listings = listingCount > 0 && (
    <section className={styles.section} style={{ order: 2 }} aria-labelledby="profile-listings">
      <div className={styles.sectionHead}>
        <h3 id="profile-listings" className={styles.overline}>Your listings</h3>
        <span className={styles.count}>{listingCount}</span>
      </div>
      <div className={styles.group}>
        {activeAd?.status === 'live' && (
          <div className={styles.listing}>
            <span className={styles.rowIcon}><Megaphone size={17} /></span>
            <div className={styles.listingText}>
              <span className={`${styles.pill} ${styles.pillLive}`}>Ad running</span>
              <span className={styles.listingTitle}>{activeAd.businessName}</span>
              <span className={styles.listingMeta}>
                <strong>{activeAd.daysLeft} day{activeAd.daysLeft === 1 ? '' : 's'} left</strong> of {activeAd.days} · ends{' '}
                {new Date(activeAd.endsAt).toLocaleDateString()}
              </span>
            </div>
          </div>
        )}
        {activeAd?.status === 'review' && (
          <div className={styles.listing}>
            <span className={styles.rowIcon}><Megaphone size={17} /></span>
            <div className={styles.listingText}>
              <span className={`${styles.pill} ${styles.pillWait}`}>Waiting for approval</span>
              <span className={styles.listingTitle}>{activeAd.businessName}</span>
              <span className={styles.listingMeta}>
                Paid for {activeAd.days} day{activeAd.days === 1 ? '' : 's'}. The countdown starts once it's approved.
              </span>
            </div>
          </div>
        )}
        {visibleEvents.map((ev) => {
          const day = shortDate(ev.startsAt);
          return (
            <div key={ev.id} className={styles.listing}>
              <span className={styles.rowIcon}><CalendarDays size={17} /></span>
              <div className={styles.listingText}>
                <span
                  className={`${styles.pill} ${
                    ev.state === 'live' ? styles.pillLive : ev.state === 'review' ? styles.pillWait : styles.pillBad
                  }`}
                >
                  {ev.state === 'unpaid' && 'Not paid yet'}
                  {ev.state === 'review' && 'Waiting for approval'}
                  {ev.state === 'live' && (ev.isFeatured ? 'Featured in Explore' : 'Live in Explore')}
                  {ev.state === 'rejected' && 'Not approved'}
                </span>
                <span className={styles.listingTitle}>{ev.title}</span>
                <span className={styles.listingMeta}>
                  {ev.state === 'unpaid' && 'Pay the listing fee to send it for review.'}
                  {ev.state === 'review' && `For ${day}. It shows in Explore once it's approved.`}
                  {ev.state === 'live' && (
                    <>
                      <strong>{day}</strong> · showing until the end of the day
                    </>
                  )}
                  {ev.state === 'rejected' && (ev.rejectionReason ? `Reason: ${ev.rejectionReason}` : 'Contact us if you have questions.')}
                </span>
                {ev.state === 'unpaid' &&
                  (confirmRemoveId === ev.id ? (
                    <div className={styles.listingActions}>
                      <span className={styles.confirm}>Remove this event?</span>
                      <button
                        type="button"
                        className={`${styles.chipBtn} ${styles.chipDanger}`}
                        onClick={() => handleRemoveEvent(ev.id)}
                        disabled={removingId === ev.id}
                      >
                        {removingId === ev.id ? 'Removing…' : 'Yes, remove'}
                      </button>
                      <button type="button" className={styles.chipBtn} onClick={() => setConfirmRemoveId(null)} disabled={removingId === ev.id}>
                        Keep
                      </button>
                    </div>
                  ) : (
                    <div className={styles.listingActions}>
                      <Link className={`${styles.chipBtn} ${styles.chipPrimary}`} to={`/event/callback?event=${encodeURIComponent(ev.id)}&pay=1`} onClick={onClose}>
                        Pay now
                      </Link>
                      <button
                        type="button"
                        className={styles.chipBtn}
                        onClick={() => {
                          setRemoveError(null);
                          setConfirmRemoveId(ev.id);
                        }}
                      >
                        Remove
                      </button>
                    </div>
                  ))}
                {ev.state === 'rejected' && (
                  <div className={styles.listingActions}>
                    <button type="button" className={styles.chipBtn} onClick={() => clearNotice(eventNoticeKey(ev))}>
                      Clear
                    </button>
                  </div>
                )}
                {removeError?.id === ev.id && (
                  <div className={styles.inlineError} role="alert">
                    {removeError.message}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );

  const notifications = (
    <section className={styles.section} style={{ order: 3 }} aria-labelledby="profile-notifications">
      <div className={styles.sectionHead}>
        <h3 id="profile-notifications" className={styles.overline}>Notifications</h3>
      </div>

      {support === 'ok' && !deviceOn && (
        <div className={styles.enable}>
          <span className={styles.enableIcon}><Bell size={19} /></span>
          <div className={styles.enableText}>
            <span className={styles.enableTitle}>Turn on notifications</span>
            <span className={styles.enableSub}>About once a week, plus a reminder after you visit a place. Never between 10 pm and 7 am.</span>
            <button type="button" className={styles.primaryPill} onClick={handleTurnOn} disabled={pushBusy}>
              {pushBusy ? 'Turning on…' : 'Turn on'}
            </button>
          </div>
        </div>
      )}
      {support === 'ios-install' && (
        <div className={styles.enable}>
          <span className={styles.enableIcon}><Bell size={19} /></span>
          <div className={styles.enableText}>
            <span className={styles.enableTitle}>Add the app to your Home Screen first</span>
            <span className={styles.enableSub}>On iPhone, notifications work once Maps By FUTA is on your Home Screen. Then turn them on here.</span>
            <button type="button" className={styles.primaryPill} onClick={() => openInstallVideo('profile_push')}>
              Show me how
            </button>
          </div>
        </div>
      )}
      {pushError && <StatusMsg status={{ text: pushError, error: true }} />}

      <div className={styles.group}>
        {support === 'unsupported' && (
          <div className={styles.row}>
            <span className={styles.rowIcon}><Bell size={17} /></span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Notifications</span>
              <span className={styles.rowSub}>Not available in this browser. Try Chrome, or the app on your Home Screen.</span>
            </span>
          </div>
        )}
        {support !== 'unsupported' &&
          prefs &&
          PUSH_PREFS.map(({ key, title, sub }) => (
            <label key={key} className={`${styles.row} ${styles.switchRow} ${deviceOn ? '' : styles.rowDim}`}>
              <span className={styles.rowIcon}>{key === 'reviews' ? <Star size={17} /> : <CalendarRange size={17} />}</span>
              <span className={styles.rowText}>
                <span className={styles.rowTitle}>{title}</span>
                <span className={styles.rowSub}>{sub}</span>
              </span>
              <Switch checked={deviceOn && prefs[key]} disabled={!deviceOn} onChange={(on) => handlePrefChange(key, on)} />
            </label>
          ))}
        {optIn !== null && (
          <label className={`${styles.row} ${styles.switchRow}`}>
            <span className={styles.rowIcon}><Mail size={17} /></span>
            <span className={styles.rowText}>
              <span className={styles.rowTitle}>Email updates</span>
              <span className={styles.rowSub}>Occasional product updates</span>
            </span>
            <Switch checked={optIn} disabled={optInBusy} onChange={handleOptInChange} />
          </label>
        )}
      </div>
      {optInError && <StatusMsg status={{ text: optInError, error: true }} />}
      {deviceOn && (
        <button type="button" className={styles.quietBtn} onClick={handleTurnOff} disabled={pushBusy}>
          Turn off notifications on this device
        </button>
      )}
    </section>
  );

  const app = showInstall && (
    <section className={styles.section} style={{ order: 4 }} aria-labelledby="profile-app">
      <div className={styles.sectionHead}>
        <h3 id="profile-app" className={styles.overline}>App</h3>
      </div>
      <div className={styles.group}>
        <button type="button" className={`${styles.row} ${styles.rowButton}`} onClick={() => openInstallVideo('profile_card')}>
          <span className={styles.rowIcon}><Smartphone size={17} /></span>
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>Install the app</span>
            <span className={styles.rowSub}>36-second how-to video</span>
          </span>
          <span className={styles.play} aria-hidden="true"><Play size={12} fill="currentColor" /></span>
        </button>
      </div>
    </section>
  );

  const help = (
    <section className={styles.section} style={{ order: 5 }} aria-labelledby="profile-help">
      <div className={styles.sectionHead}>
        <h3 id="profile-help" className={styles.overline}>Help</h3>
      </div>
      <div className={styles.group}>
        <a
          className={`${styles.row} ${styles.rowButton}`}
          href={`mailto:${CONTACT_EMAIL}`}
          onClick={() => track('contact_click', { channel: 'email', source: 'profile_card' })}
        >
          <span className={styles.rowIcon}><Mail size={17} /></span>
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>Email us</span>
            <span className={styles.rowSub}>{CONTACT_EMAIL}</span>
          </span>
          <ChevronRight size={18} className={styles.chev} aria-hidden="true" />
        </a>
        <a
          className={`${styles.row} ${styles.rowButton}`}
          href={WHATSAPP_CHAT_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={() => track('contact_click', { channel: 'whatsapp', source: 'profile_card' })}
        >
          <span className={`${styles.rowIcon} ${styles.waIcon}`}><WhatsAppIcon size={17} /></span>
          <span className={styles.rowText}>
            <span className={styles.rowTitle}>Chat on WhatsApp</span>
            <span className={styles.rowSub}>Message the Maps By FUTA team</span>
          </span>
          <ChevronRight size={18} className={styles.chev} aria-hidden="true" />
        </a>
      </div>
    </section>
  );

  const signOutBlock = (
    <div className={styles.signoutWrap} style={{ order: 6 }}>
      {signOutError && <StatusMsg status={{ text: signOutError, error: true }} />}
      <button type="button" className={styles.signoutBtn} onClick={handleSignOut} disabled={signOutBusy}>
        <LogOut size={17} />
        {signOutBusy ? 'Signing out…' : 'Sign out'}
      </button>
    </div>
  );

  return (
    <div className={styles.backdrop} onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div
        className={styles.page}
        role="dialog"
        aria-modal="true"
        aria-labelledby={view === 'email' ? 'change-email-title' : 'profile-title'}
        tabIndex={-1}
        ref={pageRef}
        onKeyDown={(e) => {
          if (e.key === 'Escape') onClose();
        }}
      >
        {view === 'email' ? (
          <>
            <header className={styles.topBar}>
              <button type="button" className={styles.iconBtn} onClick={() => setView('account')} aria-label="Back to your profile">
                <ChevronLeft size={20} />
              </button>
              <h1 id="change-email-title" className={styles.title}>Change email</h1>
            </header>
            <div className={`${styles.formWrap} ${styles.viewIn}`} key={phase}>
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
          </>
        ) : (
          <>
            <header className={styles.topBar}>
              <button type="button" className={`${styles.iconBtn} ${styles.mobileOnly}`} onClick={onClose} aria-label="Back to the map">
                <ChevronLeft size={20} />
              </button>
              <h1 id="profile-title" className={styles.title}>Profile</h1>
              <button type="button" className={`${styles.iconBtn} ${styles.desktopOnly}`} onClick={onClose} aria-label="Close">
                <X size={18} />
              </button>
            </header>
            <div className={styles.body}>
              <div className={styles.col}>
                {identity}
                {listings}
                {app}
                {help}
              </div>
              <div className={styles.col}>
                {notifications}
                {signOutBlock}
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function Switch({ checked, disabled, onChange }) {
  return (
    <span className={styles.switch}>
      <input type="checkbox" role="switch" checked={!!checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      <span className={styles.switchTrack}>
        <span className={styles.switchKnob} />
      </span>
    </span>
  );
}

// "Jul ’26" — month + two-digit year.
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
