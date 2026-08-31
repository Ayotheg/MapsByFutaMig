import { useEffect, useState } from 'react';
import adminStyles from '../admin/AdminPanel.module.css';
import styles from './InsightsTab.module.css';
import { fetchRecentSessions, fetchSessionEvents, describeError } from './analyticsApi';

// ── Slice 14 — "individual user journey" view. A session picker (recent
// sessions, most-recently-active first) → selecting one calls
// analytics_get_events({p_session_id}) and renders that session's events
// as a vertical timeline (timestamp + event_name + key props). Kept as a
// table/timeline, not a chart — inherently list-shaped, not chart-shaped
// (per the build plan's "right visual for the right place" note).
export default function JourneysTab() {
  const [sessions, setSessions] = useState(null);
  const [error, setError] = useState(null);
  const [selected, setSelected] = useState(null);
  const [events, setEvents] = useState(null);
  const [eventsError, setEventsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchRecentSessions(50)
      .then((data) => !cancelled && setSessions(data))
      .catch((e) => !cancelled && setError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  function selectSession(sessionId) {
    setSelected(sessionId);
    setEvents(null);
    setEventsError(null);
    fetchSessionEvents(sessionId, 200)
      .then(setEvents)
      .catch((e) => setEventsError(describeError(e)));
  }

  if (error) return <div className={styles.errorNote}>{error}</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Recent sessions</div>
        {!sessions && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</div>}
        {sessions && sessions.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>No sessions recorded yet.</div>
        )}
        <div className={adminStyles.list}>
          {(sessions || []).map((s) => (
            <div
              key={s.session_id}
              className={`${adminStyles.item} ${styles.sessionRow} ${selected === s.session_id ? styles.sessionRowActive : ''}`}
              onClick={() => selectSession(s.session_id)}
            >
              <div className={adminStyles.itemBody}>
                <div className={adminStyles.itemName}>
                  {s.user_id ? 'Signed-in visitor' : `Anonymous · ${String(s.anon_id).slice(0, 8)}`}
                </div>
                <div className={adminStyles.itemMeta}>
                  {s.event_count} events · last seen {formatTime(s.last_event)} · {s.last_path || '/'}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {selected && (
        <div className={styles.card}>
          <div className={styles.cardTitle}>Timeline</div>
          {eventsError && <div className={styles.errorNote}>{eventsError}</div>}
          {!events && !eventsError && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</div>}
          {events && events.length === 0 && (
            <div style={{ fontSize: 11, color: 'var(--muted)' }}>No events for this session.</div>
          )}
          {events && events.length > 0 && (
            <div className={styles.timeline}>
              {[...events].reverse().map((e) => (
                <div key={e.id} className={styles.timelineItem}>
                  <div className={styles.timelineTime}>{formatTime(e.created_at)}</div>
                  <div className={styles.timelineEvent}>{e.event_name}</div>
                  {e.props && Object.keys(e.props).length > 0 && (
                    <div className={styles.timelineProps}>{JSON.stringify(e.props)}</div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function formatTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}