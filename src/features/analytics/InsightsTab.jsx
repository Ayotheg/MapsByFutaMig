import { useCallback, useEffect, useRef, useState } from 'react';
import styles from './InsightsTab.module.css';
import { fetchInsights, fetchRollup, describeError } from './analyticsApi';
import TodayTab from './TodayTab';
import TrendsTab from './TrendsTab';
import PlacesTab from './PlacesTab';
import UsageTab from './UsageTab';
import DataTab from './DataTab';

// Admin → Insights: how people use the app, in plain words. Lazy-loaded
// from AdminPanel.jsx (recharts is the heaviest thing in admin).
//
// The daily rollup (supabase/analytics.sql) is fetched once here and shared
// by every tab. The extra numbers (supabase/analytics_insights.sql) are
// fetched per time range and cached; they're null until that file has been
// run, and the cards that need them stay hidden.
const TABS = [
  { key: 'today', label: 'Today' },
  { key: 'trends', label: 'Trends' },
  { key: 'places', label: 'Places' },
  { key: 'usage', label: 'Usage' },
  { key: 'data', label: 'Data' },
];

export default function InsightsTab() {
  const [tab, setTab] = useState('today');
  const [rollup, setRollup] = useState(null);
  const [rollupError, setRollupError] = useState(null);
  const [insights, setInsights] = useState({}); // days → data | null
  const requested = useRef(new Set());

  useEffect(() => {
    let cancelled = false;
    fetchRollup(30)
      // Newest-first from the RPC; charts read oldest-first.
      .then((rows) => !cancelled && setRollup([...rows].reverse()))
      .catch((e) => !cancelled && setRollupError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const loadInsights = useCallback((days) => {
    if (requested.current.has(days)) return;
    requested.current.add(days);
    fetchInsights(days)
      .then((data) => setInsights((m) => ({ ...m, [days]: data })))
      // Extras are optional: a failure just leaves their cards hidden.
      .catch(() => setInsights((m) => ({ ...m, [days]: null })));
  }, []);

  const shared = { rollup, rollupError, insights, loadInsights };

  return (
    <div className={styles.root}>
      <div className={styles.scroll}>
        <div>
          <h2 className={styles.title}>Insights</h2>
          <p className={styles.subtitle}>How people are using MapsByFUTA</p>
        </div>

        <div className={styles.segment} role="tablist" aria-label="Insights sections">
          {TABS.map((t) => (
            <button
              key={t.key}
              type="button"
              role="tab"
              aria-selected={tab === t.key}
              className={`${styles.segmentBtn} ${tab === t.key ? styles.segmentBtnActive : ''}`}
              onClick={() => setTab(t.key)}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'today' && <TodayTab {...shared} />}
        {tab === 'trends' && <TrendsTab {...shared} />}
        {tab === 'places' && <PlacesTab {...shared} />}
        {tab === 'usage' && <UsageTab {...shared} />}
        {tab === 'data' && <DataTab />}
      </div>
    </div>
  );
}
