import { useEffect, useRef, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { X } from 'lucide-react';
import WhatsAppIcon from '../../lib/WhatsAppIcon';
import { WHATSAPP_CHANNEL_URL, readChannelPrompt, writeChannelPrompt } from '../../lib/whatsappChannel';
import { track } from '../../lib/analytics';
import { fetchChannelJoined, recordChannelJoined } from './channelAccount';
import styles from './ChannelPrompt.module.css';

// "Join our WhatsApp channel" nudge on the live map.
//
// Built to stay out of the way — the map already has a lot on screen:
// - Appears only after DELAY_MS of actual time on /map (tab visible, map
//   loaded), so it never greets someone who just arrived to find a place.
// - Never on top of anything: hidden while a place card, search, nav,
//   modal, chip results or an expanded mobile sheet is open (MapPage
//   passes that as `blocked`), and waits until they're closed.
// - Small, non-modal corner card: no backdrop, no focus steal.
// - Frequency (per device, localStorage): shown at most MAX_SHOWS times
//   ever, at least SNOOZE_MS apart. Showing it counts, whether it's closed
//   with X or ignored, so a refresh never re-nags. Joining — here or via any
//   other channel link — stops it for good. Existing users get the same
//   treatment as new ones: they've never been offered the channel either.
// - Signed-in users: "joined" is also stored on their account
//   (profiles.whatsapp_channel_joined_at), so joining on one device stops
//   it on every device. A join made while signed out, or whose save
//   failed, is pushed to the account on the next signed-in visit. If the
//   account can't be checked, the device-only rules above still apply.
const DELAY_MS = 40 * 1000;
const SNOOZE_MS = 14 * 24 * 60 * 60 * 1000;
const MAX_SHOWS = 2;

function isEligible() {
  const s = readChannelPrompt();
  if (s.joined) return false;
  if ((s.shows || 0) >= MAX_SHOWS) return false;
  if (s.lastShownAt && Date.now() - s.lastShownAt < SNOOZE_MS) return false;
  return true;
}

// Push a device-level join to the account once per user (covers joins made
// while signed out, via the landing footer, or whose RPC failed).
function syncJoinToAccount(userId) {
  const s = readChannelPrompt();
  if (!s.joined || s.syncedFor === userId) return;
  recordChannelJoined().then((ok) => {
    if (ok) writeChannelPrompt({ ...readChannelPrompt(), syncedFor: userId });
  });
}

export default function ChannelPrompt({ ready, blocked, isMobile, userId }) {
  const { pathname } = useLocation();
  const onMap = pathname === '/map';
  const [eligible] = useState(isEligible);
  const [due, setDue] = useState(false);
  const [closed, setClosed] = useState(false);
  const recordedRef = useRef(false);
  // Account check result for the signed-in user: { forUser, joined }.
  const [account, setAccount] = useState(null);

  useEffect(() => {
    if (!userId) return undefined;
    if (readChannelPrompt().joined) {
      syncJoinToAccount(userId);
      return undefined;
    }
    let cancelled = false;
    fetchChannelJoined(userId).then((joined) => {
      if (cancelled) return;
      // Joined on another device — remember it here too.
      if (joined) writeChannelPrompt({ ...readChannelPrompt(), joined: true, syncedFor: userId });
      setAccount({ forUser: userId, joined: joined === true });
    });
    return () => {
      cancelled = true;
    };
  }, [userId]);
  // Signed in: wait for the account check so someone who joined elsewhere
  // never sees it flash up.
  const accountAllows = !userId || (account?.forUser === userId && !account.joined);

  // Count only time the person can actually see the map.
  useEffect(() => {
    if (!eligible || due || !ready || !onMap) return undefined;
    let elapsed = 0;
    const id = setInterval(() => {
      if (document.visibilityState !== 'visible') return;
      elapsed += 1000;
      if (elapsed >= DELAY_MS) setDue(true);
    }, 1000);
    return () => clearInterval(id);
  }, [eligible, due, ready, onMap]);

  const visible = eligible && accountAllows && due && !closed && !blocked && onMap;

  useEffect(() => {
    if (!visible || recordedRef.current) return;
    recordedRef.current = true;
    const s = readChannelPrompt();
    writeChannelPrompt({ ...s, shows: (s.shows || 0) + 1, lastShownAt: Date.now() });
    track('whatsapp_prompt_shown', { source: 'map_prompt' });
  }, [visible]);

  useEffect(() => {
    if (!visible) return undefined;
    function onKey(e) {
      if (e.key === 'Escape') dismiss();
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  });

  function dismiss() {
    setClosed(true);
    track('whatsapp_prompt_dismissed', { source: 'map_prompt' });
  }

  function join() {
    writeChannelPrompt({ ...readChannelPrompt(), joined: true });
    if (userId) syncJoinToAccount(userId);
    track('whatsapp_channel_click', { source: 'map_prompt' });
    setClosed(true);
  }

  if (!visible) return null;

  return (
    <aside className={`${styles.card} ${isMobile ? styles.mobile : styles.desktop}`} aria-label="WhatsApp channel">
      <span className={styles.badge}>
        <WhatsAppIcon size={18} />
      </span>
      <div className={styles.text}>
        <p className={styles.title}>Get Maps By FUTA updates</p>
        <p className={styles.sub}>New features & announcements, on our WhatsApp channel.</p>
      </div>
      <a className={styles.join} href={WHATSAPP_CHANNEL_URL} target="_blank" rel="noopener noreferrer" onClick={join} onAuxClick={join}>
        Join
      </a>
      <button type="button" className={styles.close} onClick={dismiss} aria-label="Close">
        <X size={16} />
      </button>
    </aside>
  );
}
