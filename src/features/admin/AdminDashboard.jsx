import { lazy, Suspense, useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import {
  BarChart3,
  Bell,
  CalendarDays,
  FileUp,
  Inbox,
  KeyRound,
  LayoutDashboard,
  LogOut,
  Map as MapIcon,
  Megaphone,
  MapPin,
  RefreshCw,
  Route,
  Tags,
} from 'lucide-react';
import styles from './AdminDashboard.module.css';
import panelStyles from './AdminPanel.module.css';
import pendingStyles from './PendingTab.module.css';
import { supabase } from '../../lib/supabase';
import { initials } from '../auth/useAuth';
import { useWaypoints } from '../waypoints/useWaypoints';
import { useSegments } from '../segments/useSegments';
import { useQuickChips } from '../search/useQuickChips';
import { fetchAdminOverview } from '../developers/developerApi';
import InsightsErrorBoundary from '../analytics/InsightsErrorBoundary';
import AdminOverview from './AdminOverview';
import AdminPlaces from './AdminPlaces';
import AdminRoutes from './AdminRoutes';
import AdminAddPlace from './AdminAddPlace';
import AdminMapStage from './AdminMapStage';
import AdminEditModal from './AdminEditModal';
import PendingTab from './PendingTab';
import PromotionsTab from './PromotionsTab';
import EventsTab from './EventsTab';
import ApiTab from './ApiTab';
import NotifyTab from './NotifyTab';
import QuickChipsTab from './QuickChipsTab';
import KmlTab from './KmlTab';
import { useAdminKml } from './useAdminKml';
import { useAdminMapModes } from './useAdminMapModes';

// The heaviest view (recharts + several queries) loads only when opened.
const InsightsTab = lazy(() => import('../analytics/InsightsTab'));

const NAV = [
  { items: [{ key: 'overview', label: 'Overview', title: 'Overview', sub: 'What needs doing and how the data looks', Icon: LayoutDashboard }] },
  {
    group: 'Map data',
    items: [
      { key: 'places', label: 'Places', title: 'Places', sub: 'Every place, person, channel and business on the map', Icon: MapPin },
      { key: 'routes', label: 'Routes', title: 'Routes', sub: 'Footpaths, roads and shortcuts', Icon: Route },
      { key: 'kml', label: 'KML import', title: 'KML import', sub: 'Load a KML file and save its points and lines', Icon: FileUp },
      { key: 'chips', label: 'Quick chips', title: 'Quick chips', sub: 'The shortcut chips above the map search', Icon: Tags },
    ],
  },
  {
    group: 'Review',
    items: [
      { key: 'pending', label: 'Suggestions', title: 'Place suggestions', sub: 'Places students suggested, waiting for a decision', Icon: Inbox, count: 'pending' },
      { key: 'promotions', label: 'Promotions', title: 'Promotions', sub: 'Paid promotions to approve, and the ones running', Icon: Megaphone, count: 'promotions' },
      { key: 'events', label: 'Events', title: 'Events', sub: 'Listings to approve and feature', Icon: CalendarDays, count: 'events' },
      { key: 'api', label: 'API', title: 'API requests', sub: 'Developer keys, credits and requests', Icon: KeyRound, count: 'api' },
    ],
  },
  {
    group: 'Activity',
    items: [
      { key: 'insights', label: 'Insights', title: 'Insights', sub: 'How people use the app', Icon: BarChart3 },
      { key: 'notify', label: 'Notifications', title: 'Notifications', sub: 'The weekly round-up and a test ping', Icon: Bell },
    ],
  },
];
const ITEMS = NAV.flatMap((g) => g.items);
const VIEW_KEYS = new Set(ITEMS.map((i) => i.key));
// These views fill the page and scroll inside their own list; the rest scroll as a page.
const FILL_VIEWS = new Set(['places', 'routes', 'kml', 'chips', 'pending', 'promotions', 'events', 'api', 'notify']);
const EMPTY = [];

export default function AdminDashboard({ user, onSignOut }) {
  const [params, setParams] = useSearchParams();
  const requested = params.get('view');
  const view = VIEW_KEYS.has(requested) ? requested : 'overview';
  const setView = useCallback(
    (next) => setParams(next === 'overview' ? {} : { view: next }, { replace: false }),
    [setParams]
  );
  const item = ITEMS.find((i) => i.key === view);

  const { waypoints, loading: waypointsLoading, refetch: refetchWaypoints } = useWaypoints();
  const { segments, loading: segmentsLoading, refetch: refetchSegments } = useSegments();
  const quickChips = useQuickChips();

  const [counts, setCounts] = useState({ pending: 0, promotions: 0, events: 0, api: 0 });
  const setCount = useCallback((key) => (n) => setCounts((c) => (c[key] === n ? c : { ...c, [key]: n })), []);
  const onPendingCount = useMemo(() => setCount('pending'), [setCount]);
  const onPromoCount = useMemo(() => setCount('promotions'), [setCount]);
  const onEventCount = useMemo(() => setCount('events'), [setCount]);
  const onApiCount = useMemo(() => setCount('api'), [setCount]);

  const [refreshKey, setRefreshKey] = useState(0);

  // Head-only counts (no rows fetched) so every badge is right from the first paint.
  const loadCounts = useCallback(() => {
    let cancelled = false;
    const put = (key, n) => !cancelled && setCounts((c) => ({ ...c, [key]: n }));
    const head = (table) => supabase.from(table).select('id', { count: 'exact', head: true });
    const apply = (key) => ({ count, error }) => {
      if (!error && typeof count === 'number') put(key, count);
    };
    head('waypoints').eq('status', 'pending').then(apply('pending'));
    head('promotions').eq('payment_status', 'paid').eq('status', 'pending_review').then(apply('promotions'));
    head('events').eq('status', 'pending_review').in('payment_status', ['not_required', 'paid']).then(apply('events'));
    fetchAdminOverview()
      .then((o) => put('api', (o.requests || []).filter((r) => r.status === 'open').length))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  useEffect(() => loadCounts(), [loadCounts]);

  const refreshAll = useCallback(() => {
    refetchWaypoints();
    refetchSegments();
    quickChips.refetch();
    loadCounts();
    setRefreshKey((k) => k + 1);
  }, [refetchWaypoints, refetchSegments, quickChips, loadCounts]);

  // ── The map: only brought up for jobs that need one ─────────────────────
  const [map, setMap] = useState(null);
  const modes = useAdminMapModes({
    map,
    onSegmentsChanged: refetchSegments,
    onPathSaved: () => setView('routes'),
  });
  const adminKml = useAdminKml({ map });

  const [editContext, setEditContext] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const { setPickedCoord } = modes;
  const clearPicked = useCallback(() => setPickedCoord(null), [setPickedCoord]);

  function addOther(kind) {
    const flag = { people: 'isPerson', channels: 'isChannel', business: 'isBusiness' }[kind];
    setEditContext({ type: 'waypoint', id: null, isNew: true, data: { name: '', description: '', [flag]: true } });
  }

  const hasKml = Object.keys(adminKml.registry).length > 0;
  const widePanel = `${panelStyles.wide} ${pendingStyles.wide} ${styles.workspace}`;

  let body;
  switch (view) {
    case 'overview':
      body = (
        <AdminOverview
          counts={counts}
          waypoints={waypoints}
          segments={segments}
          onGo={setView}
          onAddPlace={() => setAddOpen(true)}
          onDrawPath={modes.startDraw}
        />
      );
      break;
    case 'places':
      body = (
        <AdminPlaces
          waypoints={waypoints}
          loading={waypointsLoading}
          onEdit={(wp) => setEditContext({ type: 'waypoint', id: wp.id, data: wp })}
          onAdd={() => setAddOpen(true)}
          onAddOther={addOther}
        />
      );
      break;
    case 'routes':
      body = (
        <AdminRoutes
          segments={segments}
          loading={segmentsLoading}
          onEdit={(seg) => setEditContext({ type: 'segment', id: seg.id, data: seg })}
          onDraw={modes.startDraw}
        />
      );
      break;
    case 'kml':
      body = (
        <div className={widePanel}>
          {hasKml && (
            <div className={styles.workspaceBar}>
              <button type="button" className={styles.barBtn} onClick={modes.viewMap}>
                <MapIcon size={16} /> Show on map
              </button>
            </div>
          )}
          <KmlTab adminKml={adminKml} onEditKmlFeature={(ctx) => setEditContext({ type: 'kml', ...ctx })} />
        </div>
      );
      break;
    case 'chips':
      body = (
        <div className={widePanel}>
          <QuickChipsTab
            user={user}
            chips={quickChips.chips}
            waypoints={waypoints}
            kmlAnnotations={EMPTY}
            onChipsChanged={quickChips.refetch}
          />
        </div>
      );
      break;
    case 'pending':
      body = (
        <div className={widePanel}>
          <PendingTab onRefreshWaypoints={refetchWaypoints} onCountChange={onPendingCount} />
        </div>
      );
      break;
    case 'promotions':
      body = (
        <div className={widePanel}>
          <PromotionsTab onCountChange={onPromoCount} onRefreshWaypoints={refetchWaypoints} />
        </div>
      );
      break;
    case 'events':
      body = (
        <div className={widePanel}>
          <EventsTab onCountChange={onEventCount} />
        </div>
      );
      break;
    case 'api':
      body = (
        <div className={widePanel}>
          <ApiTab onCountChange={onApiCount} />
        </div>
      );
      break;
    case 'notify':
      body = (
        <div className={widePanel}>
          <NotifyTab />
        </div>
      );
      break;
    case 'insights':
      body = (
        <div className={styles.reading}>
          <InsightsErrorBoundary>
            <Suspense fallback={<p className={styles.loading}>Loading insights…</p>}>
              <InsightsTab />
            </Suspense>
          </InsightsErrorBoundary>
        </div>
      );
      break;
    default:
      body = null;
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.rail}>
        <div className={styles.brand}>
          <img src="/android-chrome-512x512.png" alt="" width="36" height="36" className={styles.brandLogo} />
          <div className={styles.brandText}>
            <span className={styles.brandName}>Maps By FUTA</span>
            <span className={styles.brandRole}>Admin</span>
          </div>
        </div>

        <nav className={styles.nav} aria-label="Admin sections">
          {NAV.map((group, gi) => (
            <div key={gi} className={styles.navGroup}>
              {group.group && <div className={styles.navGroupLabel}>{group.group}</div>}
              {group.items.map(({ key, label, Icon, count }) => {
                const n = count ? counts[count] : 0;
                const active = key === view;
                return (
                  <button
                    key={key}
                    type="button"
                    className={styles.navItem}
                    aria-current={active ? 'page' : undefined}
                    title={label}
                    onClick={() => setView(key)}
                  >
                    <Icon size={20} aria-hidden="true" />
                    <span className={styles.navLabel}>{label}</span>
                    {n > 0 && (
                      <span className={styles.navCount} aria-label={`${n} waiting`}>
                        {n}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          ))}
        </nav>

        <div className={styles.railFoot}>
          <Link to="/map" className={styles.navItem} title="Back to map">
            <MapIcon size={20} aria-hidden="true" />
            <span className={styles.navLabel}>Back to map</span>
          </Link>
          <div className={styles.account}>
            <span className={styles.avatar} aria-hidden="true">
              {initials(user)}
            </span>
            <span className={styles.accountEmail} title={user?.email}>
              {user?.email}
            </span>
            <button type="button" className={styles.signOut} onClick={onSignOut} aria-label="Sign out" title="Sign out">
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.topText}>
            <h1 className={styles.pageTitle}>{item.title}</h1>
            <p className={styles.pageSub}>{item.sub}</p>
          </div>
          <button type="button" className={styles.refresh} onClick={refreshAll} aria-label="Refresh data" title="Refresh data">
            <RefreshCw size={18} />
          </button>
        </header>

        <main className={styles.content} data-fill={FILL_VIEWS.has(view)} key={`${view}-${refreshKey}`}>
          {body}
        </main>
      </div>

      <AdminMapStage modes={modes} waypoints={waypoints} onReady={setMap} />

      {addOpen && (
        <AdminAddPlace
          pickedCoord={modes.pickedCoord}
          onCoordConsumed={clearPicked}
          onPickOnMap={modes.startPicking}
          hidden={modes.mode === 'pick'}
          onClose={() => setAddOpen(false)}
          onSaved={refetchWaypoints}
        />
      )}

      {editContext && (
        <AdminEditModal
          editContext={editContext}
          onMovePin={modes.movePin}
          hidden={modes.mode === 'move'}
          onClose={() => setEditContext(null)}
          onWaypointChanged={refetchWaypoints}
          onSegmentChanged={refetchSegments}
          adminKml={adminKml}
        />
      )}
    </div>
  );
}
