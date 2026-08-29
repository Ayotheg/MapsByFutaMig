import { useEffect, useMemo, useState } from 'react';
import { ChevronRight } from 'lucide-react';
import ExploreCard from './ExploreCard';
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
export default function ExplorePanel({ picks, loading, variant = 'compact', onViewAll, onSelect }) {
  const userCoords = useOneShotLocation(true);

  const promoted = useMemo(() => picks.filter((p) => p.isPromoted).sort((a, b) => b.priority - a.priority), [picks]);
  const organic = useMemo(() => picks.filter((p) => !p.isPromoted).sort((a, b) => b.priority - a.priority), [picks]);

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

  if (variant === 'full') {
    return (
      <div className={styles.panel}>
        <div className={styles.headerFull}>
          <div className={styles.title}>Explore Campus</div>
          <div className={styles.subtitle}>Discover locations around you</div>
        </div>
        <div className={styles.grid}>
          {fullItems.map((pick) => (
            <ExploreCard key={pick.id} pick={pick} userCoords={userCoords} onSelect={onSelect} />
          ))}
        </div>
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
      <div className={styles.grid}>
        {compactItems.map((pick) => (
          <ExploreCard key={pick.id} pick={pick} userCoords={userCoords} onSelect={onSelect} />
        ))}
      </div>
    </div>
  );
}
