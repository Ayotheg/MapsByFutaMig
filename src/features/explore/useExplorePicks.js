import { useMemo } from 'react';

// How many auto-generated fallback picks to show when nothing has been
// featured yet. Popularity score is a simple rating * log(reviews+1)
// blend so a 5.0 with 2 reviews doesn't outrank a 4.6 with 200 — kept
// intentionally simple since this is just a sensible default, not the
// admin-curated real thing.
const FALLBACK_COUNT = 10;

function popularityScore(wp) {
  const rating = Number(wp.avgRating ?? 0);
  const reviews = Number(wp.reviewCount ?? 0);
  if (!rating) return 0;
  return rating * Math.log(reviews + 2);
}

function toPick(wp, overridePriority) {
  return {
    id: wp.id,
    waypointId: wp.id,
    waypoint: wp,
    name: wp.name,
    // A Business row has no `type` of its own (no category picker on its
    // edit form — see AdminEditModal.jsx's isBusiness branch) — 'shop'
    // gives it a sensible storefront icon/color instead of the generic
    // fallback, same synthetic-type trick PlaceCard.jsx and
    // useSearchIndex.js each use for the same reason.
    type: wp.isBusiness ? 'shop' : wp.type,
    images: wp.imageUrls || [],
    lat: wp.lat,
    lng: wp.lng,
    avgRating: wp.avgRating ?? null,
    reviewCount: wp.reviewCount ?? 0,
    tags: wp.exploreTags || [],
    isPromoted: !!wp.isPromoted,
    sponsorName: wp.sponsorName || '',
    promoLabel: wp.promoLabel || 'Promoted',
    priority: overridePriority ?? wp.explorePriority ?? 0,
    isFallback: overridePriority !== undefined,
    // Drives the Explore panel's PLACES/PEOPLE/CHANNELS pills (supabase/
    // people_entries.sql, supabase/channel_entries.sql) — a Person or
    // Channel pick renders/behaves the same as a Place one everywhere
    // else (same "feature in Explore" curation), it's just grouped under
    // its own pill and, for Channels, rendered by a dedicated card.
    isPerson: !!wp.isPerson,
    isChannel: !!wp.isChannel,
    channelLink: wp.channelLink || '',
    channelPlatform: wp.channelPlatform || '',
    // Business (supabase/business_entries.sql) is deliberately NOT given
    // its own dedicated card here the way Channel is — ExploreCard.jsx's
    // `pick.isChannel` check is the only branch, so a Business pick falls
    // through to the same normal place-card rendering a Person/Place
    // gets, then opens the standard PlaceCard on click (`onSelect?.
    // (pick.waypoint)`), which is exactly the "card displays normally"
    // behavior asked for — PlaceCard.jsx's own isBusiness branch is what
    // swaps the Navigate button for a link-out one there, not this file.
    isBusiness: !!wp.isBusiness,
    businessLink: wp.businessLink || '',
    businessPlatform: wp.businessPlatform || '',
  };
}

/**
 * Explore panel data — no separate fetch, no separate table. A place is
 * "featured" by ticking a checkbox in the same waypoint edit form
 * (`AdminEditModal.jsx`) already used to edit its name — see
 * `supabase/explore_fields.sql`'s header comment for why this replaced
 * the earlier separate-table design. This hook just filters/sorts the
 * `waypoints` array `MapPage` already has loaded.
 *
 * Falls back to an auto-generated top-rated list when nothing's been
 * featured yet, so the Explore panel is never empty before an admin
 * curates anything.
 */
export function useExplorePicks(waypoints) {
  const picks = useMemo(() => {
    const featured = (waypoints || [])
      .filter((wp) => wp.isExplore)
      .map((wp) => toPick(wp))
      .sort((a, b) => b.priority - a.priority);

    if (featured.length) return featured;

    return (waypoints || [])
      .filter((wp) => wp.name && wp.avgRating)
      .map((wp) => ({ wp, score: popularityScore(wp) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, FALLBACK_COUNT)
      .map(({ wp }, i) => toPick(wp, -i));
  }, [waypoints]);

  return { picks };
}
