import { useEffect, useMemo, useState } from 'react';
import { Area, AreaChart, Bar, BarChart, ResponsiveContainer, Tooltip, XAxis } from 'recharts';
import styles from './InsightsTab.module.css';
import { axisTick, token } from './chartTheme';
import { change, fmt, minutesLabel } from './insightsWords';

// Trends: how many people, over 7 or 30 days. The extra cards (new vs came
// back, stay length, phone vs computer, busiest times) need
// supabase/analytics_insights.sql and hide until it's run.
const RANGES = [
  { days: 7, label: '7 days', word: 'week' },
  { days: 30, label: '30 days', word: 'month' },
];

export default function TrendsTab({ rollup, rollupError, insights, loadInsights }) {
  const [days, setDays] = useState(30);
  const range = RANGES.find((r) => r.days === days);
  useEffect(() => loadInsights(days), [days, loadInsights]);
  const extra = insights[days];

  const rows = useMemo(() => (rollup || []).slice(-days), [rollup, days]);
  const chartData = rows.map((r) => ({ day: shortDay(r.day), people: r.unique_visitors }));
  const sum = (k) => rows.reduce((s, r) => s + (Number(r[k]) || 0), 0);
  const busiest = chartData.reduce((a, b) => (!a || b.people > a.people ? b : a), null);
  const signedInPct = sum('unique_visitors') ? Math.round((sum('unique_logged_in') / sum('unique_visitors')) * 100) : 0;

  if (rollupError) return <div className={styles.errorNote}>{rollupError}</div>;
  if (!rollup) return <div className={styles.muted}>Loading…</div>;

  // Without the extra numbers, "people" is each day's count added up, so
  // someone who came on 3 days counts 3 times. Say so.
  const people = extra ? extra.people : sum('unique_visitors');
  const peopleChange = extra ? change(extra.people, extra.people_prev, range.word) : null;

  return (
    <>
      <div className={styles.pills} role="group" aria-label="Time range">
        {RANGES.map((r) => (
          <button
            key={r.days}
            type="button"
            aria-pressed={days === r.days}
            className={`${styles.pill} ${days === r.days ? styles.pillActive : ''}`}
            onClick={() => setDays(r.days)}
          >
            {r.label}
          </button>
        ))}
      </div>

      <div className={styles.card}>
        <div className={styles.statLabel}>People who used the app</div>
        <div className={styles.hero} style={{ marginTop: 6 }}>
          <span className={styles.heroValue}>{fmt(people)}</span>
          <span className={styles.heroLabel}>
            last {days} days{extra ? '' : ' (each day added up)'}
          </span>
        </div>
        <Change value={peopleChange} />
        <div className={styles.chart}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 28, right: 4, left: 4, bottom: 0 }}>
              <defs>
                <linearGradient id="insightsPeopleFill" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={token('--v2-primary')} stopOpacity={0.18} />
                  <stop offset="100%" stopColor={token('--v2-primary')} stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis
                dataKey="day"
                tick={axisTick()}
                axisLine={false}
                tickLine={false}
                interval="preserveStartEnd"
                minTickGap={36}
              />
              <Tooltip
                cursor={{ stroke: token('--v2-divider'), strokeWidth: 1 }}
                content={<DayTooltip unit="people" />}
              />
              <Area
                type="monotone"
                dataKey="people"
                stroke={token('--v2-primary')}
                strokeWidth={2}
                fill="url(#insightsPeopleFill)"
                activeDot={{ r: 5, stroke: token('--v2-on-primary'), strokeWidth: 2 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
        <DataTable caption="People each day" rows={chartData.map((d) => [d.day, d.people])} />
      </div>

      <div className={styles.grid2}>
        {extra ? (
          <>
            <Stat label="New people" value={fmt(extra.new_people)} note="First time here" />
            <Stat label="Came back" value={fmt(Math.max(0, extra.people - extra.new_people))} note="Been here before" />
            <Stat label="Visits" value={fmt(extra.visits)} change={change(extra.visits, extra.visits_prev, range.word)} />
            <Stat label="Average stay" value={minutesLabel(extra.avg_visit_seconds)} note="How long a visit lasts" />
          </>
        ) : (
          <>
            <Stat label="Visits" value={fmt(sum('total_sessions'))} note="Times the app was opened" />
            <Stat label="Busiest day" value={busiest ? busiest.day : '—'} note={busiest ? `${fmt(busiest.people)} people` : ''} />
          </>
        )}
        <Stat label="Actions" value={fmt(sum('total_events'))} note="Taps, searches, directions" />
        <Stat label="Signed in" value={`${signedInPct}%`} note="Of people each day" />
      </div>

      {extra && <Devices devices={extra.devices} />}
      {extra && <BusiestTimes hours={extra.hours} />}
    </>
  );
}

