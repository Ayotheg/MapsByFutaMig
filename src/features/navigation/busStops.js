import { VEHICLE_SPEED_KMH } from './gpsConstants.js';
import { placesAlong } from './routeAhead.js';

// "On a shuttle? Get off at ..." for users riding the campus shuttle. Only
// bus stops added to the map (waypoints of type 'bus_stop') count;
// anywhere else, riding or not, navigation carries on as normal.

const RIDING_MPS = VEHICLE_SPEED_KMH / 3.6;
const WALKING_MPS = 2;
const RIDE_TICKS = 2; // fast fixes in a row before we call it a ride
const WALK_TICKS = 3; // slow fixes in a row before we call it walking again
export const STOP_ON_ROUTE_M = 40;
export const ANNOUNCE_AHEAD_M = 250;
export const GET_OFF_NOW_M = 40;

/**
 * Feed it each fix's GPS speed (m/s, may be null). `update` returns
 * { riding, alighted } — `alighted` is true once, on the fix where a ride
 * ends.
 */
export function createRideDetector() {
  let riding = false;
  let fast = 0;
  let slow = 0;
  return {
    get riding() {
      return riding;
    },
    update(speed) {
      if (!Number.isFinite(speed)) return { riding, alighted: false };
      fast = speed >= RIDING_MPS ? fast + 1 : 0;
      slow = speed <= WALKING_MPS ? slow + 1 : 0;
      if (!riding && fast >= RIDE_TICKS) riding = true;
      else if (riding && slow >= WALK_TICKS) {
        riding = false;
        return { riding, alighted: true };
      }
      return { riding, alighted: false };
    },
  };
}

/**
 * The bus stop to get off at for this route: of the map's bus stops
 * within STOP_ON_ROUTE_M of the route, the one furthest along it (closest
 * to the destination). Returns { place, along } or null.
 */
export function alightStop(coords, cum, places) {
  const stops = (places || []).filter((p) => p.type === 'bus_stop' && p.name);
  if (!stops.length || coords.length < 2) return null;
  const found = placesAlong(coords, cum, 0, cum[cum.length - 1], stops, { maxOffset: STOP_ON_ROUTE_M, limit: Infinity });
  if (!found.length) return null;
  const last = found[found.length - 1];
  return { place: last.place, along: last.ahead };
}

/**
 * What to tell a rider `metresToStop` before their stop, or null when
 * it's still too far to mention. `stage` lets the caller speak each
 * prompt once. Speed can't tell a campus shuttle from a keke or car, so
 * the wording says who it's for and everyone else can ignore it.
 */
export function alightPrompt(metresToStop, name) {
  if (metresToStop > ANNOUNCE_AHEAD_M || metresToStop < -GET_OFF_NOW_M) return null;
  return metresToStop <= GET_OFF_NOW_M
    ? { stage: 'now', instruction: `On a shuttle? Get off here at ${name}`, spoken: `If you're on a shuttle, get off here, at ${name}.` }
    : { stage: 'ahead', instruction: `On a shuttle? Get off at ${name}`, spoken: `If you're on a shuttle, get ready to get off at ${name}.` };
}
