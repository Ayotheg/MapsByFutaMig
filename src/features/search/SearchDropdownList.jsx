import { MapPin, Globe, Loader2 } from 'lucide-react';
import SearchResultItem from './SearchResultItem';
import styles from './SearchResultItem.module.css';

/**
 * Shared "On This Map" / "OpenStreetMap" sectioned results list — the body
 * legacy rebuilds identically inside `renderDropdown`/`deskRender`/
 * `ovRender` (app.js ~666–727, ~919–985, ~5850–5899). One component here,
 * used by DesktopSearchBar's dropdown and MobileSearchOverlay's list.
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
}) {
  const hasLocal = localResults && localResults.length > 0;
  const hasOsm = osmResults && osmResults.length > 0;
  let idx = -1;

  return (
    <>
      {hasLocal && (
        <>
          <div className={styles.sectionLabel}>
            <MapPin size={11} /> On This Map
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
            <Globe size={11} /> OpenStreetMap
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

      {!hasLocal && !loading && !hasOsm && (
        <div className={styles.empty}>{query.length >= 2 ? `No results for "${query}"` : 'Type to search…'}</div>
      )}
    </>
  );
}