function Devices({ devices }) {
  const phone = Number(devices?.mobile) || 0;
  const computer = Number(devices?.desktop) || 0;
  const total = phone + computer;
  if (!total) return null;
  const rows = [
    { label: 'On phone', value: phone },
    { label: 'On computer', value: computer },
  ];
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Phone or computer</h3>
        <p className={styles.cardSub}>People, by what they used</p>
      </div>
      <div className={styles.ranked}>
        {rows.map((r) => (
          <div key={r.label} className={styles.rankRow}>
            <div className={styles.rankLine}>
              <span className={styles.rankName}>{r.label}</span>
              <span className={styles.rankCount}>
                {fmt(r.value)} · {Math.round((r.value / total) * 100)}%
              </span>
            </div>
            <div className={styles.bar}>
              <div className={styles.barFill} style={{ width: `${(r.value / total) * 100}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BusiestTimes({ hours }) {
  const byHour = new Map((hours || []).map((h) => [Number(h.hour), Number(h.visits) || 0]));
  const data = Array.from({ length: 24 }, (_, h) => ({ hour: hourLabel(h), visits: byHour.get(h) || 0 }));
  if (!data.some((d) => d.visits)) return null;
  const peak = data.reduce((a, b) => (b.visits > a.visits ? b : a));
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>Busiest times</h3>
        <p className={styles.cardSub}>Visits by time of day. Busiest around {peak.hour}.</p>
      </div>
      <div className={styles.chartSmall}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }} barCategoryGap={2}>
            <XAxis dataKey="hour" tick={axisTick()} axisLine={false} tickLine={false} interval={5} />
            <Tooltip cursor={{ fill: token('--v2-primary-tint') }} content={<DayTooltip unit="visits" />} />
            <Bar dataKey="visits" fill={token('--v2-primary')} radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>
      <DataTable caption="Visits by time of day" rows={data.map((d) => [d.hour, d.visits])} />
    </div>
  );
}

function Stat({ label, value, note, change: ch }) {
  return (
    <div className={styles.card}>
      <div className={styles.statLabel}>{label}</div>
      <div className={styles.statValue}>{value}</div>
      {ch ? <Change value={ch} /> : note && <div className={styles.statNote}>{note}</div>}
    </div>
  );
}

function Change({ value }) {
  if (!value) return null;
  const cls = value.dir === 'up' ? styles.changeUp : value.dir === 'down' ? styles.changeDown : styles.changeSame;
  const arrow = value.dir === 'up' ? '↑' : value.dir === 'down' ? '↓' : '';
  return (
    <div className={`${styles.change} ${cls}`}>
      {arrow && <span aria-hidden="true">{arrow}</span>}
      {value.text}
    </div>
  );
}

function DayTooltip({ active, payload, label, unit }) {
  if (!active || !payload?.length) return null;
  return (
    <div className={styles.tooltip}>
      {label} · {fmt(payload[0].value)} {unit}
    </div>
  );
}

// Same numbers as the chart, for screen readers.
function DataTable({ caption, rows }) {
  return (
    <table className={styles.srOnly}>
      <caption>{caption}</caption>
      <tbody>
        {rows.map(([k, v]) => (
          <tr key={k}>
            <th scope="row">{k}</th>
            <td>{v}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function shortDay(isoDay) {
  return new Date(`${isoDay}T12:00:00`).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

function hourLabel(h) {
  if (h === 0) return '12am';
  if (h === 12) return '12pm';
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}
