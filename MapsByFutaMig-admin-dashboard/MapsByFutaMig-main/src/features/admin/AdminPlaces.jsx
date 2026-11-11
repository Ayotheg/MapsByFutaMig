import { useEffect, useMemo, useState } from 'react';
import { Camera, ChevronRight, Plus, Rss, Search, Sparkles, Store, User, MapPin } from 'lucide-react';
import styles from './AdminViews.module.css';
import AdminSortHeader from './AdminSortHeader';
import { resolveWaypointType } from '../waypoints/wpTypeMeta';
import { WP_ALL_TYPES } from './adminTypeOptions';
import { badgeStyleFor } from './adminBadgeColors';
import { getTypeIcon } from '../../lib/typeIcons';

const PAGE = 100;

const KINDS = [
  { key: 'places', label: 'Places', test: (wp) => !wp.isPerson && !wp.isChannel && !wp.isBusiness, noun: 'places' },
  { key: 'people', label: 'People', test: (wp) => wp.isPerson, noun: 'people' },
  { key: 'channels', label: 'Channels', test: (wp) => wp.isChannel, noun: 'channels' },
  { key: 'business', label: 'Businesses', test: (wp) => wp.isBusiness, noun: 'businesses' },
];

const FILTERS = [
  { key: 'all', label: 'Everything' },
  { key: 'no-photo', label: 'No photos' },
  { key: 'no-desc', label: 'No description' },
  { key: 'explore', label: 'Featured in Explore' },
];

function describe(wp) {
  const resolved = wp.isChannel || wp.isBusiness ? null : resolveWaypointType(wp);
  const typeLabel = wp.isPerson ? 'Person' : wp.isChannel ? 'Channel' : wp.isBusiness ? 'Business' : resolved.replace(/_/g, ' ');
  const badge = wp.isChannel ? badgeStyleFor('channel') : wp.isBusiness ? badgeStyleFor('business') : badgeStyleFor(resolved);
  const Icon = wp.isPerson ? User : wp.isChannel ? Rss : wp.isBusiness ? Store : getTypeIcon(resolved) || MapPin;
  const sub = wp.isChannel ? wp.channelLink : wp.isBusiness ? wp.businessLink : wp.description;
  return { resolved, typeLabel, badge, Icon, sub, photos: wp.imageUrls?.length || 0 };
}

/**
 * Places, people, channels and businesses as one sortable table. Tapping a
 * row opens the existing edit form (AdminEditModal).
 */
