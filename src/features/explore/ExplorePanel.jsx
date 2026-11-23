import { Suspense, lazy, useEffect, useMemo, useState } from 'react';
import { comparePicks } from './useExplorePicks';
import { CategorySegment, FeaturedRail, ListRow, SectionHeader, featuredTitle, moreTitle, splitFeatured } from './ExploreSections';
import { EventFilterChips, EventsList } from './ExploreEvents';
import { filterEvents } from './eventsData';
import { useEvents } from './useEvents';
import { addEventToCalendar, joinOnlineEvent, shareEvent } from './eventActions';
import ExplorePanelDesktop from './ExplorePanelDesktop';
import { useOneShotLocation } from './useOneShotLocation';
import styles from './ExplorePanel.module.css';

const EventCard = lazy(() => import('./EventCard'));

// How often the compact preview swings to the next pair of organic picks.
// Long enough to actually read a card, short enough that the section
// feels alive rather than static — matches the "casual/fun, changes with
// interval" behavior the person asked for.
const ROTATE_MS = 7000;
// The half sheet moves faster: people skim it, then use the pills once
// "See all" is open.
const COMPACT_ROTATE_MS = 5000;
const COMPACT_SLOTS = 2;
// The half-open sheet cycles through the pills, Places first.
const COMPACT_CATEGORIES = ['places', 'people', 'channels', 'events'];

