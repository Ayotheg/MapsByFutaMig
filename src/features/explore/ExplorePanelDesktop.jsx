import { useMemo, useState } from 'react';
import { BadgeCheck, ChevronDown, Footprints, Plus, Star, ArrowUpRight } from 'lucide-react';
import { getTypeIcon } from '../../lib/typeIcons';
import { dotColor } from '../search/chipConfig';
import { GROUP_META, groupOfType } from '../legend/placeTypeGroups';
import { haversine } from '../../lib/geoUtils';
import { channelPlatformMeta } from '../../lib/channelMeta';
import { track } from '../../lib/analytics';
import ExploreChannelLink from './ExploreChannelLink';
import styles from './ExplorePanelDesktop.module.css';

// Rough campus walking pace — same constant ExploreCard.jsx (the mobile
// card) already uses for its own "X mins away" label, kept in sync
// rather than imported cross-file since it's a single primitive number.
const WALK_METERS_PER_MIN = 80;

const SORT_OPTIONS = [
  { key: 'featured', label: 'Featured' },
  { key: 'nearest', label: 'Nearest First', needsLocation: true },
  { key: 'rating', label: 'Top Rated' },
];

/**
 * Desktop-only "Explore Campus" panel redesign (Figma: MAPSBYFUTA /
 * Section - Comprehensive, High-Fidelity Desktop Redesign of the
 * Explore Campus Panel, node 111:57). Rendered by `ExplorePanel.jsx`
 * only when `variant === 'full' && desktop` — the mobile bottom-sheet
 * "full" view and the "compact" preview both keep using the original
 * markup below, untouched.
 *
 * Every number/label on this screen is real, derived data — no
 * fabricated hours/pricing/phone numbers. Fields the Figma reference
 * shows that this app genuinely has no source for (opening hours,
 * per-item pricing, a phone number to call) are left out rather than
 * faked; the category chips, sort modes, rating, tags, and the
 * "Verified" mark are all backed by fields already on the waypoint
 * (`avgRating`/`reviewCount`/`exploreTags`/`isExplore`/`type`).
 */
