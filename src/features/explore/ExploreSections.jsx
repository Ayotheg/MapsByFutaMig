import { BadgeCheck, ChevronRight, Sparkle } from 'lucide-react';
import { getTypeIcon } from '../../lib/typeIcons';
import { dotColor, fmtMeters } from '../search/chipConfig';
import { haversine } from '../../lib/geoUtils';
import { channelPlatformMeta } from '../../lib/channelMeta';
import { track } from '../../lib/analytics';
import { useImageStatus } from '../../lib/useImageStatus';
import ExplorePromoteCard from './ExplorePromoteCard';
import styles from './ExploreSections.module.css';

/**
 * Shared building blocks for the Explore redesign: the Places/People/
 * Channels segmented control, section headers, the Featured rail and the
 * list below it. Each category has its own card look —
 *   Places:   photo card / plain row with thumb + type
 *   People:   portrait card with bio / bordered row with tag chips + bio
 *   Channels: logo card with "Join channel" / bordered row with "Join"
 * Used by both ExplorePanel (mobile sheet) and ExplorePanelDesktop
 * (sidebar). Purely presentational — every click still goes through the
 * same `onSelect(pick.waypoint)` / channel-link tracking the old cards
 * used.
 */

// With no paid placements, the first few picks fill the Featured rail so
// the section is never empty.
const FEATURED_FALLBACK = 3;

export const CATEGORIES = [
  { key: 'places', label: 'Places' },
  { key: 'people', label: 'People' },
  { key: 'channels', label: 'Channels' },
];

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

export function featuredTitle(category) {
  if (category === 'people') return 'Featured people';
  if (category === 'channels') return 'Featured channels';
  return 'Featured';
}

export function moreTitle(category) {
  if (category === 'people') return 'More people';
  if (category === 'channels') return 'More channels';
  return 'Popular on campus';
}

function distanceMeters(pick, userCoords) {
  if (pick.distanceMeters != null) return pick.distanceMeters;
  if (!userCoords || pick.lat == null || pick.lng == null) return null;
  return haversine(userCoords.lat, userCoords.lng, pick.lat, pick.lng);
}

// A person's title, set in admin as "300L, Electrical & Electronics" (a
// "·" works too). Each comma-separated part is shown "·"-joined on the
// card and as its own chip in the list. People without a title fall back
// to their Explore tags.
function personTitleParts(pick) {
  if (pick.area) return pick.area.split(/[,·]/).map((s) => s.trim()).filter(Boolean);
  return (pick.tags || []).slice(0, 2);
}

function typeLabel(pick) {
  const t = (pick.type || '').replace(/_/g, ' ').trim();
  return t ? t.charAt(0).toUpperCase() + t.slice(1) : 'Campus spot';
}

function initials(name) {
  const words = (name || '').trim().split(/\s+/).filter(Boolean);
  return (words.length > 1 ? words[0][0] + words[1][0] : (words[0] || '?').slice(0, 2)).toUpperCase();
}

function bio(pick) {
  return pick.waypoint?.description?.trim() || '';
}

