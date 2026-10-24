import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { track } from '../../lib/analytics';
import { CalendarDays, Clock, MapPin, Megaphone, MoveUpRight, Video } from 'lucide-react';
import { SectionHeader } from './ExploreSections';
import {
  EVENT_FILTERS,
  FEATURED_ROTATE_MS,
  FEATURED_SLOTS,
  dayOfMonth,
  monthShort,
  placeLabel,
  priceLabel,
  shortWhen,
} from './eventsData';
import sectionStyles from './ExploreSections.module.css';
import styles from './ExploreEvents.module.css';

/**
 * Explore → Events (public/Maps By FUTA — events-Redesign-png.zip, "Explore
 * · desktop"): the All/Today/This week/Free/Paid chips, the Featured events
 * rail and the Upcoming list. Shared by the mobile sheet and the desktop
 * panel like ExploreSections.jsx; `size="sm"` is the desktop scale.
 */

export function DateBadge({ iso, className }) {
  return (
    <span className={`${styles.dateBadge} ${className || ''}`}>
      <span className={styles.dateMonth}>{monthShort(iso)}</span>
      <span className={styles.dateDay}>{dayOfMonth(iso)}</span>
    </span>
  );
}

export function EventFilterChips({ filter, onChange, size }) {
  return (
    <div className={`${styles.chipRow} ${size === 'sm' ? styles.chipRowSm : ''}`} role="tablist">
      {EVENT_FILTERS.map((f) => (
        <button
          key={f.key}
          type="button"
          role="tab"
          aria-selected={filter === f.key}
          className={`${styles.chip} ${filter === f.key ? styles.chipActive : ''}`}
          onClick={() => onChange?.(f.key)}
        >
          {f.label}
        </button>
      ))}
    </div>
  );
}

function PlaceLine({ event, className }) {
  const Icon = event.online ? Video : MapPin;
  const label = placeLabel(event);
  if (!label) return null;
  return (
    <span className={className}>
      <Icon size={14} aria-hidden="true" />
      <span className={styles.ellipsis}>{label}</span>
    </span>
  );
}

// A <div role="button">, not a <button>: iOS WebKit doesn't lay out a
// <button> as a flex column with positioned children reliably, so the
// poster collapsed to a sliver and the price tag slid over the date (same
// fix as PersonFeaturedCard in ExploreSections.jsx).
function FeaturedEventCard({ event, onSelect }) {
  const open = () => onSelect?.(event);
  return (
    <div
      role="button"
      tabIndex={0}
      className={styles.card}
      onClick={open}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          open();
        }
      }}
    >
      <span className={styles.poster}>
        <CalendarDays className={styles.posterIcon} size={36} strokeWidth={1.5} aria-hidden="true" />
        {event.poster && <img className={styles.posterImg} src={event.poster} alt="" decoding="async" />}
        <DateBadge iso={event.startsAt} className={styles.cardDate} />
        <span className={`${styles.priceTag} ${event.price ? '' : styles.priceTagFree}`}>{priceLabel(event)}</span>
      </span>
      <span className={styles.cardBody}>
        <span className={styles.cardTitle}>{event.title}</span>
        <span className={styles.cardLine}>
          <Clock size={14} aria-hidden="true" />
          {shortWhen(event.startsAt)}
        </span>
        <PlaceLine event={event} className={styles.cardLine} />
      </span>
    </div>
  );
}

// Last card in the rail, same look and tracking as the Places rail's "Get
// your spot featured" card (ExplorePromoteCard.jsx). Opens /event.
function AddEventCard({ size }) {
  const sm = size === 'sm';
  return (
    <Link
      to="/event"
      className={`${sectionStyles.promoteCard} ${sm ? sectionStyles.promoteCardSm : ''} ${styles.addCard}`}
      onClick={() => track('add_event_click', { source: sm ? 'explore_desktop' : 'explore_mobile' })}
    >
      <span className={sectionStyles.promoteIcon}>
        <Megaphone size={sm ? 16 : 20} strokeWidth={2} aria-hidden="true" />
      </span>
      <span className={sectionStyles.promoteText}>
        <span className={sectionStyles.promoteTitle}>Add your event</span>
        <span className={styles.addNote}>Free events are listed free.</span>
        <span className={`${sectionStyles.promotePrice} ${styles.addAction}`}>
          Get started
          <MoveUpRight size={13} aria-hidden="true" />
        </span>
      </span>
    </Link>
  );
}

function EventRow({ event, onSelect }) {
  return (
    <button type="button" className={styles.row} onClick={() => onSelect?.(event)}>
      <DateBadge iso={event.startsAt} className={styles.rowDate} />
      <span className={styles.rowBody}>
        <span className={styles.rowTop}>
          <span className={styles.rowTitle}>{event.title}</span>
          <span className={`${styles.rowPrice} ${event.price ? '' : styles.rowPriceFree}`}>{priceLabel(event)}</span>
        </span>
        <span className={styles.rowWhen}>{shortWhen(event.startsAt)}</span>
        <PlaceLine event={event} className={styles.rowPlace} />
      </span>
    </button>
  );
}

/**
 * `events` is already filtered by the chips. Featured events go in the
 * rail; everything else, soonest first, is "Upcoming". With more featured
 * events than slots the rail rotates like the Places one, and Upcoming
 * then lists every event so none is only visible mid-rotation.
 */
export function EventsList({ events, loading, size, onSelect, onSeeAll, sectionClassName }) {
  const sorted = [...events].sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
  const featured = sorted.filter((e) => e.isFeatured);
  const rotating = featured.length > FEATURED_SLOTS;
  const sm = size === 'sm';

  const [rotationIndex, setRotationIndex] = useState(0);
  useEffect(() => {
    if (!rotating) return undefined;
    const id = setInterval(() => setRotationIndex((i) => i + FEATURED_SLOTS), FEATURED_ROTATE_MS);
    return () => clearInterval(id);
  }, [rotating]);

  const railEvents = rotating
    ? Array.from({ length: FEATURED_SLOTS }, (_, i) => featured[(rotationIndex + i) % featured.length])
    : featured;
  const upcoming = rotating ? sorted : sorted.filter((e) => !e.isFeatured);

  if (loading && !sorted.length) return <div className={styles.empty}>Loading events…</div>;

  return (
    <>
      <section className={sectionClassName}>
        <SectionHeader title="Featured events" size={size} onSeeAll={featured.length ? onSeeAll : undefined} />
        {/* Nothing listed yet: the rail still offers "Add your event". */}
        {!sorted.length && <p className={styles.emptyNote}>No events here yet. Be the first to list one.</p>}
        <div className={`${styles.rail} ${sm ? styles.railSm : ''}`}>
          {/* Keyed by id, so a card swapped in by the rotation fades in. */}
          {railEvents.map((e) => (
            <FeaturedEventCard key={e.id} event={e} onSelect={onSelect} />
          ))}
          <AddEventCard size={size} />
        </div>
      </section>
      {upcoming.length > 0 && (
        <section className={sectionClassName}>
          <SectionHeader title="Upcoming" size={size} onSeeAll={onSeeAll} />
          <div className={`${styles.rows} ${sm ? styles.rowsSm : ''}`}>
            {upcoming.map((e) => (
              <EventRow key={e.id} event={e} onSelect={onSelect} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
