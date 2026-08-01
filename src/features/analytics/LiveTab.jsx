import { useEffect, useState } from 'react';
import styles from './InsightsTab.module.css';
import { supabase } from '../../lib/supabase';

// ── Slice 14 — Live "who's online right now" ────────────────────────────
//
// BUGFIX (post-ship): this originally called
// `supabase.channel('site-presence').on('presence', ...).subscribe()`
// itself. That's broken — usePresenceTracking.js (mounted in MapPage.jsx,
// running for every visitor including the admin) already owns a
// subscribed channel with that exact name, and supabase-js caches
// channels by name: `supabase.channel('site-presence')` here returned
// THAT SAME already-subscribed channel object, not a fresh one. Calling
// `.on('presence', ...)` on an already-subscribed channel throws
// synchronously ("cannot add 'presence' callbacks... after
// 'subscribe()'"), and with no error boundary anywhere in this app, that
// uncaught error unmounted the entire page, not just this tab.
//
// Fixed by not subscribing here at all — `presenceState()` is a
// synchronous read of the channel's already-current state and doesn't
// need its own subscription, so this just looks up the existing channel
// (via `supabase.getChannels()`, not `supabase.channel()` — the latter
// would create/return the shared instance again and invite the same
// mistake) and polls its state every 2s. Simpler than trying to hook a
// second 'sync' listener onto a channel someone else already subscribed.
const POLL_MS = 2000;

export default function LiveTab() {
  const [presenceState, setPresenceState] = useState({});

  useEffect(() => {
    function poll() {
      const channel = supabase.getChannels().find((c) => c.topic === 'realtime:site-presence');
      // Not found yet (e.g. usePresenceTracking's own subscribe hasn't
      // resolved on first paint) — leave state as-is, next tick will
      // pick it up once it exists.
      if (channel) setPresenceState(channel.presenceState());
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  // Each presence key can have multiple entries (e.g. rapid re-tracks
  // before the previous one settles) — take the latest per key.
  const people = Object.entries(presenceState).map(([key, entries]) => {
    const latest = entries[entries.length - 1] || {};
    return { key, ...latest };
  });
  people.sort((a, b) => (b.online_since || 0) - (a.online_since || 0));

  return (
    <div>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Active right now</div>
        <div className={styles.bigNumberRow}>
          <div className={styles.bigNumber}>{people.length}</div>
          <div className={styles.bigNumberLabel}>
            {people.length === 1 ? 'person browsing' : 'people browsing'}
          </div>
        </div>
      </div>

      <div className={styles.card} style={{ marginTop: 12 }}>
        <div className={styles.cardTitle}>Who</div>
        {people.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>Nobody's on the site right now.</div>
        )}
        <div className={styles.presenceList}>
          {people.map((p) => (
            <div key={p.key} className={styles.presenceRow}>
              <div className={styles.presenceDot} />
              <div className={styles.presenceBody}>
                <div className={styles.presenceName}>
                  {p.display_name || (p.user_id ? 'Signed-in user' : `Anonymous · ${String(p.anon_id || p.key).slice(0, 8)}`)}
                </div>
                <div className={styles.presenceMeta}>
                  {p.current_action ? p.current_action : (p.path || '/')}
                  {' · '}
                  {onlineFor(p.online_since)}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function onlineFor(since) {
  if (!since) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - since) / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}