function channelKind(pick) {
  const platform = channelPlatformMeta(pick.channelPlatform);
  return platform.key === 'other' ? 'Channel' : `${platform.label} channel`;
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
          See all <ChevronRight size={15} aria-hidden="true" />
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

/**
 * Photo with its fallback (type icon / initials on a coloured fill)
 * always drawn underneath; the photo fades in on top only once it has
 * actually loaded. So a photo that is missing, fails, or never finishes
 * loading (slow network, iOS WebKit quirks) still leaves a proper card,
 * never a blank one — same layering as Quick Chips' ChipResultRow.
 *
 * Not `loading="lazy"`: Explore shows only a handful of photos, and
 * WebKit (Safari, and every iOS browser) can leave lazy images inside a
 * sideways-scrolling row in a sliding sheet unloaded indefinitely.
 */
function Photo({ image, className, fallback, fallbackStyle }) {
  const img = useImageStatus(image);
  return (
    <span className={className} style={fallbackStyle}>
      {fallback}
      {image && !img.failed && (
        <img
          className={`${styles.photoImg} ${img.loaded ? styles.photoImgLoaded : ''}`}
          src={image}
          alt=""
          decoding="async"
          onLoad={img.onLoad}
          onError={img.onError}
        />
      )}
    </span>
  );
}

/**
 * Horizontally-scrolling Featured row. `promoteSource` adds the "Get your
 * spot featured" card at the end (Places only — the panels decide).
 */
export function FeaturedRail({ picks, size, channelSource, promoteSource, onSelect }) {
  return (
    <div className={`${styles.rail} ${size === 'sm' ? styles.railSm : ''}`}>
      {picks.map((pick) => {
        if (pick.isChannel) return <ChannelFeaturedCard key={pick.id} pick={pick} channelSource={channelSource} />;
        if (pick.isPerson) return <PersonFeaturedCard key={pick.id} pick={pick} onSelect={onSelect} />;
        return <PlaceFeaturedCard key={pick.id} pick={pick} onSelect={onSelect} />;
      })}
      {promoteSource && <ExplorePromoteCard source={promoteSource} size={size} />}
    </div>
  );
}

function PlaceFeaturedCard({ pick, onSelect }) {
  const Icon = getTypeIcon(pick.type);
  return (
    <button type="button" className={styles.featured} onClick={() => onSelect?.(pick.waypoint)}>
      <Photo
        image={pick.images && pick.images[0]}
        className={styles.featuredPhoto}
        fallbackStyle={{ background: dotColor(pick.type) }}
        fallback={<Icon className={styles.featuredIcon} size={40} color="#fff" strokeWidth={1.6} aria-hidden="true" />}
      />
      <span className={styles.featuredShade} aria-hidden="true" />
      {pick.isPromoted && (
        <span className={styles.featuredBadge}>
          <PromoBadge pick={pick} />
        </span>
      )}
      <span className={styles.featuredText}>
        <span className={styles.featuredName}>{pick.name}</span>
        <span className={styles.featuredMeta}>{typeLabel(pick)}</span>
      </span>
    </button>
  );
}

function PersonFeaturedCard({ pick, onSelect }) {
  const about = bio(pick);
  const titleParts = personTitleParts(pick);
  return (
    <button type="button" className={`${styles.featured} ${styles.personCard}`} onClick={() => onSelect?.(pick.waypoint)}>
      <span className={styles.personTop}>
        <Photo
          image={pick.images && pick.images[0]}
          className={styles.featuredPhoto}
          fallbackStyle={{ background: 'var(--v2-neutral)' }}
          fallback={<span className={styles.personInitials}>{initials(pick.name)}</span>}
        />
        <span className={styles.featuredShade} aria-hidden="true" />
        {pick.isPromoted && (
          <span className={styles.featuredBadge}>
            <PromoBadge pick={pick} />
          </span>
        )}
        <span className={styles.featuredText}>
          <span className={styles.featuredName}>{pick.name}</span>
          {titleParts.length > 0 && <span className={styles.featuredMeta}>{titleParts.join(' · ')}</span>}
        </span>
      </span>
      {about && <span className={styles.personBio}>{about}</span>}
    </button>
  );
}

function ChannelFeaturedCard({ pick, channelSource }) {
  return (
    <div className={`${styles.featured} ${styles.channelCard}`}>
      <button type="button" className={styles.channelTop} onClick={() => openChannel(pick, channelSource)}>
        {pick.isPromoted && (
          <span className={styles.featuredBadge}>
            <PromoBadge pick={pick} />
          </span>
        )}
        <Photo
          image={pick.images && pick.images[0]}
          className={styles.channelLogo}
          fallback={<span className={styles.channelInitials}>{initials(pick.name)}</span>}
        />
      </button>
      <div className={styles.channelBody}>
        <span className={styles.channelName}>{pick.name}</span>
        <span className={styles.channelKind}>{channelKind(pick)}</span>
        <button type="button" className={styles.joinBtn} onClick={() => openChannel(pick, channelSource)}>
          Join channel
        </button>
      </div>
    </div>
  );
}

/** One row of the list under the Featured rail. */
export function ListRow({ pick, ...props }) {
  if (pick.isChannel) return <ChannelRow pick={pick} {...props} />;
  if (pick.isPerson) return <PersonRow pick={pick} {...props} />;
  return <PlaceRow pick={pick} {...props} />;
}

// Second line, same "area · distance" as the Quick Chips results
// (ChipResultRow.jsx): the place's area, or its description when no area
// is set yet, then the distance from the person.
function PlaceRow({ pick, userCoords, onSelect, verified, size }) {
  const Icon = getTypeIcon(pick.type);
  const area = pick.area || bio(pick);
  const meters = distanceMeters(pick, userCoords);
  const dist = meters != null ? fmtMeters(meters) : '';
  return (
    <button type="button" className={`${styles.row} ${size === 'sm' ? styles.rowSm : ''}`} onClick={() => onSelect?.(pick.waypoint)}>
      <Photo
        className={styles.thumb}
        image={pick.images && pick.images[0]}
        fallbackStyle={{ background: dotColor(pick.type) }}
        fallback={<Icon size={size === 'sm' ? 16 : 20} color="#fff" strokeWidth={2} aria-hidden="true" />}
      />
      <span className={styles.rowBody}>
        <span className={styles.rowNameLine}>
          <span className={styles.rowName}>{pick.name}</span>
          {verified && <BadgeCheck className={styles.verified} size={13} aria-label="Verified campus spot" />}
        </span>
        {(area || dist) && (
          <span className={styles.rowMeta}>
            {area}
            {area && dist && ' · '}
            {dist && <span className={styles.rowDist}>{dist}</span>}
          </span>
        )}
      </span>
      {pick.isPromoted && <PromoBadge pick={pick} />}
      <ChevronRight className={styles.chevron} size={18} aria-hidden="true" />
    </button>
  );
}

function PersonRow({ pick, onSelect, size }) {
  const about = bio(pick);
  const titleParts = personTitleParts(pick);
  return (
    <button
      type="button"
      className={`${styles.cardRow} ${size === 'sm' ? styles.cardRowSm : ''}`}
      onClick={() => onSelect?.(pick.waypoint)}
    >
      <Photo
        image={pick.images && pick.images[0]}
        className={styles.personAvatar}
        fallback={<span>{initials(pick.name).charAt(0)}</span>}
      />
      <span className={styles.rowBody}>
        <span className={styles.rowName}>{pick.name}</span>
        {titleParts.length > 0 && (
          <span className={styles.tagChips}>
            {titleParts.map((tag, i) => (
              <span key={`${i}-${tag}`} className={styles.tagChip}>
                {tag}
              </span>
            ))}
          </span>
        )}
        {about && <span className={styles.rowBio}>{about}</span>}
      </span>
    </button>
  );
}

function ChannelRow({ pick, channelSource, size }) {
  return (
    <button
      type="button"
      className={`${styles.cardRow} ${styles.cardRowCenter} ${size === 'sm' ? styles.cardRowSm : ''}`}
      onClick={() => openChannel(pick, channelSource)}
    >
      <Photo
        image={pick.images && pick.images[0]}
        className={styles.channelAvatar}
        fallback={<span>{initials(pick.name).charAt(0)}</span>}
      />
      <span className={styles.rowBody}>
        <span className={styles.rowName}>{pick.name}</span>
        <span className={styles.rowMeta}>{channelKind(pick)}</span>
      </span>
      <span className={styles.joinPill}>Join</span>
    </button>
  );
}
