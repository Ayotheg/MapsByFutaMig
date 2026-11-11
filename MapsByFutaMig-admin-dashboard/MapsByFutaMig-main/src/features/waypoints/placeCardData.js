import { WP_TYPE_LABELS } from './wpTypeMeta';

// PlaceCard data for a waypoint / OSM place. Shared by the map pins
// (WaypointLayer, OSMAnnotationLayer) and the mid-trip "Nearby places"
// list so a card looks the same however it was opened.

/** `snap`/`merge` are useOSMAnnotations' entries for this waypoint, if any. */
export function waypointCardData(wp, snap, merge) {
  const data = {
    name: wp.name,
    badge: WP_TYPE_LABELS[wp.type] || 'Waypoint',
    description: wp.description,
    lat: snap ? snap.lat : wp.lat,
    lng: snap ? snap.lng : wp.lng,
    imageUrls: wp.imageUrls,
    id: wp.id,
    type: wp.type,
    // Slice 8: rating badge data — see PlaceCard.jsx's RatingBadge.
    avgRating: wp.avgRating,
    reviewCount: wp.reviewCount,
    area: wp.area || '',
  };
  if (merge) {
    data.osmBadge = merge.osmBadge;
    if (!data.description && merge.desc) data.description = merge.desc;
  }
  return data;
}

export function osmCardData(item) {
  return {
    name: item.name,
    badge: item.badge,
    description: item.desc,
    lat: item.lat,
    lng: item.lng,
    imageUrls: [],
    type: 'poi',
  };
}
