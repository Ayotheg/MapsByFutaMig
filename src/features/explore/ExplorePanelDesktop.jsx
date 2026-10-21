import { useMemo, useState } from 'react';
import { ChevronDown, CirclePlus } from 'lucide-react';
import { GROUP_META, groupOfType } from '../legend/placeTypeGroups';
import { haversine } from '../../lib/geoUtils';
import { CategorySegment, FeaturedRail, ListRow, SectionHeader, featuredTitle, moreTitle, splitFeatured } from './ExploreSections';
import { comparePicks } from './useExplorePicks';
import styles from './ExplorePanelDesktop.module.css';

// Rough campus walking pace — same constant ExploreSections.jsx uses for
// its "N min walk" label.
const WALK_METERS_PER_MIN = 80;

const SORT_OPTIONS = [
  { key: 'featured', label: 'Featured' },
  { key: 'nearest', label: 'Nearest First', needsLocation: true },
  { key: 'rating', label: 'Top Rated' },
];

/**
 * Desktop sidebar Explore panel, rebuilt to the Explore redesign
 * (public/Maps By FUTA — explore Redesign-png.zip, desktop frame).
 * Rendered by `ExplorePanel.jsx` only when `variant === 'full' && desktop`.
 *
 * Behaviour is unchanged from the previous version: Places/People/
 * Channels, the place-group filter chips, the Featured/Nearest/Top Rated
 * sort, Suggest a Place and the promote link. The cards themselves are
 * the shared ones in ExploreSections.jsx.
 */
