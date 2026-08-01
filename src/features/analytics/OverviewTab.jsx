import { useEffect, useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import styles from './InsightsTab.module.css';
import { fetchRollup, describeError } from './analyticsApi';

// ── Slice 14 — Overview: unique visitors (30-day line), new vs returning
// (stacked bar), sessions/day. Reads analytics_get_rollup, which — per
// supabase/analytics.sql's own comment — lazily computes+caches today's
// and yesterday's rows on read rather than requiring a scheduled job.
export default function OverviewTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchRollup(30)
      .then((data) => {
        if (cancelled) return;
        // Rollup RPC orders newest-first; charts read left-to-right oldest-first.
        setRows([...data].reverse());
      })
      .catch((e) => !cancelled && setError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  if (error) return <div className={styles.errorNote}>{error}</div>;
  if (!rows) return <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</div>;
  if (rows.length === 0) {
    return <div style={{ fontSize: 11, color: 'var(--muted)' }}>No traffic recorded yet.</div>;
  }

  const chartData = rows.map((r) => ({
    day: r.day.slice(5), // MM-DD
    unique: r.unique_visitors,
    loggedIn: r.unique_logged_in,
    sessions: r.total_sessions,
    events: r.total_events,
  }));

  const latest = rows[rows.length - 1];
  const sumUnique = rows.reduce((s, r) => s + (r.unique_visitors || 0), 0);
  const sumEvents = rows.reduce((s, r) => s + (r.total_events || 0), 0);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={styles.statGrid}>
        <div className={styles.statTile}>
          <div className={styles.statTileValue}>{latest?.unique_visitors ?? 0}</div>
          <div className={styles.statTileLabel}>Unique today</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statTileValue}>{sumUnique}</div>
          <div className={styles.statTileLabel}>Unique (30d, summed)</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statTileValue}>{latest?.total_sessions ?? 0}</div>
          <div className={styles.statTileLabel}>Sessions today</div>
        </div>
        <div className={styles.statTile}>
          <div className={styles.statTileValue}>{sumEvents}</div>
          <div className={styles.statTileLabel}>Events (30d)</div>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Unique visitors — last 30 days</div>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: '#171f33', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }} />
              <Line type="monotone" dataKey="unique" stroke="var(--primary)" strokeWidth={2} dot={false} name="Unique visitors" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Signed-in vs. total unique — last 30 days</div>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: '#171f33', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }} />
              <Bar dataKey="unique" stackId="a" fill="var(--primary-container)" name="Total unique" radius={[3, 3, 0, 0]} />
              <Bar dataKey="loggedIn" stackId="b" fill="var(--secondary)" name="Signed-in" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Sessions / day</div>
        <div className={styles.chartWrap}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 4, right: 8, left: -20, bottom: 0 }}>
              <CartesianGrid stroke="rgba(255,255,255,0.06)" vertical={false} />
              <XAxis dataKey="day" tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} width={28} />
              <Tooltip contentStyle={{ background: '#171f33', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }} />
              <Bar dataKey="sessions" fill="var(--tertiary)" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
}