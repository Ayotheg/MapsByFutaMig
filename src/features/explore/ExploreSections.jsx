import { BadgeCheck, ChevronRight, Sparkle, Star } from 'lucide-react';
import { getTypeIcon } from '../../lib/typeIcons';
import { dotColor } from '../search/chipConfig';
import { haversine } from '../../lib/geoUtils';
import { channelPlatformMeta } from '../../lib/channelMeta';
import { track } from '../../lib/analytics';
import { useImageStatus } from '../../lib/useImageStatus';
import AvatarBox from './AvatarBox';
import styles from './ExploreSections.module.css';

/**
 * Shared building blocks for the Explore redesign
 * (public/Maps By FUTA — explore Redesign-png.zip): the Places/People/
 * Channels segmented control, section headers, the big photo "Featured"
 * card and the compact "Popular" list row. Used by both ExplorePanel
 * (mobile sheet) and ExplorePanelDesktop (sidebar) so the two can't drift
 * apart visually. Purely presentational — every click still goes through
 * the same `onSelect(pick.waypoint)` / channel-link tracking the old cards
 * used.
 */

// Rough campus walking pace — same constant the old cards used.
const WALK_METERS_PER_MIN = 80;

export const CATEGORIES = [
  { key: 'places', label: 'Places' },
  { key: 'people', label: 'People' },
  { key: 'channels', label: 'Channels' },
];

// With no paid placements, the first few picks fill the Featured rail so
// the section is never empty.
const FEATURED_FALLBACK = 3;

/**
 * Splits an already-ordered list into the "Featured" rail and the list
 * below it, without reordering anything: promoted picks (which every sort
 * the panels use already puts first) go in the rail, or the first few
 * picks when nothing is promoted.
 */
export function splitFeatured(list) {
  const promotedCount = list.filter((p) => p.isPromoted).length;
  const n = promotedCount || Math.min(FEATURED_FALLBACK, list.length);
  return { featured: list.slice(0, n), rest: list.slice(n) };
}

export function moreTitle(category) {
  if (category === 'people') return 'More people';
  if (category === 'channels') return 'More channels';
  return 'Popular on campus';
}

export function walkMins(pick, userCoords) {
  if (pick.distanceMins != null) return pick.distanceMins;
  if (!userCoords || pick.lat == null || pick.lng == null) return null;
  const meters = haversine(userCoords.lat, userCoords.lng, pick.lat, pick.lng);
  return Math.max(1, Math.round(meters / WALK_METERS_PER_MIN));
}

function typeLabel(pick) {
  const t = (pick.type || '').replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Campus spot';
}

function openChannel(pick, source) {
  track('explore_channel_click', { source, platform: pick.channelPlatform });
  if (pick.channelLink) window.open(pick.channelLink, '_blank', 'noopener,noreferrer');
}

export function CategorySegment({ category, onChange, size }) {
  return (
    <div className={`${styles.segment} ${size === 'sm' ? styles.segmentSm : ''}`} role="tablist">
      {CATEGORIES.map((c) => (
        <button
          key={c.key}
          type="button"
          role="tab"
          aria-selected={category === c.key}
          className={`${styles.segmentBtn} ${category === c.key ? styles.segmentBtnActive : ''}`}
          onClick={() => onChange?.(c.key)}
        >
          {c.label}
        </button>
      ))}
    </div>
  );
}

export function SectionHeader({ title, onSeeAll, size }) {
  return (
    <div className={`${styles.sectionHead} ${size === 'sm' ? styles.sectionHeadSm : ''}`}>
      <h3 className={styles.sectionTitle}>{title}</h3>
      {onSeeAll && (
        <button type="button" className={styles.seeAll} onClick={onSeeAll}>
          See all
        </button>
      )}
    </div>
  );
}

function PromoBadge({ pick }) {
  return (
    <span className={styles.promoBadge}>
      <Sparkle size={12} strokeWidth={2} /> {pick.promoLabel || 'Promoted'}
    </span>
  );
}

