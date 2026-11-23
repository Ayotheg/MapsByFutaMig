import { useEffect, useMemo } from 'react';
import styles from './InsightsTab.module.css';
import { SOURCE_LABELS, fmt, placeTypeLabel } from './insightsWords';

// Places: where people go and what they look for, last 30 days.
// "Most opened", "How people found them", "Kinds of place" and "Found
// nothing" need supabase/analytics_insights.sql and hide until it's run.
const DAYS = 30;

export default function PlacesTab({ rollup, rollupError, insights, loadInsights }) {
  useEffect(() => loadInsights(DAYS), [loadInsights]);
  const extra = insights[DAYS];

  // Exact (trips started) when the extra numbers exist. The rollup's
  // top_routes counts a trip once when started and again when finished,
  // so its fallback is labelled rough.
  const destinations = useMemo(
    () => (extra?.top_destinations ? extra.top_destinations : totals(rollup, 'top_routes', (r) => r.to)),
    [rollup, extra]
  );
  const searches = useMemo(() => totals(rollup, 'top_searches', (r) => r.query?.trim().toLowerCase()), [rollup]);

  if (rollupError && !extra) return <div className={styles.errorNote}>{rollupError}</div>;
  if (!rollup && !extra) return <div className={styles.muted}>Loading…</div>;

  const sources = extra
    ? Object.entries(extra.place_sources || {})
        .map(([key, count]) => ({ name: SOURCE_LABELS[key] || SOURCE_LABELS.other, count: Number(count) }))
        .sort((a, b) => b.count - a.count)
    : [];

  return (
    <>
      {extra && extra.places_opened > 0 && (
        <>
          <RankedCard
            title="Most opened places"
            sub={`${fmt(extra.places_opened)} times a place was opened, last ${DAYS} days`}
            rows={extra.top_places.map((p) => ({ name: p.name, count: p.count }))}
          />
          {extra.opened_then_directions != null && (
            <div className={styles.card}>
              <div className={styles.statLabel}>Opened a place, then got directions</div>
              <div className={styles.statValue}>{extra.opened_then_directions}%</div>
              <div className={styles.statNote}>Of visits where someone opened a place</div>
            </div>
          )}
          <RankedCard title="How people found places" sub="Where they opened them from" rows={sources} teal />
          <RankedCard
            title="Kinds of place"
            sub="What sort of places people open"
            rows={extra.place_types.map((t) => ({ name: placeTypeLabel(t.type), count: t.count }))}
          />
        </>
      )}

      <RankedCard
        title="Top destinations"
        sub={`Where people got directions to, last ${DAYS} days${extra?.top_destinations ? '' : ' (rough count)'}`}
        rows={destinations}
        empty="No directions yet."
      />

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <h3 className={styles.cardTitle}>What people searched</h3>
          <p className={styles.cardSub}>Most searched first</p>
        </div>
        {searches.length === 0 ? (
          <div className={styles.muted}>No searches yet.</div>
        ) : (
          <>
            <div className={styles.chips}>
              {searches.map((s) => (
                <span key={s.name} className={styles.chip}>
                  {s.name} <span className={styles.chipCount}>{fmt(s.count)}</span>
                </span>
              ))}
            </div>
            {searches.every((s) => s.count === 1) && (
              <p className={styles.note}>Each was searched once. More will show here as searches grow.</p>
            )}
          </>
        )}
      </div>

      {extra && extra.nothing_found.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <h3 className={styles.cardTitle}>Searched but found nothing</h3>
            <p className={styles.cardSub}>Worth adding to the map</p>
          </div>
          <div className={styles.chips}>
            {extra.nothing_found.map((s) => (
              <span key={s.query} className={`${styles.chip} ${styles.chipWarn}`}>
                {s.query} <span className={styles.chipCount}>{fmt(s.count)}</span>
              </span>
            ))}
          </div>
        </div>
      )}
    </>
  );
}

function RankedCard({ title, sub, rows, empty, teal }) {
  // Two raw values can read the same in plain words ("Other", or a type
  // saved in two spellings): one row each, counts added.
  const merged = new Map();
  for (const r of rows) merged.set(r.name, (merged.get(r.name) || 0) + (Number(r.count) || 0));
  const top = [...merged.entries()]
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8);
  const max = Math.max(1, ...top.map((r) => r.count));
  return (
    <div className={styles.card}>
      <div className={styles.cardHead}>
        <h3 className={styles.cardTitle}>{title}</h3>
        {sub && <p className={styles.cardSub}>{sub}</p>}
      </div>
      {top.length === 0 ? (
        <div className={styles.muted}>{empty || 'Nothing yet.'}</div>
      ) : (
        <ol className={styles.ranked} style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {top.map((r, i) => (
            <li key={r.name} className={styles.rankRow}>
              <div className={styles.rankLine}>
                <span className={styles.rankIndex}>{i + 1}</span>
                <span className={styles.rankName}>{r.name}</span>
                <span className={styles.rankCount}>{fmt(r.count)}</span>
              </div>
              <div className={`${styles.bar} ${styles.barIndented}`}>
                <div
                  className={`${styles.barFill} ${teal ? styles.barFillTeal : ''}`}
                  style={{ width: `${(r.count / max) * 100}%` }}
                />
              </div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

// Adds up one of the rollup's per-day top-10 lists across the month.
function totals(rollup, field, keyOf) {
  const sum = new Map();
  for (const day of rollup || []) {
    for (const item of day[field] || []) {
      const key = keyOf(item);
      if (!key) continue;
      sum.set(key, (sum.get(key) || 0) + (Number(item.count) || 0));
    }
  }
  return [...sum.entries()].map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count);
}

export { RankedCard };
