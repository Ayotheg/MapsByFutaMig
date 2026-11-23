import { useMemo, useState } from 'react';
import { Camera, ChevronRight, PenLine, Route, Search } from 'lucide-react';
import styles from './AdminViews.module.css';
import AdminSortHeader from './AdminSortHeader';
import { badgeStyleFor } from './adminBadgeColors';

/** Saved paths as a sortable table; tapping one opens the edit form. */
export default function AdminRoutes({ segments, loading, onEdit, onDraw }) {
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = segments.filter(
      (s) => !q || (s.name || '').toLowerCase().includes(q) || (s.description || '').toLowerCase().includes(q) || (s.category || '').toLowerCase().includes(q)
    );
    const dir = sort.dir === 'asc' ? 1 : -1;
    const by = {
      name: (a, b) => (a.name || '').localeCompare(b.name || '', undefined, { sensitivity: 'base' }),
      category: (a, b) => (a.category || '').localeCompare(b.category || ''),
      distance: (a, b) => (a.distance || 0) - (b.distance || 0),
      stops: (a, b) => (a.waypoints || []).length - (b.waypoints || []).length,
    }[sort.key];
    return [...list].sort((a, b) => dir * by(a, b));
  }, [segments, search, sort]);

  function toggle(key) {
    setSort((s) => (s.key === key ? { key, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { key, dir: 'asc' }));
  }
  const badge = badgeStyleFor('road');

  return (
    <section className={styles.view} aria-label="Routes">
      <div className={styles.toolbar}>
        <label className={styles.search}>
          <Search size={18} />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search routes" aria-label="Search routes" />
        </label>
        <button type="button" className={styles.primaryBtn} onClick={onDraw}>
          <PenLine size={16} /> Draw path
        </button>
      </div>

      <p className={styles.summary} aria-live="polite">
        {loading && !segments.length ? 'Loading…' : `${visible.length} of ${segments.length} routes`}
      </p>

      <div className={styles.tableCard}>
        <div className={styles.tableScroll}>
          <table className={styles.table}>
            <thead>
              <tr>
                <AdminSortHeader sortKey="name" sort={sort} onSort={toggle}>Route</AdminSortHeader>
                <AdminSortHeader sortKey="category" sort={sort} onSort={toggle} className={styles.hideNarrower}>
                  Type
                </AdminSortHeader>
                <AdminSortHeader sortKey="distance" sort={sort} onSort={toggle}>Length</AdminSortHeader>
                <AdminSortHeader sortKey="stops" sort={sort} onSort={toggle} className={styles.hideNarrow}>
                  Places on it
                </AdminSortHeader>
                <th className={styles.hideNarrow}>
                  <span className={styles.thPlain}>Photos</span>
                </th>
                <th aria-label="Open" />
              </tr>
            </thead>
            <tbody>
              {visible.map((seg) => {
                const photos = seg.imageUrls?.length || 0;
                return (
                  <tr
                    key={seg.id}
                    className={styles.row}
                    tabIndex={0}
                    onClick={() => onEdit(seg)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        onEdit(seg);
                      }
                    }}
                  >
                    <td>
                      <div className={styles.rowPlace}>
                        <span className={styles.rowIcon} style={{ background: badge.background, borderColor: badge.borderColor, color: badge.color }}>
                          <Route size={18} />
                        </span>
                        <div className={styles.rowText}>
                          <div className={styles.rowName}>{seg.name || '(unnamed)'}</div>
                          {seg.description && <div className={styles.rowSub}>{seg.description}</div>}
                        </div>
                      </div>
                    </td>
                    <td className={styles.hideNarrower}>
                      <span className={styles.badge} style={badge}>
                        {seg.category || 'route'}
                      </span>
                    </td>
                    <td className={styles.num}>{((seg.distance || 0) / 1000).toFixed(2)} km</td>
                    <td className={`${styles.hideNarrow} ${styles.num}`}>{(seg.waypoints || []).length}</td>
                    <td className={styles.hideNarrow}>
                      {photos > 0 ? (
                        <span className={styles.photoCell}>
                          <Camera size={14} /> {photos}
                        </span>
                      ) : (
                        <span className={`${styles.photoCell} ${styles.photoNone}`}>None</span>
                      )}
                    </td>
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
          {!loading && visible.length === 0 && <div className={styles.empty}>{search ? 'No routes match that search.' : 'No routes saved yet.'}</div>}
        </div>
      </div>
    </section>
  );
}
