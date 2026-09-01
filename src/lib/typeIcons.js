/**
 * typeIcons.js
 *
 * One shared "waypoint/place type -> icon" lookup, replacing the emoji
 * maps that used to be duplicated across `wpTypeMeta.js` (TYPE_EMOJI),
 * `features/search/chipConfig.js` (TYPE_EMOJI/typeEmoji),
 * `features/search/useSearchIndex.js` (TYPE_ICONS), and
 * `features/osm-annotations/osmAnnotationUtils.js` (OSM_BADGE) — all
 * four kept their own copy of "what emoji represents a lecture hall",
 * so they could (and did) drift. This is the one place that answer
 * lives now; each of those files imports `getTypeIcon` instead.
 *
 * Keys are the raw `type`/`subtype` strings used across the app (same
 * ones `CATEGORY_ICON_KEYS` in `shared/placeCategories.js` uses for the
 * 16 Quick Chip *categories* — this map is the superset, covering every
 * individual waypoint type, not just the grouped chip categories).
 * Values look up `LEGACY_ICON_MAP`.
 */
import { LEGACY_ICON_MAP } from './legacyIconMap';

export const TYPE_ICON_KEYS = {
  // Academic
  lecture_hall: 'graduation-cap',
  faculty: 'building-fill',
  laboratory: 'flask-conical',
  workshop: 'wrench',
  library: 'book-open',
  auditorium: 'presentation',
  hall: 'theater',

  // Admin
  senate: 'bank2',
  admin: 'briefcase',
  bursary: 'banknote',
  student_affairs: 'person-fill',

  // Residential
  hostel: 'house-door-fill',
  staff_quarters: 'house-door-fill',
  dormitory: 'house-door-fill',
  hall_of_residence: 'house-door-fill',

  // Commerce / services
  // `food` and `shop` are the Sept 2026 consolidated broad types (see
  // adminTypeOptions.js header) — the raw pre-merge keys below (shopping,
  // furniture, cafe, restaurant, pharmacy, barber, laundry, fast_food) are
  // kept too since KML/OSM annotation data can still carry those as a
  // `subtype` string independent of the waypoints table's `type` column.
  food: 'restaurant-fill',
  shop: 'shop',
  shopping: 'shop',
  furniture: 'armchair',
  kiosk: 'shop',
  printing_shop: 'printer-fill',
  cafe: 'coffee',
  restaurant: 'restaurant-fill',
  fast_food: 'restaurant-fill',
  pharmacy: 'pill',
  barber: 'scissors',
  laundry: 'shirt',
  fuel: 'fuel',
  bank: 'bank2',
  atm: 'bank2',
  office: 'briefcase',

  // Sports / worship
  sports: 'football',
  sports_centre: 'football',
  stadium: 'football',
  mosque: 'mosque',
  chapel: 'church',
  place_of_worship: 'church',

  // Transport / infrastructure
  garage: 'car-front',
  parking: 'car-front',
  bus_stop: 'bus-front-fill',
  infrastructure: 'zap', // Sept 2026 consolidated type (utility + security_post)
  utility: 'zap',
  security_post: 'shield',
  gate: 'gate-barrier',
  entrance: 'door-open',
  junction: 'signpost',
  hazard: 'triangle-alert',

  // Health
  clinic: 'hospital-fill',
  hospital: 'hospital-fill',

  // Misc / catch-alls
  toilet: 'toilet',
  landmark: 'bank2',
  administrative: 'building-fill',
  university: 'graduation-cap',
  college: 'graduation-cap',
  school: 'building-fill',

  // Search-index / KML source types
  waypoint: 'geo-alt-fill',
  segment: 'route',
  osm: 'globe',
  kml: 'folder',
};

/** Resolves a type/subtype string to an icon component. `fallbackKey`
 * lets a call site pass a more specific default than the generic pin
 * (e.g. a chip's own `iconKey`) before falling back to `geo-alt-fill`. */
export function getTypeIcon(type, fallbackKey) {
  const key = TYPE_ICON_KEYS[type] || fallbackKey;
  return LEGACY_ICON_MAP[key] || LEGACY_ICON_MAP['geo-alt-fill'];
}
