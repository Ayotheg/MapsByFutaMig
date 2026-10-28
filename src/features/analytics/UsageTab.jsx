import { useEffect, useMemo } from 'react';
import styles from './InsightsTab.module.css';
import { token } from './chartTheme';
import { RankedCard } from './PlacesTab';
import { fmt, minutesLabel, tapLabel } from './insightsWords';

// Usage: how directions go, and what people tap, last 30 days.
const DAYS = 30;

export default function UsageTab({ rollup, rollupError, insights, loadInsights }) {
  useEffect(() => loadInsights(DAYS), [loadInsights]);
  const extra = insights[DAYS];

  // Exact counts from supabase/analytics_insights.sql when it's been run.
  // Otherwise each day's top 10 from the rollup, added up — an undercount
  // for anything that isn't in a day's top 10, so it's labelled as such.
  // Labels are plain words; admin actions, errors and things merely shown
  // aren't visitor taps, so they're dropped.
  const events = useMemo(() => {
    if (extra?.event_counts) {
      return new Map(Object.entries(extra.event_counts).map(([k, v]) => [k, Number(v) || 0]));
    }
    const sum = new Map();
    for (const day of rollup || []) {
      for (const e of day.top_events || []) sum.set(e.event_name, (sum.get(e.event_name) || 0) + (Number(e.count) || 0));
    }
    return sum;
  }, [rollup, extra]);
  const exact = !!extra?.event_counts;

  if (rollupError && !exact) return <div className={styles.errorNote}>{rollupError}</div>;
  if (!rollup && !exact) return <div className={styles.muted}>Loading…</div>;

  const started = events.get('nav_started') || 0;
  const arrived = events.get('nav_completed') || 0;
  const stopped = events.get('nav_abandoned') || 0;
  const rerouted = events.get('nav_rerouted') || 0;

  const taps = [...events.entries()]
    .map(([name, count]) => ({ name: tapLabel(name), count }))
    .filter((r) => r.name)
    .sort((a, b) => b.count - a.count);

  return (
    <>
      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>Directions</h3>
          <p className={styles.cardSub}>
            Of everyone who started, how many got there{exact ? '' : ' (rough count)'}
          </p>
        </div>
        {started === 0 ? (
          <div className={styles.muted}>No directions yet.</div>
        ) : (
          <div className={styles.donutRow}>
            <Donut share={Math.min(1, arrived / started)} />
            <ul className={styles.legend}>
              <li>
                <span className={styles.legendValue}>{fmt(started)}</span> started
              </li>
              <li>
                <span className={styles.swatch} style={{ background: 'var(--v2-secondary)' }} aria-hidden="true" />
                <span className={styles.legendValue}>{fmt(arrived)}</span> got there
              </li>
              {stopped > 0 && (
                <li>
                  <span className={styles.legendValue}>{fmt(stopped)}</span> stopped halfway
                </li>
              )}
              <li>
                <span className={styles.legendValue}>{fmt(rerouted)}</span> went off route
              </li>
              {extra?.avg_trip_seconds != null && (
                <li>
                  <span className={styles.legendValue}>{minutesLabel(extra.avg_trip_seconds)}</span> average trip
                </li>
              )}
            </ul>
          </div>
        )}
      </div>

      <RankedCard
        title="What people tapped"
        sub={exact ? `Last ${DAYS} days` : `Last ${DAYS} days, each day's top 10 only`}
        rows={taps}
        empty="Nothing yet."
        teal
      />
    </>
  );
}

// Ring: teal is the share who got there, pale violet the rest.
function Donut({ share }) {
  const r = 34;
  const c = 2 * Math.PI * r;
  return (
    <div className={styles.donut} role="img" aria-label={`${Math.round(share * 100)}% got there`}>
      <svg width="84" height="84" viewBox="0 0 84 84">
        <circle cx="42" cy="42" r={r} fill="none" stroke={token('--v2-primary-tint')} strokeWidth="9" />
        <circle
          cx="42"
          cy="42"
          r={r}
          fill="none"
          stroke={token('--v2-secondary')}
          strokeWidth="9"
          strokeLinecap="round"
          strokeDasharray={`${share * c} ${c}`}
          transform="rotate(-90 42 42)"
        />
      </svg>
      <span className={styles.donutValue}>{Math.round(share * 100)}%</span>
    </div>
  );
}
