import { useEffect, useState } from 'react';
import styles from './InsightsTab.module.css';
import { fetchTableCounts, fetchRecentSignups, describeError } from './analyticsApi';
import { supabase } from '../../lib/supabase';

// ── Slice 14 — §7 "stop going to Supabase" panel ─────────────────────────
// Read-only glance view. Row counts per table (analytics_table_counts),
// recent signups (analytics_recent_signups — flagged in analytics.sql:
// confirm `profiles.created_at` actually exists before trusting this),
// and recent pending waypoint submissions (reuses the exact same
// `status = 'pending'` filter PendingTab.jsx already queries — no new
// query pattern introduced here).
//
// Deliberately read-only — no edit/approve/reject actions live here;
// those stay owned by Points/Routes/Pending, per the build plan's own
// "don't duplicate that here" instruction.
export default function DatabaseTab() {
  const [counts, setCounts] = useState(null);
  const [countsError, setCountsError] = useState(null);
  const [signups, setSignups] = useState(null);
  const [signupsError, setSignupsError] = useState(null);
  const [pendingCount, setPendingCount] = useState(null);

  useEffect(() => {
    let cancelled = false;

    fetchTableCounts()
      .then((data) => !cancelled && setCounts(data))
      .catch((e) => !cancelled && setCountsError(describeError(e)));

    fetchRecentSignups(10)
      .then((data) => !cancelled && setSignups(data))
      .catch((e) => !cancelled && setSignupsError(describeError(e)));

    supabase
      .from('waypoints')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'pending')
      .then(({ count, error }) => {
        if (!cancelled && !error) setPendingCount(count ?? 0);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Row counts</div>
        {countsError && <div className={styles.errorNote}>{countsError}</div>}
        {!counts && !countsError && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</div>}
        {counts && (
          <div className={styles.statGrid}>
            {counts.map((row) => (
              <div key={row.table_name} className={styles.statTile}>
                <div className={styles.statTileValue}>{row.row_count}</div>
                <div className={styles.statTileLabel}>{row.table_name.replace(/_/g, ' ')}</div>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Pending waypoint submissions</div>
        <div className={styles.bigNumberRow}>
          <div className={styles.bigNumber}>{pendingCount ?? '—'}</div>
          <div className={styles.bigNumberLabel}>awaiting review — see the Pending tab</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Recent signups</div>
        {signupsError && <div className={styles.errorNote}>{signupsError}</div>}
        {!signups && !signupsError && <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</div>}
        {signups && signups.length === 0 && (
          <div style={{ fontSize: 11, color: 'var(--muted)' }}>No signups yet.</div>
        )}
        {signups && signups.length > 0 && (
          <div className={styles.rankedList}>
            {signups.map((s) => (
              <div key={s.id} className={styles.rankedRow}>
                <div className={styles.rankedLabel}>{s.display_name || 'Unnamed'}</div>
                <div className={styles.rankedCount}>{formatDate(s.created_at)}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function formatDate(iso) {
  if (!iso) return '';
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}