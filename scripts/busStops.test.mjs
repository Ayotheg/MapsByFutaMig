// Tests for src/features/navigation/busStops.js. Run: node scripts/busStops.test.mjs
import assert from 'node:assert/strict';
import { cumulativeDistances } from '../src/features/navigation/routeAhead.js';
import { createRideDetector, alightStop, stopLabel, alightPrompt } from '../src/features/navigation/busStops.js';

// ── riding vs walking
{
  const ride = createRideDetector();
  assert.equal(ride.update(1.2).riding, false, 'walking');
  assert.equal(ride.update(8).riding, false, 'one fast fix is not a ride');
  assert.equal(ride.update(8).riding, true, 'two in a row is');
  assert.equal(ride.update(null).riding, true, 'no speed reading changes nothing');
  assert.equal(ride.update(0).riding, true, 'stopped in traffic');
  assert.equal(ride.update(0.5).riding, true);
  const off = ride.update(1);
  assert.deepEqual(off, { riding: false, alighted: true }, 'three slow fixes: got off');
  assert.deepEqual(ride.update(1), { riding: false, alighted: false }, 'alighted is reported once');
  console.log('ok: ride detector');
}

// ── which stop to get off at
{
  // ~440 m north.
  const route = [[7.298, 5.138], [7.302, 5.138]];
  const cum = cumulativeDistances(route);
  const places = [
    { key: 'a', name: 'Gate', type: 'bus_stop', lat: 7.2985, lng: 5.1381 },
    { key: 'b', name: 'SOC', type: 'bus_stop', lat: 7.301, lng: 5.1379 },
    { key: 'far', name: 'Hostel', type: 'bus_stop', lat: 7.301, lng: 5.14 }, // ~220 m off the route
    { key: 'shop', name: 'Kiosk', type: 'shop', lat: 7.3015, lng: 5.138 },
  ];
  const stop = alightStop(route, cum, places);
  assert.equal(stop.place.name, 'SOC', 'the stop on the route closest to the destination');
  assert.ok(Math.abs(stop.along - 332) < 5, `~332 m along, got ${stop.along}`);
  assert.equal(alightStop(route, cum, places.slice(2)), null, 'no recorded stop on this route: normal navigation');
  assert.equal(alightStop(route, cum, []), null);
  console.log('ok: alightStop');
}

// ── wording
{
  assert.equal(stopLabel('SOC'), 'SOC bus stop');
  assert.equal(stopLabel('Senate Bus Stop'), 'Senate Bus Stop');
  assert.equal(stopLabel('Main bus park'), 'Main bus park');

  assert.equal(alightPrompt(400, 'SOC'), null, 'too far to mention');
  assert.equal(alightPrompt(200, 'SOC').instruction, 'Get off at SOC bus stop');
  assert.equal(alightPrompt(200, 'SOC').stage, 'ahead');
  assert.equal(alightPrompt(30, 'SOC').instruction, 'Get off here at SOC bus stop');
  assert.equal(alightPrompt(-20, 'SOC').stage, 'now', 'just past it still says now');
  assert.equal(alightPrompt(-100, 'SOC'), null, 'well past it: back to normal');
  console.log('ok: prompts');
}
