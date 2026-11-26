import { useEffect, useRef } from 'react';
import { ChevronRight, Clock, Globe, Loader2, MapPin } from 'lucide-react';
import { LEGACY_ICON_MAP } from '../../lib/legacyIconMap';
import { chipIconKey } from '../shared/placeCategories';
import SearchResultItem from './SearchResultItem';
import styles from './SearchResultItem.module.css';

function CategoryJumpRow({ chip, active, onSelect }) {
  const rowRef = useRef(null);
  const Icon = LEGACY_ICON_MAP[chipIconKey(chip)] || MapPin;

  useEffect(() => {
    if (active) rowRef.current?.scrollIntoView({ block: 'nearest' });
  }, [active]);

  return (
    <button
      ref={rowRef}
      type="button"
      className={`${styles.categoryRow} ${active ? styles.active : ''}`}
      onMouseDown={(e) => e.preventDefault()}
      onClick={() => onSelect(chip)}
    >
      <span className={styles.categoryIcon}>
        <Icon size={18} />
      </span>
      <span className={styles.body}>
        <div className={styles.categoryTitle}>See all {chip.label}</div>
        <div className={styles.categorySub}>Sorted by distance</div>
      </span>
      <ChevronRight size={16} className={styles.categoryArrow} />
    </button>
  );
}

/**
 * Shared "On This Map" / "OpenStreetMap" / "Recent" / category-jump results
 * list used by DesktopSearchBar's dropdown and MobileSearchOverlay's list.
 */
export default function SearchDropdownList({
  localResults,
  osmResults,
  query,
  loading,
  icon,
  highlight,
  onSelect,
  activeIdx = -1,
  showBadge = true,
  matchedChip = null,
  onSelectChip,
  recentSearches = [],
  onRemoveRecent,
  onClearRecent,
  searchError = null,
  emptyMessage = null,
}) {
  const trimmed = (query || '').trim();
  const hasLocal = localResults && localResults.length > 0;
  const hasOsm = osmResults && osmResults.length > 0;

  if (!trimmed) {
    if (recentSearches.length > 0) {
      return (
        <>
          <div className={styles.recentHeader}>
            <div className={styles.sectionLabel}>
              <Clock size={14} /> Recent
            </div>
            {onClearRecent && (
              <button
                type="button"
                className={styles.clearRecentBtn}
                onMouseDown={(e) => e.preventDefault()}
                onClick={onClearRecent}
              >
                Clear
              </button>
            )}
          </div>
          {recentSearches.map((r, i) => (
            <SearchResultItem
              key={`recent-${r.id || r.name}-${i}`}
              entry={r}
              query=""
              icon={icon}
              highlight={highlight}
              onSelect={onSelect}
              active={activeIdx === i}
              showBadge={showBadge}
              isRecent
              onRemove={onRemoveRecent}
            />
          ))}
        </>
      );
    }
    return <div className={styles.emptyHint}>Try a building, hostel, ATM, or acronym like SEET</div>;
  }

  let idx = -1;

  return (
    <>
      {searchError && <div className={styles.errorBanner}>{searchError}</div>}

      {matchedChip && onSelectChip && (() => {
        idx += 1;
        return (
          <CategoryJumpRow
            chip={matchedChip}
            active={activeIdx === idx}
            onSelect={onSelectChip}
          />
        );
      })()}

      {hasLocal && (
        <>
          <div className={styles.sectionLabel}>
            <MapPin size={14} /> On This Map
          </div>
          {localResults.map((r) => {
            idx += 1;
            return (
              <SearchResultItem
                key={`local-${r.id || r.name}-${idx}`}
                entry={r}
                query={query}
                icon={icon}
                highlight={highlight}
                onSelect={onSelect}
                active={activeIdx === idx}
                showBadge={showBadge}
              />
            );
          })}
        </>
      )}

      {loading && (
        <div className={styles.spinner}>
          <Loader2 size={12} className={styles.spin} /> Searching OSM…
        </div>
      )}

      {hasOsm && (
        <>
          <div className={styles.sectionLabel}>
            <Globe size={14} /> OpenStreetMap
          </div>
          {osmResults.map((r) => {
            idx += 1;
            return (
              <SearchResultItem
                key={`osm-${r.name}-${idx}`}
                entry={{ ...r, type: 'osm', subtype: 'osm' }}
                query={query}
                icon={icon}
                highlight={highlight}
                onSelect={onSelect}
                active={activeIdx === idx}
                showBadge={showBadge}
              />
            );
          })}
        </>
      )}

      {!hasLocal && !loading && !hasOsm && !matchedChip && !searchError && (
        <div className={styles.empty}>
          {emptyMessage || (trimmed.length >= 2 ? `No results for "${trimmed}"` : 'Type to search…')}
        </div>
      )}
    </>
  );
}
