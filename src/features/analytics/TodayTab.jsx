import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import styles from './InsightsTab.module.css';
import { supabase } from '../../lib/supabase';
import { fetchRecentSessions, fetchRecentSignups, fetchSessionEvents, describeError } from './analyticsApi';
import { clockTime, describeStep, fmt, shortDate, statusLabel, timeAgo, whereLabel } from './insightsWords';

// Today: who's on the map right now, today's numbers, and recent visits.
// A visit opens into what that person did, step by step, in plain words.

const POLL_MS = 2000;
const PAGE = 10;

export default function TodayTab({ rollup, rollupError }) {
  const today = rollup?.[rollup.length - 1];
  const isToday = today && today.day === new Date().toISOString().slice(0, 10);

  return (
    <>
      <LiveCard />
      {rollupError ? (
        <div className={styles.errorNote}>{rollupError}</div>
      ) : (
        <div className={styles.grid2}>
          <div className={styles.card}>
            <div className={styles.statLabel}>People today</div>
            <div className={styles.statValue}>{rollup ? fmt(isToday ? today.unique_visitors : 0) : '—'}</div>
          </div>
          <div className={styles.card}>
            <div className={styles.statLabel}>Visits today</div>
            <div className={styles.statValue}>{rollup ? fmt(isToday ? today.total_sessions : 0) : '—'}</div>
          </div>
        </div>
      )}
      <RecentVisits />
    </>
  );
}

