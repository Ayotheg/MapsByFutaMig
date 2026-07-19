import { useState } from 'react';
import styles from './AdminPanel.module.css';
import { badgeStyleFor } from './adminBadgeColors';

/** Legacy: `renderSegmentList` (app.js ~3773–3800). No "add" affordance —
 * legacy never gave this tab one either (segments are only ever created
 * via the KML import pipeline, not from inside the admin panel). */
export default function RoutesTab({ segments, onEditSegment }) {
  const [search, setSearch] = useState('');
  const filter = search.toLowerCase();
  const filtered = segments.filter(
    (s) => !filter || s.name?.toLowerCase().includes(filter) || s.description?.toLowerCase().includes(filter)
  );

  return (
    <div className={styles.tabContent}>
      <div className={styles.toolbar}>
        <div className={styles.countBadge}>
          {filtered.length} of {segments.length} routes
        </div>
        <input
          type="text"
          className={styles.searchInput}
          placeholder="Search routes…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>
      <div className={styles.list}>
        {filtered.length === 0 && <div className={styles.empty}>No segments found.</div>}
        {filtered.map((seg) => {
          const photoCount = seg.imageUrls?.length || 0;
          return (
            <div key={seg.id} className={styles.item} onClick={() => onEditSegment(seg)}>
              <div className={styles.itemIcon}>🛣</div>
              <div className={styles.itemBody}>
                <div className={styles.itemName}>{seg.name || '(unnamed)'}</div>
                <div className={styles.itemMeta}>
                  {seg.category || 'route'} · {((seg.distance || 0) / 1000).toFixed(2)} km · {(seg.waypoints || []).length}{' '}
                  waypoints
                </div>
              </div>
              {photoCount > 0 && <span className={styles.itemPhotoBadge}>📷 {photoCount}</span>}
              <span className={styles.itemBadge} style={badgeStyleFor('road')}>
                {seg.category || 'route'}
              </span>
              <span className={styles.itemChevron}>›</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
