import { useState } from 'react';
import { Route, Camera, ChevronRight, Search } from 'lucide-react';
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
          <span className={styles.countBadgeDot} />
          {filtered.length} <span className={styles.countBadgeMuted}>of {segments.length} routes</span>
        </div>
        <div className={styles.searchWrap}>
          <span className={styles.searchIcon}>
            <Search size={16} />
          </span>
          <input
            type="text"
            className={styles.searchInput}
            placeholder="Search routes…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>
      <div className={styles.list}>
        {filtered.length === 0 && <div className={styles.empty}>No segments found.</div>}
        {filtered.map((seg) => {
          const photoCount = seg.imageUrls?.length || 0;
          const badge = badgeStyleFor('road');
          return (
            <div key={seg.id} className={styles.item} onClick={() => onEditSegment(seg)}>
              <div className={styles.itemIcon} style={{ background: badge.background, borderColor: badge.borderColor, color: badge.color }}>
                <Route size={16} />
              </div>
              <div className={styles.itemBody}>
                <div className={styles.itemTopRow}>
                  <div className={styles.itemNameGroup}>
                    <div className={styles.itemName}>{seg.name || '(unnamed)'}</div>
                    {photoCount > 0 && (
                      <span className={styles.itemPhotoBadge}>
                        <Camera size={10} /> {photoCount}
                      </span>
                    )}
                  </div>
                  <span className={styles.itemBadge} style={badge}>
                    {seg.category || 'route'}
                  </span>
                </div>
                <div className={styles.itemDesc}>
                  {((seg.distance || 0) / 1000).toFixed(2)} km · {(seg.waypoints || []).length} waypoints
                </div>
              </div>
              <span className={styles.itemChevron}>
                <ChevronRight size={16} />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
