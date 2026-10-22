// Tests for src/features/navigation/busStops.js. Run: node scripts/busStops.test.mjs
import assert from 'node:assert/strict';
import { createRideDetector, alightStop, alightPrompt } from '../src/features/navigation/busStops.js';

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

// ── which stop to get off at (~110 m per 0.001°)
{
  const dest = { lat: 7.302, lng: 5.138 };
  const user = { lat: 7.296, lng: 5.138 }; // ~660 m south of the destination
  const stops = [
    { key: 'gate', name: 'Gate', type: 'bus_stop', lat: 7.2965, lng: 5.1381 }, // ~610 m from dest: too far
    { key: 'soc', name: 'SOC', type: 'bus_stop', lat: 7.3005, lng: 5.1395 }, // ~230 m from dest
    { key: 'hall', name: 'Hall', type: 'bus_stop', lat: 7.3, lng: 5.138 }, // ~220 m, on the way
    { key: 'shop', name: 'Kiosk', type: 'shop', lat: 7.302, lng: 5.1381 }, // not a stop
  ];
  const pick = alightStop(dest, user, stops);
  assert.equal(pick.place.name, 'Hall', 'the recorded stop nearest the destination');
  assert.ok(Math.abs(pick.toUser - 442) < 5, `~442 m from the user, got ${pick.toUser}`);

  // Past Hall (closer to the destination than it): never send them back.
  assert.equal(alightStop(dest, { lat: 7.3012, lng: 5.138 }, stops), null, 'no stop behind them');
  assert.equal(alightStop(dest, { lat: 7.3, lng: 5.138 }, stops).place.name, 'Hall', 'still Hall while at it');
  assert.equal(alightStop(dest, user, [stops[0], stops[3]]), null, 'no recorded stop near the destination: normal navigation');
  assert.equal(alightStop(dest, user, []), null);
  console.log('ok: alightStop');
}

// ── wording
{
  assert.equal(alightPrompt(400, 'SOC'), null, 'too far to mention');
  assert.equal(alightPrompt(200, 'SOC').instruction, 'On a shuttle? Get off at SOC');
  assert.equal(alightPrompt(200, 'SOC').spoken, "If you're on a shuttle, get ready to get off at SOC.");
  assert.equal(alightPrompt(200, 'SOC').stage, 'ahead');
  assert.equal(alightPrompt(30, 'SOC').instruction, 'On a shuttle? Get off here at SOC');
  assert.equal(alightPrompt(30, 'SOC').stage, 'now');
  console.log('ok: prompts');
}
