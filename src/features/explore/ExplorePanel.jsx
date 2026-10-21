import { useEffect, useMemo, useState } from 'react';
import { comparePicks } from './useExplorePicks';
import { CategorySegment, FeaturedRail, PlaceRow, SectionHeader, moreTitle, splitFeatured } from './ExploreSections';
import ExploreChannelLink from './ExploreChannelLink';
import ExplorePanelDesktop from './ExplorePanelDesktop';
import { useOneShotLocation } from './useOneShotLocation';
import styles from './ExplorePanel.module.css';

// How often the compact preview swings to the next pair of organic picks.
// Long enough to actually read a card, short enough that the section
// feels alive rather than static — matches the "casual/fun, changes with
// interval" behavior the person asked for.
const ROTATE_MS = 7000;
const COMPACT_SLOTS = 2;

function emptyLabel(category) {
  if (category === 'people') return 'No people featured yet.';
  if (category === 'channels') return 'No channels featured yet.';
  return 'No places featured yet.';
}

/**
 * Explore — admin-curated (or auto-generated) popular-places section.
 * Two variants, both fed by the same `picks` (from `useExplorePicks`):
 *
 *  - `variant="compact"` (mobile, sheetState === 'half'): "Explore
 *    Campus" header + a short "View All" link + a couple of cards that
 *    rotate every ROTATE_MS. A promoted pick, if any, stays pinned in
 *    the first slot — it's an ad slot, it shouldn't play a game of
 *    chance with visibility — while the second slot cycles through the
 *    organic pool. With no promotion active this is just two friendly
 *    places rotating, exactly as the person described.
 *  - `variant="full"` (mobile sheetState === 'full', and always on
 *    desktop's sidebar panel): every active pick, promoted first, in a
 *    stable scrollable list — no rotation once someone's actually
 *    reading the whole thing.
 */
export default function ExplorePanel({ picks, loading, variant = 'compact', onViewAll, onSelect, desktop, onSuggestPlace }) {
  const userCoords = useOneShotLocation(true);

  // PLACES / PEOPLE / CHANNELS pill (supabase/people_entries.sql,
  // supabase/channel_entries.sql) — same `picks` array, just split by
  // `isPerson`/`isChannel`. Defaults to Places so every existing flow
  // (rotation, "View All", the desktop panel below) behaves exactly as
  // before until someone actually taps one of the new pills.
  const [category, setCategory] = useState('places');
  const categorizedPicks = useMemo(
    () =>
      picks.filter((p) => {
        if (category === 'people') return p.isPerson;
        if (category === 'channels') return p.isChannel;
        return !p.isPerson && !p.isChannel;
      }),
    [picks, category]
  );
  const promoted = useMemo(
    () => categorizedPicks.filter((p) => p.isPromoted).sort(comparePicks),
    [categorizedPicks]
  );
  const organic = useMemo(
    () => categorizedPicks.filter((p) => !p.isPromoted).sort(comparePicks),
    [categorizedPicks]
  );

  const [rotationIndex, setRotationIndex] = useState(0);
  const rotatingPool = promoted.length ? organic : organic; // organic pool always rotates; promoted just stays pinned
  const rotateStep = promoted.length ? 1 : COMPACT_SLOTS;

  useEffect(() => {
    if (variant !== 'compact' || rotatingPool.length <= (promoted.length ? 1 : COMPACT_SLOTS)) return undefined;
    const id = setInterval(() => {
      setRotationIndex((i) => i + rotateStep);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [variant, rotatingPool.length, rotateStep, promoted.length]);

  const compactItems = useMemo(() => {
    if (!rotatingPool.length) return promoted.slice(0, COMPACT_SLOTS);
    const need = promoted.length ? COMPACT_SLOTS - 1 : COMPACT_SLOTS;
    const items = [];
    for (let i = 0; i < need; i++) {
      items.push(rotatingPool[(rotationIndex + i) % rotatingPool.length]);
    }
    return promoted.length ? [promoted[0], ...items] : items;
  }, [promoted, rotatingPool, rotationIndex]);

  const fullItems = useMemo(() => [...promoted, ...organic], [promoted, organic]);

  if (loading && !picks.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>Loading places to explore…</div>
      </div>
    );
  }

  if (!picks.length) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>Nothing to explore yet — check back soon.</div>
      </div>
    );
  }

  // Desktop-only redesign (Figma node 111:57) — a completely separate
  // component/CSS file, so the mobile "full" sheet just below (and the
  // "compact" preview above) render exactly as before. `desktop` is
  // only ever passed `true` by Sidebar.jsx; MobileSheet.jsx never sets
  // it, so this branch is unreachable from mobile.
  if (variant === 'full' && desktop) {
    return (
      <ExplorePanelDesktop
        picks={fullItems}
        userCoords={userCoords}
        onSelect={onSelect}
        onSuggestPlace={onSuggestPlace}
        category={category}
        onCategoryChange={setCategory}
      />
    );
  }

  const header = (
    <div className={styles.header}>
      <h2 className={styles.title}>Explore</h2>
      <p className={styles.subtitle}>Campus spots, people and updates.</p>
    </div>
  );

  if (variant === 'full') {
    const { featured, rest } = splitFeatured(fullItems);
    return (
      <div className={styles.panel}>
        {header}
        <CategorySegment category={category} onChange={setCategory} />
        {fullItems.length === 0 && <div className={styles.empty}>{emptyLabel(category)}</div>}
        {featured.length > 0 && (
          <section className={styles.section}>
            <SectionHeader title="Featured" />
            <FeaturedRail picks={featured} channelSource="explore_card" onSelect={onSelect} />
          </section>
        )}
        {rest.length > 0 && (
          <section className={styles.section}>
            <SectionHeader title={moreTitle(category)} />
            <div className={styles.list}>
              {rest.map((pick) => (
                <PlaceRow key={pick.id} pick={pick} userCoords={userCoords} channelSource="explore_card" onSelect={onSelect} />
              ))}
            </div>
          </section>
        )}
        <ExploreChannelLink source="explore_mobile" />
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      {header}
      <CategorySegment category={category} onChange={setCategory} />
      <section className={styles.section}>
        <SectionHeader title="Featured" onSeeAll={onViewAll} />
        {compactItems.length === 0 ? (
          <div className={styles.empty}>{emptyLabel(category)}</div>
        ) : (
          <FeaturedRail picks={compactItems} channelSource="explore_card" onSelect={onSelect} />
        )}
      </section>
      {/* Below the cards (not above) so that on a short phone, where the
          half-height sheet has little spare room, the cards stay intact
          and this line is what scrolls out of view — the sheet panel is
          overflow-y: auto. */}
      <ExploreChannelLink source="explore_mobile" />
    </div>
  );
}
