import { useEffect, useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import styles from './InsightsTab.module.css';
import { fetchRollup, describeError } from './analyticsApi';

// ── Slice 14 — top searched places (chart) + top routes (ranked list).
// Routes are kept as a ranked "from → to" list rather than a Sankey-style
// pair chart, per the build plan's own "keep it simple... a ranked table
// with counts is fine if a from→to chart gets visually noisy" note.
export default function SearchRoutesTab() {
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

  const topSearches = useMemo(() => aggregate(rows, 'top_searches', 'query'), [rows]);
  const topRoutes = useMemo(() => {
    if (!rows) return [];
    const totals = {};
    for (const r of rows) {
      for (const item of r.top_routes || []) {
        const key = `${item.from} → ${item.to}`;
        totals[key] = (totals[key] || 0) + Number(item.count || 0);
      }
    }
    return Object.entries(totals)
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);
  }, [rows]);

  if (error) return <div className={styles.errorNote}>{error}</div>;
  if (!rows) return <div style={{ fontSize: 11, color: '#94a3b8' }}>Loading…</div>;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div className={styles.card}>
        <div className={styles.cardTitle}>Top searched places — last 30 days</div>
        {topSearches.length === 0 ? (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>No searches recorded yet.</div>
        ) : (
          <div className={styles.chartWrap}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={topSearches} layout="vertical" margin={{ top: 4, right: 16, left: 0, bottom: 0 }}>
                <CartesianGrid stroke="#e2e8f0" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 9, fill: '#94a3b8' }} axisLine={false} tickLine={false} />
                <YAxis
                  type="category"
                  dataKey="label"
                  tick={{ fontSize: 9, fill: '#0f172a' }}
                  axisLine={false}
                  tickLine={false}
                  width={90}
                />
                <Tooltip contentStyle={{ background: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, boxShadow: '0 4px 12px rgba(15,23,42,0.08)', fontSize: 11 }} />
                <Bar dataKey="count" fill="#d97706" radius={[0, 3, 3, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      <div className={styles.card}>
        <div className={styles.cardTitle}>Top routes — last 30 days</div>
        {topRoutes.length === 0 ? (
          <div style={{ fontSize: 11, color: '#94a3b8' }}>No navigations recorded yet.</div>
        ) : (
          <div className={styles.rankedList}>
            {topRoutes.map((r, i) => (
              <div key={r.label} className={styles.rankedRow}>
                <div className={styles.rankedIndex}>{i + 1}</div>
                <div className={styles.rankedLabel}>{r.label}</div>
                <div className={styles.rankedCount}>{r.count}</div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function aggregate(rows, field, keyField) {
  if (!rows) return [];
  const totals = {};
  for (const r of rows) {
    for (const item of r[field] || []) {
      const key = item[keyField];
      if (!key) continue;
      totals[key] = (totals[key] || 0) + Number(item.count || 0);
    }
  }
  return Object.entries(totals)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
}