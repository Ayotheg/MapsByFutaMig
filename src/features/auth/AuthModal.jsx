import { useEffect, useState } from 'react';
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
 *
 * v2 redesign (this session — Auth modal, Figma nodes 82:2 "Sign In" and
 * 82:58 "Create Account", pulled via the Figma MCP connection). UI/markup
 * and CSS module only — no functionality changes; same props, state,
 * handlers, data flow as before.
 *  - The two frames disagree on layout (82:2 has no tab switcher and a
 *    "Welcome Back" heading + bottom "Sign up" link; 82:58 has the
 *    segmented Sign In/Create Account control + brand block + Google
 *    button ahead of the form). Since this is one real shared component
 *    (both tabs render from the same `tab` state, exactly like the
 *    existing `showTabs` switcher already does), 82:58's shell — brand
 *    block, segmented tab control, Google button, divider, then the
 *    tab's own form fields — was used as the authoritative structure for
 *    BOTH tabs, with 82:2's field set/copy (Forgot? link, Sign In copy)
 *    dropped into that shell rather than inventing a second layout.
 *    82:2's redundant "Don't have an account? Sign up" footer link was
 *    dropped since the segmented control above already switches tabs.
 *  - Brand icon: swapped the placeholder inline location-pin SVG for the
 *    real app logo (`public/android-chrome-512x512.png`), per explicit
 *    instruction — plain `<img>`, no new asset processing.
 *  - Font gap, same call as the Search Results session: both frames'
 *    exported code shows "Liberation Serif" (82:2, a Figma-export
 *    fallback for missing font data, not a real pick) and "Geist" (82:58
 *    — in Section 4's shortlist, but not yet bundled anywhere else in
 *    the app). Neither is treated as a deliberate new-font pick for this
 *    screen; mapped to the already-bundled `var(--font-display)`
 *    (headings) / `var(--font-ui)` (body/labels) instead, consistent
 *    with every other v2 screen. Flag if Geist is explicitly requested
 *    later.
 *  - One literal override, same precedent as every other v2 screen: both
 *    frames' primary button/link color is a flat `#630ed4` — used the
 *    authoritative `--v2-primary` (`#7c3aed`) instead.
 *  - New content, per explicit instruction: added a "Terms" / "Privacy
 *    Policy" line under the signup form (82:58 shows this copy) as real
 *    `react-router-dom` `Link`s to the app's existing `/terms` and
 *    `/privacy` routes (`src/pages/legal/*`, already wired in `App.jsx`)
 *    — same same-tab in-app navigation pattern the landing page's
 *    `Footer.jsx` already uses for those routes. Plain links, no new
 *    props/handlers.
 *  - Motion: overlay fade + modal pop-in reused from the existing
 *    keyframes, retimed to `var(--v2-duration-standard)`/
 *    `var(--v2-ease-standard)` and guarded by `prefers-reduced-motion:
 *    reduce`, matching every other v2 modal-style surface.
 *
 * Oct 2026: the Sign In / Create Account tabs were replaced by the
 * email-first AuthFlow.jsx (Welcome → Password → Create account). This
 * file now only owns the overlay and the signed-in Profile view; any
 * `initialTab` other than 'profile' (with a user) shows AuthFlow.
 */
export default function AuthModal({ initialTab, user, onClose, signInWithGoogle, signInWithEmail, signUpWithEmail, checkEmailStatus, resetPassword, signOut, friendlyError, message }) {
  const tab = initialTab === 'profile' && user ? 'profile' : 'auth';

  // Profile stats — legacy's `loadProfileStats()` (app.js ~7379–7415),
  // fetched live each time the profile tab is shown.
  //
  // Legacy reads `users/{uid}.reviewCount`/`.navCount` directly. This port
  // reads the same two counters from `profiles` (supabase/profile_stats.sql):
  // `review_count` is recomputed by triggers from the user's actual
  // `reviews` rows, `nav_count` from recorded navigation completions
  // (NavigationController → navCompletion.js → `record_navigation_completion`).
  //
  // Four explicit states (profileStats.js): loading, ready, missing (no
  // profiles row), error (unreachable / timed out / schema not applied).
  // Only `ready` shows numbers — a missing row or a failed query is shown
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
  // time the profile tab opens, so "days left" counts down day by day.
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
  // → signOut.js). Only a resolved call closes the modal; a failure keeps
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

  const avatarUrl = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  const joined = user?.created_at
    ? new Date(user.created_at).toLocaleDateString('en-NG', { year: 'numeric', month: 'short', day: 'numeric' })
    : '';

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
          friendlyError={friendlyError}
          message={message}
        />
      </div>
    );
  }

  return (
    <div className={styles.overlay} onClick={closeOnBackdrop}>
      <div className={styles.modal}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          <X size={16} strokeWidth={2.5} />
        </button>

        <div className={styles.brand}>
          <div className={styles.brandIcon}>
            <img src="/android-chrome-512x512.png" alt="" width={48} height={48} />
          </div>
          <div className={styles.brandText}>MAPSBYFUTA</div>
          <div className={styles.brandSub}>Navigate campus with ease.</div>
        </div>

        {message && <div className={styles.limitMessage}>{message}</div>}

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
                <div className={styles.statVal}>{statTileValue(stats, 'reviews')}</div>
                <div className={styles.statLabel}>Reviews</div>
              </div>
              <div className={styles.stat}>
                <div className={styles.statVal}>{statTileValue(stats, 'navs')}</div>
                <div className={styles.statLabel}>Navigations</div>
              </div>
            </div>

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

            {(stats.status === 'error' || stats.status === 'missing') && (
              <div className={`${styles.status} ${styles.statusError}`} role="alert">
                <TriangleAlert size={12} />
                <span className={styles.statusText}>{stats.message}</span>
                <button type="button" className={styles.statusAction} onClick={() => setStatsAttempt((n) => n + 1)}>
                  Retry
                </button>
              </div>
            )}

            {signOutError && <StatusMsg status={{ text: signOutError, error: true }} />}
            <button type="button" className={styles.signoutBtn} onClick={handleSignOut} disabled={signOutBusy}>
              <LogOut size={14} />
              {signOutBusy ? 'Signing out…' : 'Sign Out'}
            </button>

            {/* Support footer — sits below Sign Out, separated by a hairline,
                so it reads as the card's footer and can't be mis-tapped as
                part of the destructive action above it. Two direct-contact
                pills (mail + WhatsApp chat), distinct from the WhatsApp
                broadcast channel on the Explore tab. */}
            <div className={styles.supportFooter}>
              <p className={styles.supportText}>
                Having any issues or suggestions? Reach us via mail or WhatsApp.
              </p>
              <div className={styles.supportActions}>
                <a
                  className={styles.supportBtn}
                  href={`mailto:${CONTACT_EMAIL}`}
                  onClick={() => track('contact_click', { channel: 'email', source: 'profile_card' })}
                >
                  <Mail size={14} strokeWidth={2} aria-hidden="true" />
                  Email
                </a>
                <a
                  className={styles.supportBtn}
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
      </div>
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