function categoryOf(pick) {
  if (pick.isPerson) return 'people';
  if (pick.isChannel) return 'channels';
  return 'places';
}

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
export default function ExplorePanel({ picks, loading, variant = 'compact', onViewAll, onSelect, onNavigate, desktop, onSuggestPlace }) {
  const userCoords = useOneShotLocation(true);

  // PLACES / PEOPLE / CHANNELS pill (supabase/people_entries.sql,
  // supabase/channel_entries.sql) — same `picks` array, just split by
  // `isPerson`/`isChannel`. Defaults to Places so every existing flow
  // (rotation, "View All", the desktop panel below) behaves exactly as
  // before until someone actually taps one of the new pills.
  const [selectedCategory, setCategory] = useState('places');
  // Events: approved events (supabase/events.sql), fetched once the half
  // sheet (which cycles to them) or the Events tab first shows.
  const { events: allEvents, loading: eventsLoading } = useEvents(
    variant === 'compact' || selectedCategory === 'events'
  );
  // The half-open sheet has no switcher: it opens on Places, then fades
  // through the other categories that have something, one per ROTATE_MS tick.
  const compactCategories = useMemo(
    () =>
      COMPACT_CATEGORIES.filter((c) =>
        c === 'events' ? allEvents.length > 0 : picks.some((p) => categoryOf(p) === c)
      ),
    [picks, allEvents]
  );
  // Which category the half sheet is on, by key (so events or picks
  // arriving mid-cycle don't make it jump), and how many full laps it has
  // made (each lap shows the next picks).
  const [cycle, setCycle] = useState({ key: 'places', lap: 0 });
  // Coming back to the half sheet starts again from Places. Reset during
  // render, not in an effect, so the first frame isn't the old category.
  const [prevVariant, setPrevVariant] = useState(variant);
  if (variant !== prevVariant) {
    setPrevVariant(variant);
    if (variant === 'compact') {
      setCategory('places');
      setCycle({ key: 'places', lap: 0 });
    }
  }
  const compactCategory = compactCategories.includes(cycle.key) ? cycle.key : compactCategories[0] || 'places';
  const category = variant === 'compact' ? compactCategory : selectedCategory;
  const categorizedPicks = useMemo(() => picks.filter((p) => categoryOf(p) === category), [picks, category]);
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

  // Rotates only once there are more picks than Featured slots — in the
  // half-open sheet and in the full view's Featured rail alike, for every
  // category.
  const rotating = rotatingPool.length > (promoted.length ? 1 : COMPACT_SLOTS);

  useEffect(() => {
    if (variant === 'compact' || !rotating) return undefined;
    const id = setInterval(() => {
      setRotationIndex((i) => i + rotateStep);
    }, ROTATE_MS);
    return () => clearInterval(id);
  }, [variant, rotating, rotateStep]);

  // Half sheet: each tick moves to the next category; a category's picks
  // advance once per full lap, so every visit shows a fresh pair. Paused
  // while an event card is open so it isn't swapped out from under it.
  const compactCycles = compactCategories.length > 1;
  const [openEvent, setOpenEvent] = useState(null);
  useEffect(() => {
    if (variant !== 'compact' || openEvent || (!compactCycles && !rotating)) return undefined;
    const id = setInterval(() => {
      setCycle(({ key, lap }) => {
        // A key that dropped out was showing as the first category.
        const i = Math.max(0, compactCategories.indexOf(key));
        const wraps = i + 1 >= compactCategories.length;
        return { key: compactCategories[wraps ? 0 : i + 1] || 'places', lap: wraps ? lap + 1 : lap };
      });
    }, COMPACT_ROTATE_MS);
    return () => clearInterval(id);
  }, [variant, openEvent, compactCycles, rotating, compactCategories]);
  const shownIndex = variant === 'compact' ? (rotating ? cycle.lap * rotateStep : 0) : rotationIndex;

  const compactItems = useMemo(() => {
    if (!rotatingPool.length) return promoted.slice(0, COMPACT_SLOTS);
    // Capped at the pool size so a single pick isn't shown twice.
    const need = Math.min(promoted.length ? COMPACT_SLOTS - 1 : COMPACT_SLOTS, rotatingPool.length);
    const items = [];
    for (let i = 0; i < need; i++) {
      items.push(rotatingPool[(shownIndex + i) % rotatingPool.length]);
    }
    return promoted.length ? [promoted[0], ...items] : items;
  }, [promoted, rotatingPool, shownIndex]);

  const fullItems = useMemo(() => [...promoted, ...organic], [promoted, organic]);

  const [eventFilter, setEventFilter] = useState('all');
  const events = useMemo(() => filterEvents(allEvents, eventFilter), [allEvents, eventFilter]);
  // EventCard's chunk loads on the first tap, then stays mounted so it can
  // slide out on close.
  const [eventCardLoaded, setEventCardLoaded] = useState(false);
  function selectEvent(event) {
    setEventCardLoaded(true);
    setOpenEvent(event);
  }
  const eventCard = eventCardLoaded && (
    <Suspense fallback={null}>
      <EventCard
        event={openEvent}
        isMobile={!desktop}
        onClose={() => setOpenEvent(null)}
        onNavigate={(e) => {
          if (!e.venue || !Number.isFinite(e.venue.lat)) return;
          setOpenEvent(null);
          onNavigate?.({ lat: e.venue.lat, lng: e.venue.lng, name: e.venue.name });
        }}
        onJoinOnline={joinOnlineEvent}
        onAddToCalendar={addEventToCalendar}
        onShare={shareEvent}
      />
    </Suspense>
  );

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
      <>
        <ExplorePanelDesktop
          picks={fullItems}
          userCoords={userCoords}
          onSelect={onSelect}
          onSuggestPlace={onSuggestPlace}
          category={category}
          onCategoryChange={setCategory}
          rotatingFeatured={rotating ? compactItems : null}
          events={events}
          eventsLoading={eventsLoading}
          eventFilter={eventFilter}
          onEventFilterChange={setEventFilter}
          onSelectEvent={selectEvent}
        />
        {eventCard}
      </>
    );
  }

  const header = (
    <div className={styles.header}>
      <h2 className={styles.title}>Explore</h2>
      <p className={styles.subtitle}>Campus spots, people and updates.</p>
    </div>
  );

  if (variant === 'full' && category === 'events') {
    return (
      <div className={styles.panel}>
        {header}
        <CategorySegment category={category} onChange={setCategory} />
        <EventFilterChips filter={eventFilter} onChange={setEventFilter} />
        <EventsList events={events} loading={eventsLoading} sectionClassName={styles.section} onSelect={selectEvent} />
        {eventCard}
      </div>
    );
  }

  if (variant === 'full') {
    // More picks than slots: the rail rotates (pinned promoted pick +
    // cycling organic ones) and the list shows every other pick —
    // remaining promoted ones first, then all organic — so nobody is only
    // ever visible mid-rotation.
    const { featured, rest } = rotating
      ? { featured: compactItems, rest: [...promoted.slice(1), ...organic] }
      : splitFeatured(fullItems);
    return (
      <div className={styles.panel}>
        {header}
        <CategorySegment category={category} onChange={setCategory} />
        {fullItems.length === 0 && <div className={styles.empty}>{emptyLabel(category)}</div>}
        {featured.length > 0 && (
          <section className={styles.section}>
            <SectionHeader title={featuredTitle(category)} />
            <FeaturedRail
              picks={featured}
              channelSource="explore_card"
              promoteSource={category === 'places' ? 'explore_mobile' : null}
              onSelect={onSelect}
            />
          </section>
        )}
        {rest.length > 0 && (
          <section className={styles.section}>
            <SectionHeader title={moreTitle(category)} />
            <div className={category === 'places' ? styles.list : styles.cardList}>
              {rest.map((pick) => (
                <ListRow key={pick.id} pick={pick} userCoords={userCoords} channelSource="explore_card" onSelect={onSelect} />
              ))}
            </div>
          </section>
        )}
      </div>
    );
  }

  // Half-open sheet: just the Featured photos, fading between categories.
  // The switcher only appears once "See all" opens the full sheet, on
  // whichever category was showing.
  const seeAll = () => {
    setCategory(category);
    onViewAll?.();
  };
  if (category === 'events') {
    return (
      <div className={styles.panel}>
        {header}
        <EventsList
          events={allEvents}
          compact
          sectionClassName={`${styles.section} ${styles.fadeIn}`}
          onSelect={selectEvent}
          onSeeAll={seeAll}
        />
        {eventCard}
      </div>
    );
  }
  return (
    <div className={styles.panel}>
      {header}
      <section key={category} className={`${styles.section} ${styles.fadeIn}`}>
        <SectionHeader title={featuredTitle(category)} onSeeAll={seeAll} />
        {compactItems.length === 0 ? (
          <div className={styles.empty}>{emptyLabel(category)}</div>
        ) : (
          <FeaturedRail
            picks={compactItems}
            channelSource="explore_card"
            promoteSource={category === 'places' ? 'explore_mobile' : null}
            onSelect={onSelect}
          />
        )}
      </section>
    </div>
  );
}