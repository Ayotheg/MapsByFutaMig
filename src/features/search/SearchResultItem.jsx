import { useEffect, useRef } from 'react';
import { Clock, MapPin, X } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import { WP_TYPE_LABELS } from '../waypoints/wpTypeMeta';
import { fmtMeters } from './chipConfig';
import styles from './SearchResultItem.module.css';

function formatBadgeLabel(entry) {
  if (entry.source === 'segment') return 'Route';
  if (entry.source === 'coord' || entry.type === 'coord') return 'Coords';
  if (entry.source === 'business' || entry.isBusiness) return 'Online Store';
  if (entry.subtype === 'osm' || entry.source === 'osm') return 'OSM';
  const raw = entry.subtype || entry.type || '';
  return WP_TYPE_LABELS[raw] || WP_TYPE_LABELS[entry.type] || (raw ? String(raw).replace(/_/g, ' ') : 'Pin');
}

function buildSubParts(entry) {
  const area = (entry.area || '').trim();
  const rawDesc = (entry.desc || entry.sub || '').trim();
  const distLabel = entry._dist != null && Number.isFinite(entry._dist) ? fmtMeters(entry._dist) : null;
  const showArea = Boolean(area) && !rawDesc.toLowerCase().startsWith(area.toLowerCase());
  return { area: showArea ? area : '', distLabel, desc: rawDesc };
}

/**
 * One row in a search-suggestion dropdown/list. Shared by DesktopSearchBar,
 * MobileSearchOverlay, and PromotePage's WaypointSearchPanel.
 */
export default function SearchResultItem({
  entry,
  query,
  icon,
  highlight,
  onSelect,
  active,
  showBadge = true,
  isRecent = false,
  onRemove,
}) {
  const rowRef = useRef(null);
  const badgeClass = entry.source === 'segment' ? styles.badgeSeg : entry.subtype === 'osm' ? styles.badgeOsm : '';
  const badgeLabel = formatBadgeLabel(entry);
  const Icon = isRecent ? Clock : LEGACY_ICON_MAP[icon(entry)] || MapPin;
  const { area, distLabel, desc } = buildSubParts(entry);
  const hasSub = Boolean(area || distLabel || desc);

  useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <div
      ref={rowRef}
      className={`${styles.item} ${active ? styles.active : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(entry)}
    >
      <div className={styles.icon}>
        <Icon size={20} />
      </div>
      <div className={styles.body}>
        <div className={styles.name} dangerouslySetInnerHTML={{ __html: highlight(entry.name, query) }} />
        {hasSub && (
          <div className={styles.sub}>
            {area && <span>{area}</span>}
            {area && (distLabel || desc) && <span aria-hidden="true"> · </span>}
            {distLabel && <span className={styles.dist}>{distLabel}</span>}
            {distLabel && desc && <span aria-hidden="true"> · </span>}
            {desc && <span>{desc}</span>}
          </div>
        )}
      </div>
      {showBadge && <div className={`${styles.badge} ${badgeClass}`}>{String(badgeLabel).toUpperCase()}</div>}
      {onRemove && (
        <button
          type="button"
          className={styles.removeBtn}
          aria-label={`Remove ${entry.name}`}
          onMouseDown={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onClick={(e) => {
            e.stopPropagation();
            onRemove(entry);
          }}
        >
          <X size={14} />
        </button>
      )}
    </div>
  );
}