export default function AdminPlaces({ waypoints, loading, onEdit, onAdd, onAddOther }) {
  const [kind, setKind] = useState('places');
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState('all');
  const [show, setShow] = useState('all');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [limit, setLimit] = useState(PAGE);

  const kindDef = KINDS.find((k) => k.key === kind);
  const isPlaces = kind === 'places';

  useEffect(() => setLimit(PAGE), [kind, search, typeFilter, show, sort]);

  // Described once per place, not once per render or per sort comparison.
  const rows = useMemo(() => waypoints.map((wp) => ({ wp, ...describe(wp) })), [waypoints]);
  const counts = useMemo(
    () => Object.fromEntries(KINDS.map((k) => [k.key, rows.filter((r) => k.test(r.wp)).length])),
    [rows]
  );

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = rows.filter((r) => {
      const { wp } = r;
      if (!kindDef.test(wp)) return false;
      if (isPlaces && typeFilter !== 'all' && r.resolved !== typeFilter) return false;
      if (show === 'no-photo' && r.photos > 0) return false;
      if (show === 'no-desc' && (wp.description || '').trim()) return false;
      if (show === 'explore' && !wp.isExplore) return false;
      if (!q) return true;
      return (
        (wp.name || '').toLowerCase().includes(q) ||
        (wp.description || '').toLowerCase().includes(q) ||
        (wp.area || '').toLowerCase().includes(q) ||
        r.typeLabel.toLowerCase().includes(q)
      );
    });
    const dir = sort.dir === 'asc' ? 1 : -1;
    const by = {
      name: (a, b) => (a.wp.name || '').localeCompare(b.wp.name || '', undefined, { sensitivity: 'base' }),
      type: (a, b) => a.typeLabel.localeCompare(b.typeLabel),
      area: (a, b) => (a.wp.area || '').localeCompare(b.wp.area || '', undefined, { sensitivity: 'base' }),
      photos: (a, b) => a.photos - b.photos,
    }[sort.key];
    return [...list].sort((a, b) => dir * by(a, b));
  }, [rows, kindDef, isPlaces, typeFilter, show, search, sort]);

  function toggleSort(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }
  const shown = visible.slice(0, limit);
  const addLabel = { places: 'Add place', people: 'Add person', channels: 'Add channel', business: 'Add business' }[kind];

  return (
    <section className={styles.view} aria-label="Places">
      <div className={styles.toolbar}>
        <div className={styles.seg} role="group" aria-label="Kind of entry">
          {KINDS.map((k) => (
            <button key={k.key} type="button" className={styles.segBtn} aria-pressed={kind === k.key} onClick={() => setKind(k.key)}>
              {k.label}
              <span className={styles.segCount}>{counts[k.key]}</span>
            </button>
          ))}
        </div>
        <button
          type="button"
          className={styles.primaryBtn}
          style={{ marginLeft: 'auto' }}
          onClick={() => (isPlaces ? onAdd() : onAddOther(kind))}
        >
          <Plus size={16} /> {addLabel}
        </button>
      </div>

      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={`Search ${kindDef.noun}, areas or descriptions`}
            aria-label={`Search ${kindDef.noun}`}
          />
        </label>
        {isPlaces && (
          <select className={styles.select} value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} aria-label="Type">
            <option value="all">All types</option>
            {WP_ALL_TYPES.map(([t, label]) => (
              <option key={t} value={t}>
                {label}
              </option>
            ))}
          </select>
        )}
        <select className={styles.select} value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show">
          {FILTERS.map((f) => (
            <option key={f.key} value={f.key}>
              {f.label}
            </option>
          ))}
        </select>
      </div>

      <p className={styles.summary} aria-live="polite">
        {loading && !waypoints.length ? 'Loading…' : `${visible.length} of ${counts[kind]} ${kindDef.noun}`}
      </p>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <AdminSortHeader sortKey="name" sort={sort} onSort={toggleSort}>{isPlaces ? 'Place' : 'Name'}</AdminSortHeader>
                <AdminSortHeader sortKey="type" sort={sort} onSort={toggleSort} className={styles.hideNarrower}>
                  Type
                </AdminSortHeader>
                {isPlaces && (
                  <AdminSortHeader sortKey="area" sort={sort} onSort={toggleSort} className={styles.hideNarrow}>
                    Area
                  </AdminSortHeader>
                )}
                <AdminSortHeader sortKey="photos" sort={sort} onSort={toggleSort}>Photos</AdminSortHeader>
                {isPlaces && <th className={`${styles.hideNarrow}`}><span className={styles.thPlain}>Coordinates</span></th>}
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {shown.map((r) => {
                const { wp, Icon, badge } = r;
                return (
                  <tr
                    key={wp.id}
                    className={styles.row}
                    tabIndex={0}
                    onClick={() => onEdit(wp)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onEdit(wp);
                      }
                    }}
                  >
                    <td>
                      <div className={styles.rowPlace}>
                        <span className={styles.rowIcon} style={{ background: badge.background, borderColor: badge.borderColor, color: badge.color }}>
                          <Icon size={18} />
                        </span>
                        <div className={styles.rowText}>
                          <div className={styles.rowName}>
                            {wp.name || '(unnamed)'}
                            {wp.isExplore && (
                              <span className={styles.flag} title="Featured in Explore">
                                <Sparkles size={14} />
                              </span>
                            )}
                          </div>
                          <div className={`${styles.rowSub} ${!r.sub ? styles.rowSubEmpty : ''}`}>
                            {r.sub || (wp.isChannel || wp.isBusiness ? 'No link added' : 'No description added')}
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className={styles.hideNarrower}>
                      <span className={styles.badge} style={badge}>
                        {r.typeLabel}
                      </span>
                    </td>
                    {isPlaces && <td className={styles.hideNarrow}>{wp.area || <span className={styles.photoNone}>–</span>}</td>}
                    <td>
                      {r.photos > 0 ? (
                        <span className={styles.photoCell}>
                          <Camera size={14} /> {r.photos}
                        </span>
                      ) : (
                        <span className={`${styles.photoCell} ${styles.photoNone}`}>None</span>
                      )}
                    </td>
                    {isPlaces && (
                      <td className={`${styles.hideNarrow} ${styles.num}`}>
                        {Number(wp.lat || 0).toFixed(5)}, {Number(wp.lng || 0).toFixed(5)}
                      </td>
                    )}
                    <td>
                      <span className={styles.chev}>
                        <ChevronRight size={18} />
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          {!loading && visible.length === 0 && (
            <div className={styles.empty}>{search || show !== 'all' || typeFilter !== 'all' ? 'Nothing matches those filters.' : `No ${kindDef.noun} yet.`}</div>
          )}
        </div>
        {visible.length > limit && (
          <div className={styles.moreWrap}>
            <button type="button" className={styles.ghostBtn} onClick={() => setLimit((n) => n + PAGE)}>
              Show {Math.min(PAGE, visible.length - limit)} more
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
