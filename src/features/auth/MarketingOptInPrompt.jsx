import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { Mail } from 'lucide-react';
import { setTawkHidden, useTawkChatOpen } from '../../lib/tawk';
import { track } from '../../lib/analytics';
import { fetchMarketingConsent, saveMarketingConsent } from './marketingConsent';
import styles from './MarketingOptInPrompt.module.css';

// One-time "Get updates from Maps By FUTA?" card for Google accounts.
//
// Email/password signups tick (or don't) a box on "Create your account".
// Google has no signup-only screen — the same button signs in — so Google
// users are asked once here instead, right after they land on the map.
// - Only when the account has never answered (profiles.marketing_opt_in_at
//   is null). Both answers go through set_marketing_consent, which stamps
//   that column, so nobody is asked again on any device.
// - `mbf_optin_asked` (localStorage, holds the user id) covers a "No
//   thanks" whose save failed: still not asked again on this device.
// - Same corner as ChannelPrompt / the Tawk bubble; MapPage hides
//   ChannelPrompt while this is up. Waits while anything else is open
//   (`blocked`, or the Tawk chat open) and just reappears afterwards —
//   it's not answered yet.
const ASKED_KEY = 'mbf_optin_asked';

function askedHere(userId) {
  try {
    return localStorage.getItem(ASKED_KEY) === userId;
  } catch {
    return false;
  }
}

function markAskedHere(userId) {
  try {
    localStorage.setItem(ASKED_KEY, userId);
  } catch {
    // Private mode etc. — the account column still stops repeat asks.
  }
}

function isGoogle(user) {
  const providers = user?.app_metadata?.providers || [user?.app_metadata?.provider];
  return providers.includes('google');
}

export default function MarketingOptInPrompt({ user, ready, blocked, isMobile, onVisibleChange }) {
  const { pathname } = useLocation();
  const userId = user?.id ?? null;
  const google = isGoogle(user);
  // { forUser, undecided }
  const [account, setAccount] = useState(null);
  const [answered, setAnswered] = useState(false);
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);
  // Someone mid-conversation in the Tawk live chat counts as busy.
  const chatOpen = useTawkChatOpen();

  useEffect(() => {
    setAccount(null);
    setAnswered(false);
    setFailed(false);
    if (!userId || !google || askedHere(userId)) return undefined;
    let cancelled = false;
    fetchMarketingConsent(userId).then((consent) => {
      if (!cancelled) setAccount({ forUser: userId, undecided: consent?.decidedAt === null });
    });
    return () => {
      cancelled = true;
    };
  }, [userId, google]);

  const visible =
    !!userId && ready && !blocked && !chatOpen && !answered && pathname === '/map' &&
    account?.forUser === userId && account.undecided;

  useEffect(() => {
    onVisibleChange?.(visible);
  }, [visible, onVisibleChange]);

  useEffect(() => {
    setTawkHidden('optin-prompt', visible);
    return () => setTawkHidden('optin-prompt', false);
  }, [visible]);

  async function answer(optIn) {
    if (busy) return;
    setBusy(true);
    setFailed(false);
    const ok = await saveMarketingConsent(optIn);
    setBusy(false);
    track('marketing_optin_answer', { source: 'map_prompt', opt_in: optIn, saved: ok });
    if (ok || !optIn) {
      markAskedHere(userId);
      setAnswered(true);
    } else {
      setFailed(true);
    }
  }

  if (!visible) return null;

  return (
    <aside className={`${styles.card} ${isMobile ? styles.mobile : styles.desktop}`} aria-label="Email updates">
      <div className={styles.head}>
        <span className={styles.badge} aria-hidden="true">
          <Mail size={16} />
        </span>
        <div className={styles.text}>
          <p className={styles.title}>Get updates from Maps By FUTA?</p>
          <p className={styles.sub}>
            {failed ? 'Couldn’t save that. Check your connection and try again.' : 'Occasional emails about new features. Unsubscribe anytime.'}
          </p>
        </div>
      </div>
      <div className={styles.actions}>
        <button type="button" className={styles.no} onClick={() => answer(false)} disabled={busy}>
          No thanks
        </button>
        <button type="button" className={styles.yes} onClick={() => answer(true)} disabled={busy}>
          Yes, keep me posted
        </button>
      </div>
    </aside>
  );
}