export default function ExplorePanelDesktop({ picks, userCoords, onSelect, onSuggestPlace, category = 'places', onCategoryChange, rotatingFeatured }) {
  const [activeGroup, setActiveGroup] = useState(null); // null = "All Spots"
  const [sortMode, setSortMode] = useState('featured');
  const [sortOpen, setSortOpen] = useState(false);

  const withDistance = useMemo(
    () =>
      picks.map((p) => {
        const meters =
          userCoords && p.lat != null && p.lng != null ? haversine(userCoords.lat, userCoords.lng, p.lat, p.lng) : null;
        return { ...p, distanceMeters: meters, distanceMins: meters != null ? Math.max(1, Math.round(meters / WALK_METERS_PER_MIN)) : null };
      }),
    [picks, userCoords]
  );

  // Real per-category counts, driven by the same group taxonomy the
  // Layers panel already filters by (`placeTypeGroups.js`) — not a
  // fabricated "Laundry/Food/Repairs" set that doesn't exist as a real
  // filter anywhere else in the app.
  const groupCounts = useMemo(() => {
    const counts = {};
    for (const p of withDistance) {
      const g = groupOfType(p.type);
      if (!g) continue;
      counts[g] = (counts[g] || 0) + 1;
    }
    return counts;
  }, [withDistance]);
  const availableGroups = useMemo(() => GROUP_META.filter((g) => groupCounts[g.key] > 0), [groupCounts]);

  const filtered = useMemo(
    () => (activeGroup ? withDistance.filter((p) => groupOfType(p.type) === activeGroup) : withDistance),
    [withDistance, activeGroup]
  );

  const sorted = useMemo(() => {
    const list = [...filtered];
    if (sortMode === 'nearest' && userCoords) {
      return list.sort((a, b) => {
        if (a.distanceMeters == null) return 1;
        if (b.distanceMeters == null) return -1;
        return a.distanceMeters - b.distanceMeters;
      });
    }
    if (sortMode === 'rating') {
      return list.sort((a, b) => (b.avgRating ?? -1) - (a.avgRating ?? -1) || (b.reviewCount ?? 0) - (a.reviewCount ?? 0));
    }
    // "featured" — same ordering ExplorePanel uses (comparePicks): paid
    // ads first by days paid, then whoever paid first; then organic picks.
    return list.sort(comparePicks);
  }, [filtered, sortMode, userCoords]);

  const availableSortOptions = SORT_OPTIONS.filter((o) => !o.needsLocation || userCoords);
  const currentSortLabel = availableSortOptions.find((o) => o.key === sortMode)?.label || 'Featured';

  // People/Channels have no place type and no sort control, so a group
  // filter or sort picked on Places would empty or reshape their list with
  // no way to undo it there. Start each category from a clean slate.
  function handleCategoryChange(next) {
    if (next === category) return;
    setActiveGroup(null);
    setSortMode('featured');
    setSortOpen(false);
    onCategoryChange?.(next);
  }

  function handleSortSelect(key) {
    setSortMode(key);
    setSortOpen(false);
  }

  // Featured rail + list only makes sense in the default ordering; the
  // other sorts show one plain list under the sort's own name so the order
  // the person picked is exactly what they read.
  // ("Nearest First" with no location yet falls back to the featured order.)
  const isFeaturedOrder = !availableSortOptions.some((o) => o.key === sortMode && o.key !== 'featured');
  // People/Channels with more picks than slots get the same rotating rail
  // as mobile (`rotatingFeatured`, from ExplorePanel); the list below then
  // carries every organic pick.
  const { featured, rest } = !isFeaturedOrder
    ? { featured: [], rest: sorted }
    : rotatingFeatured && category !== 'places'
    ? {
        featured: rotatingFeatured,
        // Every pick not pinned in the rail: extra promoted ones + all organic.
        rest: sorted.filter((p) => !p.isPromoted || !rotatingFeatured.some((f) => f.id === p.id)),
      }
    : splitFeatured(sorted);
  const restTitle = isFeaturedOrder ? moreTitle(category) : currentSortLabel;
  const noun = NOUNS[category] || NOUNS.places;

  function renderRow(pick) {
    // Only admin-curated picks (explicitly ticked "Feature this place in
    // Explore" in AdminEditModal) get the verified mark — the
    // auto-generated top-rated fallback list (`isFallback`, see
    // useExplorePicks.js) hasn't actually been reviewed by anyone, so it
    // doesn't earn the same claim.
    return (
      <ListRow
        key={pick.id}
        pick={pick}
        size="sm"
        verified={!pick.isFallback}
        channelSource="explore_desktop_card"
        onSelect={onSelect}
      />
    );
  }

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div>
          <h2 className={styles.headTitle}>Explore</h2>
          <p className={styles.headSubtitle}>Campus spots, people and updates.</p>
        </div>

        {/* PLACES / PEOPLE / CHANNELS (supabase/people_entries.sql,
            supabase/channel_entries.sql). */}
        <CategorySegment category={category} onChange={handleCategoryChange} size="sm" />

        {availableGroups.length > 0 && (
          <div className={styles.chipRow}>
            <button
              type="button"
              className={`${styles.chip} ${activeGroup === null ? styles.chipActive : ''}`}
              onClick={() => setActiveGroup(null)}
            >
              All spots
            </button>
            {availableGroups.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`${styles.chip} ${activeGroup === g.key ? styles.chipActive : ''}`}
                onClick={() => setActiveGroup(g.key)}
              >
                {g.name}
              </button>
            ))}
          </div>
        )}

        <div className={styles.controlsRow}>
          <span className={styles.count}>
            {sorted.length} {sorted.length === 1 ? noun[0] : noun[1]}
          </span>
          {category === 'places' && (
            <div className={styles.sortWrap}>
              <button type="button" className={styles.sortBtn} onClick={() => setSortOpen((v) => !v)}>
                Sort: {currentSortLabel} <ChevronDown size={13} />
              </button>
              {sortOpen && (
                <div className={styles.sortMenu}>
                  {availableSortOptions.map((o) => (
                    <button
                      key={o.key}
                      type="button"
                      className={`${styles.sortMenuItem} ${sortMode === o.key ? styles.sortMenuItemActive : ''}`}
                      onClick={() => handleSortSelect(o.key)}
                    >
                      {o.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className={styles.list}>
        {sorted.length === 0 && (
          <div className={styles.noResults}>
            {category === 'people'
              ? 'No people featured yet.'
              : category === 'channels'
              ? 'No channels featured yet.'
              : 'No spots in this category yet — try "All spots".'}
          </div>
        )}
        {featured.length > 0 && (
          <section className={styles.section}>
            <SectionHeader title={featuredTitle(category)} size="sm" />
            <FeaturedRail
              picks={featured}
              size="sm"
              channelSource="explore_desktop_card"
              promoteSource={category === 'places' ? 'explore_desktop' : null}
              onSelect={onSelect}
            />
          </section>
        )}
        {rest.length > 0 && (
          <section className={styles.section}>
            <SectionHeader title={restTitle} size="sm" />
            <div className={category === 'places' ? styles.rows : styles.cardRows}>{rest.map(renderRow)}</div>
          </section>
        )}
      </div>

      {onSuggestPlace && (
        <div className={styles.footer}>
          <CirclePlus size={16} className={styles.footerIcon} aria-hidden="true" />
          Missing a place?
          <button type="button" className={styles.footerAction} onClick={onSuggestPlace}>
            Suggest it
          </button>
        </div>
      )}
    </div>
  );
}

const NOUNS = {
  places: ['place', 'places'],
  people: ['person', 'people'],
  channels: ['channel', 'channels'],
};
