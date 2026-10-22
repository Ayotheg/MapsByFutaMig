import { haversine } from '../../lib/geoUtils.js';
import { VEHICLE_SPEED_KMH } from './gpsConstants.js';

// "On a shuttle? Get off at ..." for users riding the campus shuttle. Only
// shuttle stops recorded on the map (waypoints of type 'bus_stop') count;
// with none near the destination, riding or not, navigation carries on
// as normal.

const RIDING_MPS = VEHICLE_SPEED_KMH / 3.6;
const WALKING_MPS = 2;
const RIDE_TICKS = 2; // fast fixes in a row before we call it a ride
const WALK_TICKS = 3; // slow fixes in a row before we call it walking again
export const MAX_STOP_TO_DEST_M = 500;
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

const dist = (a, b) => haversine(Number(a.lat), Number(a.lng), Number(b.lat), Number(b.lng));

/**
 * The shuttle stop to get off at: of the stops recorded on the map, the
 * one nearest the destination — if it's within MAX_STOP_TO_DEST_M of it
 * and not one the rider has already passed (no further from the
 * destination than they are, give or take GET_OFF_NOW_M). Straight-line
 * distances: the shuttle's road and the walking route often differ.
 * Returns { place, toUser } (metres from `user`) or null.
 */
export function alightStop(dest, user, places) {
  let best = null;
  let bestToDest = Infinity;
  const userToDest = dist(user, dest);
  for (const p of places || []) {
    if (p.type !== 'bus_stop' || !p.name || !Number.isFinite(Number(p.lat)) || !Number.isFinite(Number(p.lng))) continue;
    const toDest = dist(p, dest);
    if (toDest > MAX_STOP_TO_DEST_M || toDest > userToDest + GET_OFF_NOW_M) continue;
    if (toDest < bestToDest) {
      best = p;
      bestToDest = toDest;
    }
  }
  return best ? { place: best, toUser: dist(best, user) } : null;
}

/**
 * What to tell a rider `metresToStop` from their stop, or null when it's
 * still too far to mention. `stage` lets the caller speak each prompt
 * once. Speed can't tell a campus shuttle from a keke or car, so the
 * wording says who it's for and everyone else can ignore it.
 */
export function alightPrompt(metresToStop, name) {
  if (metresToStop > ANNOUNCE_AHEAD_M) return null;
  return metresToStop <= GET_OFF_NOW_M
    ? { stage: 'now', instruction: `On a shuttle? Get off here at ${name}`, spoken: `If you're on a shuttle, get off here, at ${name}.` }
    : { stage: 'ahead', instruction: `On a shuttle? Get off at ${name}`, spoken: `If you're on a shuttle, get ready to get off at ${name}.` };
}
