import { MapPin } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import styles from './SearchResultItem.module.css';

/**
 * One row in a search-suggestion dropdown/list. Ported from legacy's
 * `.sd-item` markup, built identically 3 times in vanilla JS
 * (`renderDropdown`'s `addItem`, `deskRender`'s `addItem`, the mobile
 * overlay's `ovRender`'s `addItem` — app.js ~676–691, ~929–947,
 * ~5860–5877). One shared component here instead, used by
 * DesktopSearchBar's dropdown and MobileSearchOverlay's list.
 */
export default function SearchResultItem({ entry, query, icon, highlight, onSelect, active, showBadge = true }) {
  const badgeClass = entry.source === 'segment' ? styles.badgeSeg : entry.subtype === 'osm' ? styles.badgeOsm : '';
  const badgeLabel = entry.source === 'segment' ? 'Route' : entry.subtype === 'osm' ? 'OSM' : entry.subtype || entry.type || 'Pin';
  const Icon = LEGACY_ICON_MAP[icon(entry)] || MapPin;

  return (
    <div
      className={`${styles.item} ${active ? styles.active : ''}`}
      onMouseDown={(e) => {
        e.preventDefault();
        onSelect(entry);
      }}
    >
      <div className={styles.icon}>
        <Icon size={16} />
      </div>
      <div className={styles.body}>
        <div className={styles.name} dangerouslySetInnerHTML={{ __html: highlight(entry.name, query) }} />
        {(entry.desc || entry.sub) && <div className={styles.sub}>{entry.desc || entry.sub}</div>}
      </div>
      {showBadge && <div className={`${styles.badge} ${badgeClass}`}>{String(badgeLabel).toUpperCase()}</div>}
    </div>
  );
}
