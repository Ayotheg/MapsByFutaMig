/**
 * typeIcons.js
 *
 * The one "place type -> icon" lookup. Used wherever a place has no photo
 * (place card, Explore cards, chip results, Nearby places, admin list)
 * and for search result icons, so every fallback agrees.
 *
 * Keys are the raw `type`/`subtype` strings used across the app (the 24
 * waypoint types plus older/OSM subtypes that still appear in data).
 * Values are keys into `LEGACY_ICON_MAP` (lucide icons + the custom
 * mosque/football/gate icons drawn to the same spec).
 */
import { LEGACY_ICON_MAP } from './legacyIconMap';

export const TYPE_ICON_KEYS = {
  // Academic
  lecture_hall: 'presentation',
  faculty: 'school',
  laboratory: 'flask-conical',
  workshop: 'hammer',
  library: 'library-big',
  auditorium: 'theater',
  hall: 'theater',

  // Admin
  senate: 'bank2',
  admin: 'building-fill',
  administrative: 'building-fill',
  bursary: 'banknote',
  student_affairs: 'users',
  office: 'briefcase',

  // Residential
  // Same house as the "Hostel / Lodges" quick chip.
  hostel: 'house-door-fill',
  dormitory: 'house-door-fill',
  hall_of_residence: 'house-door-fill',
  staff_quarters: 'house-door-fill',

  // Commerce / services. `food` and `shop` are the broad types; the rest
  // are older or OSM subtypes that still arrive in KML/OSM data.
  food: 'restaurant-fill',
  restaurant: 'restaurant-fill',
  fast_food: 'sandwich',
  cafe: 'coffee',
  shop: 'shop',
  kiosk: 'shop',
  shopping: 'shopping-bag',
  furniture: 'armchair',
  printing_shop: 'printer-fill',
  pharmacy: 'pill',
  barber: 'scissors',
  laundry: 'washing-machine',
  fuel: 'fuel',
  bank: 'banknote',
  atm: 'credit-card',

  // Sports / worship
  sports: 'football',
  sports_centre: 'football',
  stadium: 'football',
  mosque: 'mosque',
  chapel: 'church',
  place_of_worship: 'church',

  // Health
  clinic: 'stethoscope',
  hospital: 'hospital-fill',

  // Transport / infrastructure
  bus_stop: 'bus-front-fill',
  garage: 'car-front',
  parking: 'square-parking',
  infrastructure: 'zap',
  utility: 'zap',
  security_post: 'shield-check',
  gate: 'gate-barrier',
  entrance: 'door-open',
  junction: 'signpost',
  hazard: 'triangle-alert',

  // Misc
  toilet: 'toilet',
  landmark: 'bank2',
  university: 'graduation-cap',
  college: 'graduation-cap',
  school: 'school',

  // Search-index / OSM / KML source types
  poi: 'geo-alt-fill',
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