export default function ExplorePanelDesktop({ picks, userCoords, onSelect, onSuggestPlace, category = 'places', onCategoryChange }) {
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
    // "featured" — same ordering ExplorePanel already builds for every
    // other variant: promoted picks first (by priority), then organic
    // picks (by priority). Kept identical on purpose, just relabeled as
    // a selectable option alongside the two new ones.
    return list.sort((a, b) => {
      if (!!a.isPromoted !== !!b.isPromoted) return a.isPromoted ? -1 : 1;
      return (b.priority ?? 0) - (a.priority ?? 0);
    });
  }, [filtered, sortMode, userCoords]);

  const featuredPartnerCount = filtered.filter((p) => p.isPromoted).length;
  const availableSortOptions = SORT_OPTIONS.filter((o) => !o.needsLocation || userCoords);
  const currentSortLabel = availableSortOptions.find((o) => o.key === sortMode)?.label || 'Featured';

  function handleSortSelect(key) {
    setSortMode(key);
    setSortOpen(false);
  }

  return (
    <div className={styles.root}>
      <div className={styles.head}>
        <div className={styles.headTop}>
          <div className={styles.headTitleBlock}>
            <div className={styles.headTitleRow}>
              <span className={styles.headTitle}>Explore Campus</span>
              <span className={styles.livePill}>Live</span>
            </div>
            <div className={styles.headSubtitle}>Discover verified campus services, student amenities &amp; hubs around FUTA</div>
          </div>
          <div className={styles.countBadge}>
            <span className={styles.countBadgeNumber}>{picks.length}</span>
            <span className={styles.countBadgeLabel}>
              {category === 'people'
                ? picks.length === 1 ? 'Person' : 'People'
                : category === 'channels'
                ? picks.length === 1 ? 'Channel' : 'Channels'
                : picks.length === 1 ? 'Place' : 'Places'}
            </span>
          </div>
        </div>

        {/* PLACES / PEOPLE / CHANNELS pill switcher (supabase/
            people_entries.sql, supabase/channel_entries.sql). */}
        <div className={styles.chipRow}>
          <button
            type="button"
            className={`${styles.chip} ${category === 'places' ? styles.chipActive : ''}`}
            onClick={() => onCategoryChange?.('places')}
          >
            Places
          </button>
          <button
            type="button"
            className={`${styles.chip} ${category === 'people' ? styles.chipActive : ''}`}
            onClick={() => onCategoryChange?.('people')}
          >
            People
          </button>
          <button
            type="button"
            className={`${styles.chip} ${category === 'channels' ? styles.chipActive : ''}`}
            onClick={() => onCategoryChange?.('channels')}
          >
            Channels
          </button>
        </div>

        {availableGroups.length > 0 && (
          <div className={styles.chipRow}>
            <button
              type="button"
              className={`${styles.chip} ${activeGroup === null ? styles.chipActive : ''}`}
              onClick={() => setActiveGroup(null)}
            >
              All Spots
            </button>
            {availableGroups.map((g) => (
              <button
                key={g.key}
                type="button"
                className={`${styles.chip} ${activeGroup === g.key ? styles.chipActive : ''}`}
                onClick={() => setActiveGroup(g.key)}
              >
                <span className={styles.chipDot} style={{ background: g.swatch }} />
                {g.name} ({groupCounts[g.key]})
              </button>
            ))}
          </div>
        )}

        {category === 'places' && (
          <div className={styles.controlsRow}>
            <div className={styles.sortWrap}>
              <span className={styles.sortLabel}>Sort:</span>
              <button type="button" className={styles.sortBtn} onClick={() => setSortOpen((v) => !v)}>
                {currentSortLabel} <ChevronDown size={11} />
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
            {featuredPartnerCount > 0 && (
              <div className={styles.featuredPill}>
                <span className={styles.featuredDot} />
                {featuredPartnerCount} Featured Partner{featuredPartnerCount === 1 ? '' : 's'}
              </div>
            )}
          </div>
        )}
      </div>

      <div className={styles.list}>
        {sorted.length === 0 && (
          <div className={styles.noResults}>
            {category === 'people'
              ? 'No people featured yet.'
              : category === 'channels'
              ? 'No channels featured yet.'
              : 'No spots in this category yet — try "All Spots".'}
          </div>
        )}
        {sorted.map((pick) =>
          pick.isChannel ? (
            <ChannelCardDesktop key={pick.id} pick={pick} />
          ) : (
            <ExploreCardDesktop key={pick.id} pick={pick} onSelect={onSelect} />
          )
        )}
      </div>

      {/* WhatsApp channel link — pinned between the list and the footer so
          it's visible without scrolling, and outside the list so it can't
          be mistaken for a Featured Partner slot or counted as a vendor. */}
      <ExploreChannelLink variant="row" source="explore_desktop" />

      <div className={styles.footer}>
        <div className={styles.footerLeft}>
          <span className={styles.footerDot} />
          Showing {sorted.length} verified vendor{sorted.length === 1 ? '' : 's'}
        </div>
        {onSuggestPlace && (
          <button type="button" className={styles.footerAction} onClick={onSuggestPlace}>
            <Plus size={11} /> Suggest a Place
          </button>
        )}
      </div>
    </div>
  );
}

