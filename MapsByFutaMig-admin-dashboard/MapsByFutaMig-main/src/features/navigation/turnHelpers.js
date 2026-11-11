/**
 * Pure helpers ported verbatim from legacy's Navigation module IIFE
 * (`app.js` ~4408–4654): `TURN_ICONS`, `turnIcon`, `stepInstruction`
 * (OSRM maneuver → human sentence), `bearingToCardinal`, `ordinalSuffix`,
 * `fmtDist`, except the depart wording (no compass directions), plus
 * `startDirection` for the first turn once the user is moving.
 */

// Turn icon map (OSRM maneuver types) — values are lib/legacyIconMap.js keys
export const TURN_ICONS = {
  'turn-left': 'corner-up-left',
  'turn-right': 'corner-up-right',
  'turn-slight-left': 'arrow-up-left',
  'turn-slight-right': 'arrow-up-right',
  'turn-sharp-left': 'corner-up-left',
  'turn-sharp-right': 'corner-up-right',
  uturn: 'rotate-ccw',
  roundabout: 'rotate-cw',
  rotary: 'rotate-cw',
  'fork-left': 'corner-up-left',
  'fork-right': 'corner-up-right',
  arrive: 'flag',
  depart: 'rocket',
  straight: 'arrow-up',
  continue: 'arrow-up',
};

export function turnIcon(type, modifier) {
  const key = modifier ? `${type}-${modifier}` : type;
  return TURN_ICONS[key] || TURN_ICONS[type] || 'arrow-up';
}

