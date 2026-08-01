import { useState } from 'react';
import adminStyles from '../admin/AdminPanel.module.css';
import styles from './InsightsTab.module.css';
import LiveTab from './LiveTab';
import OverviewTab from './OverviewTab';
import FeatureUsageTab from './FeatureUsageTab';
import SearchRoutesTab from './SearchRoutesTab';
import JourneysTab from './JourneysTab';
import DatabaseTab from './DatabaseTab';

// ── Slice 14 — "Insights" tab, AdminPanel.jsx's 6th tab ─────────────────
// New feature, no legacy source (ANALYTICS_BUILD_PLAN.md §0). Lazy-loaded
// from AdminPanel.jsx per CLAUDE.md's bundle-size policy — this is
// explicitly the heaviest tab (recharts + presence + several queries), a
// textbook lazy-load candidate, same as AdminPanel itself is for
// MapPage.jsx.
//
// Own inner sub-tab bar (Live/Overview/Feature Usage/Search & Routes/
// Journeys/Database) rather than adding 5 more top-level entries to
// AdminPanel's own TABS array — this mirrors how the build plan describes
// "InsightsTab.jsx (sub-tab shell) + sub-views", keeping AdminPanel's own
// tab bar exactly as it was (still just the one new "Insights" entry).
const SUB_TABS = [
  { key: 'live', label: 'Live' },
  { key: 'overview', label: 'Overview' },
  { key: 'features', label: 'Features' },
  { key: 'search', label: 'Search' },
  { key: 'journeys', label: 'Journeys' },
  { key: 'database', label: 'Database' },
];

export default function InsightsTab() {
  // Live is first — matches the stated priority (unique counting + live
  // view is priority #1 in the build plan).
  const [subTab, setSubTab] = useState('live');

  return (
    <div className={adminStyles.tabContent}>
      <div className={styles.subTabbar}>
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            type="button"
            className={`${styles.subTab} ${subTab === t.key ? styles.subTabActive : ''}`}
            onClick={() => setSubTab(t.key)}
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className={styles.subTabBody}>
        {subTab === 'live' && <LiveTab />}
        {subTab === 'overview' && <OverviewTab />}
        {subTab === 'features' && <FeatureUsageTab />}
        {subTab === 'search' && <SearchRoutesTab />}
        {subTab === 'journeys' && <JourneysTab />}
        {subTab === 'database' && <DatabaseTab />}
      </div>
    </div>
  );
}