function ExploreCardDesktop({ pick, onSelect }) {
  const Icon = getTypeIcon(pick.type);
  const color = dotColor(pick.type);
  const image = pick.images && pick.images[0];
  const group = GROUP_META.find((g) => g.key === groupOfType(pick.type));
  const description = pick.waypoint?.description?.trim();
  // Only admin-curated picks (explicitly ticked "Feature this place in
  // Explore" in AdminEditModal) get the verified mark — the
  // auto-generated top-rated fallback list (`isFallback`, see
  // useExplorePicks.js) hasn't actually been reviewed by anyone, so it
  // doesn't earn the same claim.
  const isVerified = !pick.isFallback;

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardIdentity}>
          <div className={styles.avatar} style={!image ? { background: color } : undefined}>
            {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <Icon size={15} color="#fff" strokeWidth={2} />}
            {isVerified && (
              <span className={styles.verifiedBadge} title="Verified campus spot">
                <BadgeCheck size={10} />
              </span>
            )}
          </div>
          <div className={styles.cardIdentityText}>
            <div className={styles.cardName}>{pick.name}</div>
            <div className={styles.cardMetaRow}>
              {pick.distanceMins != null ? (
                <span className={styles.cardDistance}>
                  <Footprints size={9} /> {pick.distanceMins} min{pick.distanceMins === 1 ? '' : 's'} walk
                </span>
              ) : group ? (
                <span className={styles.cardCategory} style={{ color: group.swatch }}>
                  {group.name}
                </span>
              ) : null}
            </div>
          </div>
        </div>
        {pick.isPromoted && (
          <span className={styles.promoBadge}>
            <Star size={9} fill="currentColor" /> {pick.promoLabel || 'Promoted'}
          </span>
        )}
      </div>

      {description && <p className={styles.cardDescription}>{description}</p>}

      {!!(pick.tags && pick.tags.length) && (
        <div className={styles.cardTags}>
          {pick.tags.slice(0, 3).map((tag) => (
            <span key={tag} className={styles.cardTag}>
              {tag}
            </span>
          ))}
        </div>
      )}

      <div className={styles.cardFooter}>
        <div className={styles.cardFooterMeta}>
          {pick.avgRating != null && (
            <span className={styles.cardRating}>
              {Number(pick.avgRating).toFixed(1)} <Star size={9} fill="currentColor" />
              {pick.reviewCount ? <span className={styles.cardReviewCount}>({pick.reviewCount})</span> : null}
            </span>
          )}
          {group && (
            <span className={styles.cardCategoryChip}>
              <span className={styles.chipDot} style={{ background: group.swatch }} />
              {group.name}
            </span>
          )}
        </div>
        <button type="button" className={styles.cardAction} onClick={() => onSelect?.(pick.waypoint)}>
          {pick.isPerson ? 'View Details' : 'View on Map'}
        </button>
      </div>
    </article>
  );
}

/**
 * Channel entries (supabase/channel_entries.sql) — a much simpler card
 * than a Place/Person: no distance, rating, tags, or "View on Map" (a
 * channel has nowhere on the map to show). The whole card links straight
 * out to the invite link; the footer button re-states that as an
 * explicit "Join the Channel" CTA per the card's own action-row pattern.
 */
function ChannelCardDesktop({ pick }) {
  const platform = channelPlatformMeta(pick.channelPlatform);
  const Icon = platform.icon;
  const image = pick.images && pick.images[0];

  function handleJoin() {
    track('explore_channel_click', { source: 'explore_desktop_card', platform: pick.channelPlatform });
    window.open(pick.channelLink, '_blank', 'noopener,noreferrer');
  }

  return (
    <article className={styles.card}>
      <div className={styles.cardTop}>
        <div className={styles.cardIdentity}>
          <div className={styles.avatar} style={!image ? { background: platform.color } : undefined}>
           {image ? <img src={image} alt="" loading="lazy" decoding="async" /> : <Icon size={15} color="#fff" strokeWidth={2} />}
          </div>
          <div className={styles.cardIdentityText}>
            <div className={styles.cardName}>{pick.name}</div>
            <div className={styles.cardMetaRow}>
              <span className={styles.cardCategory}>{platform.label}</span>
            </div>
          </div>
        </div>
        {pick.isPromoted && (
          <span className={styles.promoBadge}>
            <Star size={9} fill="currentColor" /> {pick.promoLabel || 'Promoted'}
          </span>
        )}
      </div>

      <div className={styles.cardFooter}>
        <button type="button" className={styles.cardAction} onClick={handleJoin}>
          Join the Channel <ArrowUpRight size={11} />
        </button>
      </div>
    </article>
  );
}