// Reads the presence channel usePresenceTracking.js already subscribes to
// (looked up, not re-created: supabase-js shares channels by name, and adding
// a listener to an already-subscribed channel throws).
function LiveCard() {
  const [state, setState] = useState({});
  const [, setTick] = useState(0);

  useEffect(() => {
    function poll() {
      const channel = supabase.getChannels().find((c) => c.topic === 'realtime:site-presence');
      if (channel) setState(channel.presenceState());
      setTick((n) => n + 1); // keeps the "how long ago" labels moving
    }
    poll();
    const id = setInterval(poll, POLL_MS);
    return () => clearInterval(id);
  }, []);

  const people = Object.entries(state)
    .map(([key, entries]) => ({ key, ...(entries[entries.length - 1] || {}) }))
    .sort((a, b) => (b.online_since || 0) - (a.online_since || 0));

  return (
    <div className={styles.card}>
      <div className={styles.live}>
        <span className={styles.liveDot} aria-hidden="true" />
        LIVE
      </div>
      <div className={styles.hero}>
        <span className={styles.heroValue}>{people.length}</span>
        <span className={styles.heroLabel}>
          {people.length === 1 ? 'person on the map right now' : 'people on the map right now'}
        </span>
      </div>
      {people.length > 0 && (
        <div className={styles.people}>
          {people.map((p) => {
            const name = p.display_name || (p.user_id ? 'Signed-in visitor' : `Visitor · ${shortId(p.anon_id || p.key)}`);
            return (
              <div key={p.key} className={styles.person}>
                <Avatar name={p.display_name} signedIn={!!p.user_id} online />
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>{name}</div>
                  <div className={styles.rowMeta}>{statusLabel(p.current_action)}</div>
                </div>
                <div className={styles.rowEnd}>{timeAgo(p.online_since)}</div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

function RecentVisits() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [names, setNames] = useState({});
  const [shown, setShown] = useState(PAGE);
  const [open, setOpen] = useState(null);
  const [steps, setSteps] = useState({}); // session id → events | 'error'

  useEffect(() => {
    let cancelled = false;
    fetchRecentSessions(50)
      .then((data) => !cancelled && setSessions(data))
      .catch((e) => !cancelled && setError(describeError(e)));
    // Names for signed-in visitors. Best effort: unnamed rows still read fine.
    fetchRecentSignups(500)
      .then((rows) => !cancelled && setNames(Object.fromEntries(rows.map((r) => [r.id, r.display_name]))))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);

  function toggle(id) {
    setOpen((cur) => (cur === id ? null : id));
    if (steps[id]) return;
    fetchSessionEvents(id, 200)
      .then((events) => setSteps((m) => ({ ...m, [id]: [...events].reverse() })))
      .catch(() => setSteps((m) => ({ ...m, [id]: 'error' })));
  }

  // Grouped under Today / Yesterday / a date, newest first.
  const groups = useMemo(() => {
    const out = [];
    for (const s of (sessions || []).slice(0, shown)) {
      const label = dayLabel(s.last_event);
      if (!out.length || out[out.length - 1].label !== label) out.push({ label, items: [] });
      out[out.length - 1].items.push(s);
    }
    return out;
  }, [sessions, shown]);

  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Recent visits</h3>
        <p className={styles.cardSub}>Newest first. Tap one to see what they did.</p>
      </div>
      {error && <div className={styles.errorNote}>{error}</div>}
      {!sessions && !error && <div className={styles.muted}>Loading…</div>}
      {sessions && sessions.length === 0 && <div className={styles.muted}>No visits yet.</div>}

      {groups.map((g) => (
        <div key={g.label}>
          <div className={styles.dayLabel}>{g.label}</div>
          {g.items.map((s) => {
            const isOpen = open === s.session_id;
            const name = s.user_id ? names[s.user_id] || 'Signed-in visitor' : `Visitor · ${shortId(s.anon_id)}`;
            const count = Number(s.event_count) || 0;
            return (
              <div key={s.session_id} className={styles.visit}>
                <button
                  type="button"
                  className={styles.visitRow}
                  aria-expanded={isOpen}
                  onClick={() => toggle(s.session_id)}
                >
                  <Avatar name={s.user_id ? names[s.user_id] : null} signedIn={!!s.user_id} />
                  <div className={styles.rowBody}>
                    <div className={styles.rowName}>{name}</div>
                    <div className={styles.rowMeta}>
                      {count} {count === 1 ? 'action' : 'actions'} · {visitLength(s.first_event, s.last_event)} ·{' '}
                      {whereLabel(s.last_path)}
                    </div>
                  </div>
                  <div className={styles.rowEnd}>{clockTime(s.last_event)}</div>
                  <ChevronRight
                    size={16}
                    className={`${styles.chevron} ${isOpen ? styles.chevronOpen : ''}`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && <VisitSteps events={steps[s.session_id]} />}
              </div>
            );
          })}
        </div>
      ))}

      {sessions && sessions.length > shown && (
        <button type="button" className={styles.moreBtn} onClick={() => setShown((n) => n + PAGE)}>
          Show more visits
        </button>
      )}
    </div>
  );
}

function VisitSteps({ events }) {
  if (!events) return <p className={styles.muted} style={{ margin: '0 0 12px' }}>Loading…</p>;
  if (events === 'error') {
    return <p className={styles.muted} style={{ margin: '0 0 12px' }}>Couldn't load this visit.</p>;
  }
  // The same thing done several times in a row reads as one line, "×3".
  const lines = [];
  for (const e of events) {
    const text = describeStep(e);
    const last = lines[lines.length - 1];
    if (last && last.text === text) last.times += 1;
    else lines.push({ id: e.id, text, at: e.created_at, times: 1 });
  }
  return (
    <ol className={styles.steps}>
      {lines.map((l) => (
        <li key={l.id} className={styles.step}>
          <span className={styles.stepTime}>{clockTime(l.at)}</span>
          <span className={styles.stepText}>
            {l.text}
            {l.times > 1 && <span className={styles.stepTimes}> ×{l.times}</span>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function Avatar({ name, signedIn, online }) {
  const letter = name ? name.trim().charAt(0).toUpperCase() : signedIn ? 'S' : '?';
  return (
    <span
      className={`${styles.avatar} ${signedIn ? '' : styles.avatarAnon} ${online ? styles.avatarOnline : ''}`}
      aria-hidden="true"
    >
      {letter}
    </span>
  );
}

function shortId(id) {
  return String(id || '').slice(0, 6);
}

function visitLength(from, to) {
  const s = Math.round((new Date(to) - new Date(from)) / 1000);
  if (s < 60) return 'under a minute';
  const m = Math.round(s / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

function dayLabel(iso) {
  const d = new Date(iso);
  const today = new Date();
  const yesterday = new Date();
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return shortDate(iso);
}
