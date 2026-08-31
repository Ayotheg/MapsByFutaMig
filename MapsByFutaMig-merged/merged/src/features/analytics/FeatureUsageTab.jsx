import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import styles from './InsightsTab.module.css';
import { fetchRollup, describeError } from './analyticsApi';

// ── Slice 14 — "What people do with the app" (client's own words).
// Ranked horizontal bar of event counts by event_name, summed across the
// rollup's top_events per day (top 10/day, from analytics_daily_rollup —
// good enough for a ranked overview without a second raw-table query).
export default function FeatureUsageTab() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchRollup(30)
      .then((data) => !cancelled && setRows(data))
      .catch((e) => !cancelled && setError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const ranked = useMemo(() => {
    if (!rows) return [];
    const totals = {};
    for (const r of rows) {
      for (const e of r.top_events || []) {
        totals[e.event_name] = (totals[e.event_name] || 0) + Number(e.count || 0);
      }
    }
    return Object.entries(totals)
      .map(([event_name, count]) => ({ event_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [rows]);

  if (error) return <div className={styles.errorNote}>{error}</div>;
  if (!rows) return <div style={{ fontSize: 11, color: 'var(--muted)' }}>Loading…</div>;
  if (ranked.length === 0) {
    return <div style={{ fontSize: 11, color: 'var(--muted)' }}>No feature-usage events recorded yet.</div>;
  }

  return (
    <div className={styles.card}>
      <div className={styles.cardTitle}>Feature usage — last 30 days</div>
      <div className={styles.chartWrapTall}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={ranked}
            layout="vertical"
            margin={{ top: 4, right: 16, left: 0, bottom: 0 }}
          >
            <CartesianGrid stroke="rgba(255,255,255,0.06)" horizontal={false} />
            <XAxis type="number" tick={{ fontSize: 9, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
            <YAxis
              type="category"
              dataKey="event_name"
              tick={{ fontSize: 9, fill: 'var(--text)' }}
              axisLine={false}
              tickLine={false}
              width={110}
            />
            <Tooltip contentStyle={{ background: '#171f33', border: '1px solid rgba(255,255,255,0.1)', fontSize: 11 }} />
            <Bar dataKey="count" fill="var(--secondary)" radius={[0, 3, 3, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}