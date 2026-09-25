import { Star } from 'lucide-react';
import { getTypeIcon } from '../../lib/typeIcons';
import { dotColor } from '../search/chipConfig';
import { haversine } from '../../lib/geoUtils';
import { channelPlatformMeta } from '../../lib/channelMeta';
import { track } from '../../lib/analytics';
import styles from './ExplorePanel.module.css';

// Rough campus walking pace for the card's "X mins away" label — a
// display-only estimate (see useOneShotLocation.js's header comment for
// why this doesn't reuse the live-navigation ETA machinery). 80 m/min
// (~4.8 km/h) is a standard average adult walking speed.
const WALK_METERS_PER_MIN = 80;

function formatDistanceLabel(pick, userCoords) {
  if (!userCoords || pick.lat == null || pick.lng == null) return null;
  const meters = haversine(userCoords.lat, userCoords.lng, pick.lat, pick.lng);
  const mins = Math.max(1, Math.round(meters / WALK_METERS_PER_MIN));
  return `${mins} min${mins === 1 ? '' : 's'} away`;
}

export default function ExploreCard({ pick, userCoords, onSelect }) {
  // Channel entries (supabase/channel_entries.sql) have no map location
  // and no type/rating/tags to show — a completely different card body
  // ("Join the Channel" CTA, opens the invite link in a new tab) rather
  // than the place/person card below.
  if (pick.isChannel) return <ChannelExploreCard pick={pick} />;

  const Icon = getTypeIcon(pick.type);
  const color = dotColor(pick.type);
  const distanceLabel = formatDistanceLabel(pick, userCoords);
  const image = pick.images && pick.images[0];
  const description = pick.waypoint?.description?.trim();
  const metaLabel = description
    ? description.slice(0, 64)
    : distanceLabel || (pick.type || '').replace(/_/g, ' ') || 'Campus spot';

  return (
    <button
      type="button"
      className={styles.card}
      // Pass the raw waypoint through, same `setSelected(waypoint)`
      // contract WaypointLayer/OSMAnnotationLayer/search/QuickChips all
      // already use to open PlaceCard — not the flattened `pick` shape,
      // which only exists for this panel's own display needs.
      onClick={() => onSelect?.(pick.waypoint)}
    >
      <div className={styles.avatar} style={!image ? { background: color } : undefined}>
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <Icon size={18} color="#fff" strokeWidth={2} />}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardName}>{pick.name}</div>
        <div className={styles.cardMeta}>{metaLabel}</div>
        {!!(pick.tags && pick.tags.length) && (
          <div className={styles.cardTags}>{pick.tags.slice(0, 2).join(' · ')}</div>
        )}
      </div>
      {pick.isPromoted && (
        <span className={styles.promoBadge}>
          <Star size={9} fill="currentColor" /> {pick.promoLabel || 'Promoted'}
        </span>
      )}
    </button>
  );
}

function ChannelExploreCard({ pick }) {
  const platform = channelPlatformMeta(pick.channelPlatform);
  const Icon = platform.icon;
  const image = pick.images && pick.images[0];

  return (
    <a
      className={styles.card}
      href={pick.channelLink || undefined}
      target="_blank"
      rel="noopener noreferrer"
      onClick={() => track('explore_channel_click', { source: 'explore_card', platform: pick.channelPlatform })}
    >
      <div className={styles.avatar} style={!image ? { background: platform.color } : undefined}>
        {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <Icon size={18} color="#fff" strokeWidth={2} />}
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardName}>{pick.name}</div>
        <div className={styles.cardJoin}>Join the Channel</div>
      </div>
      {pick.isPromoted && (
        <span className={styles.promoBadge}>
          <Star size={9} fill="currentColor" /> {pick.promoLabel || 'Promoted'}
        </span>
      )}
    </a>
  );
}