import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import ExploreCard from './ExploreCard';
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

  // PLACES / PEOPLE pill (supabase/people_entries.sql) — same `picks`
  // array, just split by `isPerson`. Defaults to Places so every existing
  // flow (rotation, "View All", the desktop panel below) behaves exactly
  // as before until someone actually taps the new pill.
  const [category, setCategory] = useState('places');
  const categorizedPicks = useMemo(
    () => picks.filter((p) => (category === 'people' ? p.isPerson : !p.isPerson)),
    [picks, category]
  );
  const peopleCount = useMemo(() => picks.filter((p) => p.isPerson).length, [picks]);

  const promoted = useMemo(
    () => categorizedPicks.filter((p) => p.isPromoted).sort((a, b) => b.priority - a.priority),
    [categorizedPicks]
  );
  const organic = useMemo(
    () => categorizedPicks.filter((p) => !p.isPromoted).sort((a, b) => b.priority - a.priority),
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
        peopleCount={peopleCount}
      />
    );
  }

  if (variant === 'full') {
    return (
      <div className={styles.panel}>
        <div className={styles.headerFull}>
          <div className={styles.title}>Explore Campus</div>
          <div className={styles.subtitle}>Discover locations around you</div>
        </div>
        <CategoryPills category={category} onChange={setCategory} peopleCount={peopleCount} />
        <div className={styles.grid}>
          {fullItems.length === 0 && (
            <div className={styles.empty}>
              {category === 'people' ? 'No people featured yet.' : 'No places featured yet.'}
            </div>
          )}
          {fullItems.map((pick) => (
            <ExploreCard key={pick.id} pick={pick} userCoords={userCoords} onSelect={onSelect} />
          ))}
        </div>
        <ExploreChannelLink source="explore_mobile" />
      </div>
    );
  }

  return (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div>
          <div className={styles.title}>Explore Campus</div>
          <div className={styles.subtitle}>Discover locations around you</div>
        </div>
        <button type="button" className={styles.viewAll} onClick={onViewAll}>
          View All <ChevronRight size={13} />
        </button>
      </div>
      <CategoryPills category={category} onChange={setCategory} peopleCount={peopleCount} />
      <div className={styles.grid}>
        {compactItems.length === 0 && (
          <div className={styles.empty}>{category === 'people' ? 'No people featured yet.' : 'No places featured yet.'}</div>
        )}
        {compactItems.map((pick) => (
          <ExploreCard key={pick.id} pick={pick} userCoords={userCoords} onSelect={onSelect} />
        ))}
      </div>
      {/* Below the cards (not above) so that on a short phone, where the
          half-height sheet has little spare room, the cards stay intact
          and this line is what scrolls out of view — the sheet panel is
          overflow-y: auto. */}
      <ExploreChannelLink source="explore_mobile" />
    </div>
  );
}

/**
 * PLACES / PEOPLE pill switcher (supabase/people_entries.sql). People
 * only shows a count once there's at least one featured/fallback person
 * pick, same restraint the rest of this panel already uses (empty
 * sections say so in words instead of showing a "0").
 */
function CategoryPills({ category, onChange, peopleCount }) {
  return (
    <div className={styles.categoryTabs}>
      <button
        type="button"
        className={`${styles.categoryTab} ${category === 'places' ? styles.categoryTabActive : ''}`}
        onClick={() => onChange('places')}
      >
        Places
      </button>
      <button
        type="button"
        className={`${styles.categoryTab} ${category === 'people' ? styles.categoryTabActive : ''}`}
        onClick={() => onChange('people')}
      >
        People{peopleCount > 0 ? ` (${peopleCount})` : ''}
      </button>
    </div>
  );
}
