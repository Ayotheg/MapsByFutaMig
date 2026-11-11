import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { CalendarDays, Inbox, KeyRound, Megaphone, MapPin, PenLine, Plus, FileUp } from 'lucide-react';
import styles from './AdminViews.module.css';
import { resolveWaypointType } from '../waypoints/wpTypeMeta';
import { describeError, fetchRecentSignups, fetchRollup, fetchTableCounts } from '../analytics/analyticsApi';
import { fmt, shortDate } from '../analytics/insightsWords';

const AdminVisitorsChart = lazy(() => import('./AdminVisitorsChart'));

const QUEUES = [
  { key: 'pending', view: 'pending', label: 'Place suggestions', Icon: Inbox, waiting: 'to review' },
  { key: 'promotions', view: 'promotions', label: 'Promotions', Icon: Megaphone, waiting: 'paid, to review' },
  { key: 'events', view: 'events', label: 'Events', Icon: CalendarDays, waiting: 'to review' },
  { key: 'api', view: 'api', label: 'API requests', Icon: KeyRound, waiting: 'open' },
];

/** The landing screen: what needs doing, how big the data is, how it's used. */
export default function AdminOverview({ dark, counts, waypoints, segments, onGo, onAddPlace, onDrawPath }) {
  const [totals, setTotals] = useState(null);
  const [totalsError, setTotalsError] = useState(null);
  const [signups, setSignups] = useState(null);
  const [signupsError, setSignupsError] = useState(null);
  const [rollup, setRollup] = useState(null);
  const [rollupError, setRollupError] = useState(null);

  useEffect(() => {
    let cancelled = false;
    fetchTableCounts()
      .then((rows) => !cancelled && setTotals(Object.fromEntries(rows.map((r) => [r.table_name, Number(r.row_count) || 0]))))
      .catch((e) => !cancelled && setTotalsError(describeError(e)));
    fetchRecentSignups(6)
      .then((rows) => !cancelled && setSignups(rows))
      .catch((e) => !cancelled && setSignupsError(describeError(e)));
    fetchRollup(14)
      .then((rows) => !cancelled && setRollup([...rows].reverse()))
      .catch((e) => !cancelled && setRollupError(describeError(e)));
    return () => {
      cancelled = true;
    };
  }, []);

  const places = useMemo(() => waypoints.filter((w) => !w.isPerson && !w.isChannel && !w.isBusiness), [waypoints]);
  const withoutPhoto = useMemo(() => places.filter((w) => !(w.imageUrls?.length > 0)).length, [places]);
  const withoutDescription = useMemo(() => places.filter((w) => !(w.description || '').trim()).length, [places]);
  const byType = useMemo(() => {
    const tally = new Map();
    places.forEach((w) => {
      const t = resolveWaypointType(w).replace(/_/g, ' ');
      tally.set(t, (tally.get(t) || 0) + 1);
    });
    return [...tally.entries()].sort((a, b) => b[1] - a[1]).slice(0, 7);
  }, [places]);
  const topCount = byType[0]?.[1] || 1;

  const visitors14 = rollup ? rollup.reduce((s, r) => s + (Number(r.unique_visitors) || 0), 0) : null;
  const totalWaiting = QUEUES.reduce((s, q) => s + (counts[q.key] || 0), 0);

  return (
    <div className={styles.view} style={{ height: 'auto', gap: 24 }}>
      <section aria-labelledby="ov-queue">
        <div className={styles.panelHead} style={{ marginBottom: 12 }}>
          <div>
            <h2 id="ov-queue" className={styles.sectionTitle}>
              Needs your attention
            </h2>
            <p className={styles.sectionSub}>{totalWaiting > 0 ? `${totalWaiting} waiting across the queues` : 'Everything is reviewed'}</p>
          </div>
        </div>
        <div className={styles.queueGrid}>
          {QUEUES.map(({ key, view, label, Icon, waiting }) => {
            const n = counts[key] || 0;
            return (
              <button key={key} type="button" className={styles.queueCard} data-waiting={n > 0} onClick={() => onGo(view)}>
                <span className={styles.queueTop}>
                  {label}
                  <span className={styles.queueIcon}>
                    <Icon size={18} />
                  </span>
                </span>
                <span className={styles.bigNum}>{n}</span>
                <span className={styles.queueHint}>{n > 0 ? waiting : 'All clear'}</span>
              </button>
            );
          })}
        </div>
      </section>

      <section aria-labelledby="ov-data">
        <h2 id="ov-data" className={styles.sectionTitle} style={{ marginBottom: 12 }}>
          The data
        </h2>
        <div className={styles.kpiGrid}>
          <Kpi label="Places" value={places.length} sub={`${waypoints.length - places.length} people, channels and businesses`} />
          <Kpi label="Routes" value={segments.length} sub="Footpaths, roads and shortcuts" />
          <Kpi
            label="Without a photo"
            value={withoutPhoto}
            sub={places.length ? `${Math.round((withoutPhoto / places.length) * 100)}% of places` : ''}
          />
          <Kpi label="Without a description" value={withoutDescription} sub={places.length ? `${Math.round((withoutDescription / places.length) * 100)}% of places` : ''} />
        </div>
        {totalsError && (
          <p className={styles.errorNote} style={{ marginTop: 12 }}>
            {totalsError}
          </p>
        )}
        {totals && (
          <div className={styles.kpiGrid} style={{ marginTop: 12 }}>
            <Kpi label="Accounts" value={totals.profiles} />
            <Kpi label="Reviews" value={totals.reviews} />
          </div>
        )}
      </section>

      <div className={styles.panels}>
        <section className={styles.panel} aria-labelledby="ov-visitors">
          <div className={styles.panelHead}>
            <div>
              <h2 id="ov-visitors" className={styles.sectionTitle}>
                People using the app
              </h2>
              <p className={styles.sectionSub}>Last 14 days</p>
            </div>
            {visitors14 != null && <span className={styles.bigNum} style={{ fontSize: 26 }}>{fmt(visitors14)}</span>}
          </div>
          {rollupError && <p className={styles.errorNote}>{rollupError}</p>}
          {!rollup && !rollupError && <p className={styles.muted}>Loading…</p>}
          {rollup && (
            <div className={styles.chartBox}>
              <Suspense fallback={null}>
                <AdminVisitorsChart rows={rollup} dark={dark} />
              </Suspense>
            </div>
          )}
          <div>
            <button type="button" className={styles.linkBtn} onClick={() => onGo('insights')}>
              Open full insights
            </button>
          </div>
        </section>

        <section className={styles.panel} aria-labelledby="ov-types">
          <div>
            <h2 id="ov-types" className={styles.sectionTitle}>
              Places by type
            </h2>
            <p className={styles.sectionSub}>Most common first</p>
          </div>
          {byType.length === 0 ? (
            <p className={styles.muted}>No places loaded yet.</p>
          ) : (
            <ul className={styles.bars}>
              {byType.map(([label, n]) => (
                <li key={label} className={styles.barRow}>
                  <span className={styles.barLabel}>{label}</span>
                  <span className={styles.barTrack}>
                    <span className={styles.barFill} style={{ width: `${Math.max(4, (n / topCount) * 100)}%`, display: 'block' }} />
                  </span>
                  <span className={styles.num}>{n}</span>
                </li>
              ))}
            </ul>
          )}
          <div>
            <button type="button" className={styles.linkBtn} onClick={() => onGo('places')}>
              Open all places
            </button>
          </div>
        </section>
      </div>

      <div className={styles.panels}>
        <section className={styles.panel} aria-labelledby="ov-signups">
          <div>
            <h2 id="ov-signups" className={styles.sectionTitle}>
              New accounts
            </h2>
            <p className={styles.sectionSub}>Latest sign-ups</p>
          </div>
          {signupsError && <p className={styles.errorNote}>{signupsError}</p>}
          {!signups && !signupsError && <p className={styles.muted}>Loading…</p>}
          {signups && signups.length === 0 && <p className={styles.muted}>No sign-ups yet.</p>}
          {signups && signups.length > 0 && (
            <ul className={styles.people}>
              {signups.map((s) => (
                <li key={s.id} className={styles.person}>
                  <span className={styles.avatar} aria-hidden="true">
                    {(s.display_name || '?').trim().charAt(0).toUpperCase()}
                  </span>
                  <span className={styles.personName}>{s.display_name || 'No name'}</span>
                  <span className={styles.personDate}>{shortDate(s.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className={styles.panel} aria-labelledby="ov-actions">
          <h2 id="ov-actions" className={styles.sectionTitle}>
            Quick actions
          </h2>
          <div className={styles.actions}>
            <button type="button" className={styles.primaryBtn} onClick={onAddPlace}>
              <Plus size={16} /> Add place
            </button>
            <button type="button" className={styles.ghostBtn} onClick={onDrawPath}>
              <PenLine size={16} /> Draw path
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => onGo('kml')}>
              <FileUp size={16} /> Import KML
            </button>
            <button type="button" className={styles.ghostBtn} onClick={() => onGo('places')}>
              <MapPin size={16} /> Browse places
            </button>
          </div>
        </section>
      </div>
    </div>
  );
}

function Kpi({ label, value, sub }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.bigNum}>{fmt(value)}</span>
      {sub ? <span className={styles.kpiSub}>{sub}</span> : null}
    </div>
  );
}