/** Horizontally-scrolling row of FeaturedCards. */
export function FeaturedRail({ picks, size, channelSource, onSelect }) {
  return (
    <div className={`${styles.rail} ${size === 'sm' ? styles.railSm : ''}`}>
      {picks.map((pick) => (
        <FeaturedCard key={pick.id} pick={pick} channelSource={channelSource} onSelect={onSelect} />
      ))}
    </div>
  );
}

/** Big photo card — photo (or the type colour + icon when there's none / it fails), name, type. */
export function FeaturedCard({ pick, channelSource, onSelect }) {
  const image = pick.images && pick.images[0];
  const img = useImageStatus(image);
  const showImage = Boolean(image) && !img.failed;
  const platform = pick.isChannel ? channelPlatformMeta(pick.channelPlatform) : null;
  const Icon = platform ? platform.icon : getTypeIcon(pick.type);
  const color = platform ? platform.color : dotColor(pick.type);
  const subtitle = platform ? `${platform.label} · Join the Channel` : typeLabel(pick);

  function handleClick() {
    if (pick.isChannel) openChannel(pick, channelSource);
    else onSelect?.(pick.waypoint);
  }

  return (
    <button type="button" className={styles.featured} onClick={handleClick} style={showImage ? undefined : { background: color }}>
      {showImage ? (
        <img
          className={styles.featuredImg}
          src={image}
          alt=""
          loading="lazy"
          decoding="async"
          onLoad={img.onLoad}
          onError={img.onError}
        />
      ) : (
        <Icon className={styles.featuredIcon} size={40} color="#fff" strokeWidth={1.6} aria-hidden="true" />
      )}
      <span className={styles.featuredShade} aria-hidden="true" />
      {pick.isPromoted && (
        <span className={styles.featuredBadge}>
          <PromoBadge pick={pick} />
        </span>
      )}
      <span className={styles.featuredText}>
        <span className={styles.featuredName}>{pick.name}</span>
        <span className={styles.featuredMeta}>{subtitle}</span>
      </span>
    </button>
  );
}

/** Compact list row — square thumb, name, "type · N min walk", chevron. */
export function PlaceRow({ pick, userCoords, channelSource, onSelect, verified, size }) {
  const platform = pick.isChannel ? channelPlatformMeta(pick.channelPlatform) : null;
  const Icon = platform ? platform.icon : getTypeIcon(pick.type);
  const color = platform ? platform.color : dotColor(pick.type);
  const image = pick.images && pick.images[0];
  const mins = platform ? null : walkMins(pick, userCoords);

  function handleClick() {
    if (pick.isChannel) openChannel(pick, channelSource);
    else onSelect?.(pick.waypoint);
  }

  return (
    <button type="button" className={`${styles.row} ${size === 'sm' ? styles.rowSm : ''}`} onClick={handleClick}>
      <AvatarBox className={styles.thumb} image={image} Icon={Icon} iconSize={size === 'sm' ? 16 : 20} color={color} />
      <span className={styles.rowBody}>
        <span className={styles.rowNameLine}>
          <span className={styles.rowName}>{pick.name}</span>
          {verified && <BadgeCheck className={styles.verified} size={13} aria-label="Verified campus spot" />}
        </span>
        <span className={styles.rowMeta}>
          {platform ? (
            <span className={styles.rowJoin}>Join the Channel</span>
          ) : (
            <>
              {typeLabel(pick)}
              {mins != null && ` · ${mins} min walk`}
              {pick.avgRating != null && (
                <span className={styles.rowRating}>
                  {' · '}
                  <Star size={10} className={styles.star} aria-hidden="true" />
                  {Number(pick.avgRating).toFixed(1)}
                </span>
              )}
            </>
          )}
        </span>
      </span>
      {pick.isPromoted && <PromoBadge pick={pick} />}
      <ChevronRight className={styles.chevron} size={18} aria-hidden="true" />
    </button>
  );
}
