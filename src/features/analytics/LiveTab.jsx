import { useEffect, useState } from 'react';
import styles from './InsightsTab.module.css';
import { supabase } from '../../lib/supabase';

// ── Slice 14 — Live "who's online right now" ────────────────────────────
// Subscribes to the same 'site-presence' channel usePresenceTracking.js
// tracks every visitor onto — the admin's own browser is just another
// client here. Renders channel.presenceState() as a live list: no
// polling, no manual refresh button, presence pushes updates
// automatically on 'sync'.
//
// First sub-tab (matches the stated build-plan priority) — active count
// front and center as a big number, list below it.
export default function LiveTab() {
  const [presenceState, setPresenceState] = useState({});

  useEffect(() => {
    const channel = supabase.channel('site-presence', {
      config: { presence: { key: 'insights-viewer-' + Math.random().toString(36).slice(2) } },
    });

    channel
      .on('presence', { event: 'sync' }, () => {
        setPresenceState(channel.presenceState());
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
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