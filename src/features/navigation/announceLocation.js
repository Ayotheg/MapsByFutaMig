import { reverseGeocode } from '../search/nominatimSearch';
import { speak } from '../../lib/speech';
import { haversine } from '../../lib/geoUtils';

// The last reverse-geocode result, kept WITH the coordinates and time it
// was computed for. Reused only for a fix within GEOCODE_REUSE_M of those
// coordinates and younger than GEOCODE_REUSE_MS — anything else re-geocodes.
// In-memory only, on purpose: a place name must never survive a reload.
const GEOCODE_REUSE_M = 150;
const GEOCODE_REUSE_MS = 3 * 60 * 1000;
let geocodeCache = null;

// Bumped per call so a slow response for an older fix can't speak over
// (or after) the announcement for a newer one.
let announceSeq = 0;

/**
 * "Find my location" → speak it out loud.
 *
 * Reverse-geocodes the GPS fix through the same Nominatim (OSM) service
 * `nominatimSearch.js` already uses for search, then reads the result
 * back with the browser's own speech synthesizer (`lib/speech.js`) — no
 * extra service, no API key, just the "existing infrastructure" already
 * in the app plus the browser's built-in speaker.
 *
 * Built for students traveling in from other states: a bare lat/lng
 * means nothing read aloud, but hearing "Your current location is Ondo
 * Road, within Akure axis, Ondo State" tells them exactly which
 * expressway/town they're passing through. The same call works
 * identically inside the campus bounds too — Nominatim just returns
 * whatever road/area OSM has tagged there (e.g. an internal campus
 * road + "within Obanla axis"), so no campus vs. off-campus
 * special-casing is needed; it's one code path either way.
 *
 * The caller must pass a fix it has just accepted as current (see
 * `useGpsTracking.js`). If the lookup fails this says so rather than
 * staying silent or reusing an earlier name. `approximate` (the weak-signal
 * fallback fix) changes the wording so a ±300m guess isn't stated as fact.
 */
export async function announceCurrentLocation(lat, lng, { approximate = false } = {}) {
  if (lat == null || lng == null) return;
  const seq = ++announceSeq;

  let result = null;
  const cached = geocodeCache;
  if (
    cached &&
    Date.now() - cached.at <= GEOCODE_REUSE_MS &&
    haversine(cached.lat, cached.lng, lat, lng) <= GEOCODE_REUSE_M
  ) {
    result = cached.result;
  } else {
    try {
      result = await reverseGeocode(lat, lng);
    } catch {
      result = null;
    }
    if (seq !== announceSeq) return;
    if (result) geocodeCache = { lat, lng, at: Date.now(), result };
  }

  if (!result) {
    speak('Location found, but the place name could not be loaded.');
    return;
  }

  const { address, displayName } = result;

  // The exact road/highway/path the user is on, when OSM has one tagged
  // — this is the detail that answers "which expressway am I on".
  const specific = address.road || address.pedestrian || address.footway || address.residential;

  // The wider town/neighbourhood/area around that road — the "axis"
  // language matches how the phrase is used locally, and is the useful
  // fallback when the road itself has no name in OSM (common for minor
  // campus paths).
  const axis =
    address.suburb ||
    address.neighbourhood ||
    address.city_district ||
    address.town ||
    address.village ||
    address.city ||
    address.county;

  const state = address.state;

  let phrase = approximate ? 'Your approximate location is ' : 'Your current location is ';
  if (specific && axis && specific !== axis) {
    phrase += `${specific}, within ${axis} axis`;
  } else if (specific) {
    phrase += specific;
  } else if (axis) {
    phrase += `within ${axis} axis`;
  } else {
    // Last resort: Nominatim gave no structured address fields at all —
    // fall back to the first, most specific segment of its display name
    // rather than saying nothing.
    phrase += (displayName.split(',')[0] || 'an unknown location').trim();
  }
  if (state) phrase += `, ${state}`;
  phrase += '.';

  speak(phrase);
}