export function fmtDist(m) {
  return m >= 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`;
}

export function bearingToCardinal(deg) {
  if (deg == null) return '';
  const dirs = ['north', 'northeast', 'east', 'southeast', 'south', 'southwest', 'west', 'northwest'];
  return dirs[Math.round(deg / 45) % 8];
}

export function ordinalSuffix(n) {
  const s = ['th', 'st', 'nd', 'rd'];
  const v = n % 100;
  return n + (s[(v - 20) % 10] || s[v] || s[0]);
}

/** Signed angle from one bearing to another, -180..180, positive = right. */
export function turnAngle(fromBearing, toBearing) {
  return ((toBearing - fromBearing + 540) % 360) - 180;
}

/**
 * The first instruction once the user's walking direction is known:
 * which way to turn, relative to where they're going now, to follow the
 * route. `icon` values are TURN_ICONS values.
 */
export function startDirection(walkingBearing, routeBearing) {
  const angle = turnAngle(walkingBearing, routeBearing);
  const a = Math.abs(angle);
  if (a < 45) return { instruction: 'Go straight ahead', icon: TURN_ICONS.straight };
  if (a > 135) return { instruction: 'Turn around', icon: TURN_ICONS.uturn };
  return angle > 0
    ? { instruction: 'Turn right', icon: TURN_ICONS['turn-right'] }
    : { instruction: 'Turn left', icon: TURN_ICONS['turn-left'] };
}

export function stepInstruction(step) {
  const t = (step.maneuver?.type || '').toLowerCase();
  const m = (step.maneuver?.modifier || '').toLowerCase();
  const road = step.name ? `onto ${step.name}` : step.ref ? `onto ${step.ref}` : '';

  // ── Depart / Arrive ──────────────────────────────────────────
  if (t === 'arrive') {
    return m === 'left'
      ? 'Arrive — destination is on the left'
      : m === 'right'
        ? 'Arrive — destination is on the right'
        : 'You have arrived at your destination';
  }
  // Compass words ("Head north") mean little to most users, and which way
  // they're facing isn't known until they move — startDirection() takes
  // over once it is.
  if (t === 'depart') {
    return step.name ? `Follow the route along ${step.name}` : 'Follow the route on the map';
  }

  // ── Turns ────────────────────────────────────────────────────
  if (t === 'turn') {
    if (m === 'sharp left') return `Turn sharp left${road ? ' ' + road : ''}`;
    if (m === 'left') return `Turn left${road ? ' ' + road : ''}`;
    if (m === 'slight left') return `Turn slightly left${road ? ' ' + road : ''}`;
    if (m === 'straight') return `Continue straight${road ? ' ' + road : ''}`;
    if (m === 'slight right') return `Turn slightly right${road ? ' ' + road : ''}`;
    if (m === 'right') return `Turn right${road ? ' ' + road : ''}`;
    if (m === 'sharp right') return `Turn sharp right${road ? ' ' + road : ''}`;
    if (m === 'uturn') return 'Make a U-turn';
  }

  // ── Forks ────────────────────────────────────────────────────
  if (t === 'fork') {
    if (m === 'left' || m === 'slight left') return `Keep left at the fork${road ? ' ' + road : ''}`;
    if (m === 'right' || m === 'slight right') return `Keep right at the fork${road ? ' ' + road : ''}`;
    return `Take the fork${road ? ' ' + road : ''}`;
  }

  // ── Merge ────────────────────────────────────────────────────
  if (t === 'merge') {
    if (m === 'left' || m === 'slight left') return `Merge left${road ? ' ' + road : ''}`;
    if (m === 'right' || m === 'slight right') return `Merge right${road ? ' ' + road : ''}`;
    return `Merge${road ? ' ' + road : ''}`;
  }

  // ── On-ramp / Off-ramp ───────────────────────────────────────
  if (t === 'on ramp' || t === 'on-ramp') {
    if (m === 'left' || m === 'slight left') return `Take the ramp on the left${road ? ' ' + road : ''}`;
    if (m === 'right' || m === 'slight right') return `Take the ramp on the right${road ? ' ' + road : ''}`;
    return `Take the ramp${road ? ' ' + road : ''}`;
  }
  if (t === 'off ramp' || t === 'off-ramp') {
    if (m === 'left' || m === 'slight left') return `Take the exit on the left${road ? ' ' + road : ''}`;
    if (m === 'right' || m === 'slight right') return `Take the exit on the right${road ? ' ' + road : ''}`;
    return `Take the exit${road ? ' ' + road : ''}`;
  }

  // ── Roundabout / Rotary ──────────────────────────────────────
  if (t === 'roundabout' || t === 'rotary') {
    const exit = step.maneuver?.exit;
    const ordinal = exit ? ordinalSuffix(exit) : null;
    return ordinal
      ? `At the roundabout, take the ${ordinal} exit${road ? ' ' + road : ''}`
      : `Enter the roundabout${road ? ' and take exit ' + road : ''}`;
  }
  if (t === 'roundabout turn' || t === 'exit roundabout') {
    return `Exit the roundabout${road ? ' ' + road : ''}`;
  }

  // ── Continue / New name ──────────────────────────────────────
  if (t === 'continue' || t === 'new name') {
    if (m === 'left' || m === 'slight left') return `Bear left${road ? ' ' + road : ''}`;
    if (m === 'right' || m === 'slight right') return `Bear right${road ? ' ' + road : ''}`;
    return `Continue straight${road ? ' ' + road : ''}`;
  }

  // ── End of road ──────────────────────────────────────────────
  if (t === 'end of road') {
    if (m === 'left') return `At the end of the road, turn left${road ? ' ' + road : ''}`;
    if (m === 'right') return `At the end of the road, turn right${road ? ' ' + road : ''}`;
    return `At the end of the road, continue${road ? ' ' + road : ''}`;
  }

  // ── Notification / Use lane ──────────────────────────────────
  if (t === 'notification') {
    return road ? `Continue ${road}` : 'Continue straight';
  }

  // ── Fallback — derive from modifier alone ────────────────────
  if (m === 'sharp left') return `Turn sharp left${road ? ' ' + road : ''}`;
  if (m === 'left') return `Turn left${road ? ' ' + road : ''}`;
  if (m === 'slight left') return `Bear left${road ? ' ' + road : ''}`;
  if (m === 'straight') return `Continue straight${road ? ' ' + road : ''}`;
  if (m === 'slight right') return `Bear right${road ? ' ' + road : ''}`;
  if (m === 'right') return `Turn right${road ? ' ' + road : ''}`;
  if (m === 'sharp right') return `Turn sharp right${road ? ' ' + road : ''}`;
  if (m === 'uturn') return 'Make a U-turn';

  return road ? `Continue ${road}` : 'Continue straight';
}
