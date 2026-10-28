import { useEffect, useState } from 'react';
import { Activity, Inbox, MapPin, Route, Star, Users } from 'lucide-react';
import styles from './InsightsTab.module.css';
import { describeError, fetchRecentSignups, fetchTableCounts } from './analyticsApi';
import { fmt, shortDate } from './insightsWords';

// Data: what's waiting for review, what's saved, and who signed up lately.
// Read-only; approving and editing stay in the Pending/Points tabs.
const ROWS = [
  { table: 'waypoints', label: 'Places', Icon: MapPin },
  { table: 'segments', label: 'Paths', Icon: Route },
  { table: 'reviews', label: 'Reviews', Icon: Star },
  { table: 'profiles', label: 'Accounts', Icon: Users },
  { table: 'analytics_events', label: 'Things recorded', Icon: Activity },
];

export default function DataTab() {
  const [counts, setCounts] = useState(null);
  const [countsError, setCountsError] = useState(null);
  const [signups, setSignups] = useState(null);
  const [signupsError, setSignupsError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    // One query: the counts include the pending suggestions too.
    fetchTableCounts()
      .then((rows) => !cancelled && setCounts(Object.fromEntries(rows.map((r) => [r.table_name, Number(r.row_count) || 0]))))
      .catch((e) => !cancelled && setCountsError(describeError(e)));
    fetchRecentSignups(10)
      .then((rows) => !cancelled && setSignups(rows))
      .catch((e) => !cancelled && setSignupsError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const pending = counts ? counts.waypoint_submissions_pending ?? null : null;

  return (
    <>
      {pending != null && (
        <div className={`${styles.banner} ${pending > 0 ? styles.bannerWaiting : ''}`}>
          <span className={styles.bannerIcon} aria-hidden="true">
            <Inbox size={18} />
          </span>
          <div>
            <div className={styles.bannerTitle}>{pending > 0 ? 'Waiting for review' : 'Nothing to review'}</div>
            <div className={styles.bannerText}>
              {pending === 1 ? '1 place suggestion' : `${fmt(pending)} place suggestions`}
              {pending > 0 ? ' in the Pending tab' : ' waiting'}
            </div>
          </div>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>What's saved</h3>
        </div>
        {countsError && <div className={styles.errorNote}>{countsError}</div>}
        {!counts && !countsError && <div className={styles.muted}>Loading…</div>}
        {counts && (
          <div className={styles.people} style={{ marginTop: 0 }}>
            {ROWS.map(({ table, label, Icon }) => (
              <div key={table} className={styles.person}>
                <span className={styles.iconBox} aria-hidden="true">
                  <Icon size={16} />
                </span>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>{label}</div>
                </div>
                <div className={styles.rankCount}>{fmt(counts[table])}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>New accounts</h3>
          <p className={styles.cardSub}>Latest sign-ups</p>
        </div>
        {signupsError && <div className={styles.errorNote}>{signupsError}</div>}
        {!signups && !signupsError && <div className={styles.muted}>Loading…</div>}
        {signups && signups.length === 0 && <div className={styles.muted}>No sign-ups yet.</div>}
        {signups && signups.length > 0 && (
          <div className={styles.people} style={{ marginTop: 0 }}>
            {signups.map((s) => (
              <div key={s.id} className={styles.person}>
                <span className={styles.avatar} aria-hidden="true">
                  {(s.display_name || '?').trim().charAt(0).toUpperCase()}
                </span>
                <div className={styles.rowBody}>
                  <div className={styles.rowName}>{s.display_name || 'No name'}</div>
                </div>
                <div className={styles.rowEnd}>{shortDate(s.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </>
  );
}
