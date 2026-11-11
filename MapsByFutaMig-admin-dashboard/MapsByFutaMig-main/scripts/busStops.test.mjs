// Tests for src/features/navigation/busStops.js. Run: node scripts/busStops.test.mjs
import assert from 'node:assert/strict';
import { createRideDetector, alightStop, alightPrompt, routeProfile, speedBetween } from '../src/features/navigation/busStops.js';

// ── riding vs walking
{
  const ride = createRideDetector();
  let t = 0;
  const at = (secs) => (t += secs * 1000); // fix times, `secs` after the last
  assert.equal(ride.update(1.2, at(1)).riding, false, 'walking');
  assert.equal(ride.update(8, at(1)).riding, false, 'one fast fix is not a ride');
  assert.equal(ride.update(8, at(1)).riding, true, 'two in a row is');
  assert.equal(ride.update(null, at(1)).riding, true, 'no speed reading changes nothing');
  for (let i = 0; i < 10; i++) assert.equal(ride.update(0, at(1)).riding, true, 'waiting at a stop, still on board');
  assert.equal(ride.update(1.2, at(4)).riding, true);
  assert.equal(ride.update(1.3, at(4)).riding, true);
  assert.equal(ride.update(0, at(4)).riding, true, 'a pause while walking off');
  assert.equal(ride.update(1.2, at(4)).riding, true);
  const off = ride.update(1.1, at(4));
  assert.deepEqual(off, { riding: false, alighted: true }, 'walking pace for over 12 s: got off');
  assert.deepEqual(ride.update(1, at(1)), { riding: false, alighted: false }, 'alighted is reported once');
  console.log('ok: ride detector');
}

// ── a vehicle crawling through traffic is still a ride
{
  const ride = createRideDetector();
  let t = 0;
  ride.update(8, (t += 1000));
  ride.update(8, (t += 1000));
  for (let i = 0; i < 6; i++) assert.equal(ride.update(1.5, (t += 1000)).riding, true, 'a few seconds at walking pace');
  ride.update(6, (t += 1000)); // speeds up again: the walking run starts over
  for (let i = 0; i < 12; i++) assert.equal(ride.update(1.2, (t += 1000)).riding, true, 'under 12 s'); // first to last: 11 s
  assert.equal(ride.update(1.2, (t += 1000)).alighted, true, '12 s of walking pace');
  console.log('ok: traffic');
}

// ── a trip restored mid-ride carries on riding
{
  const ride = createRideDetector({ riding: true });
  assert.equal(ride.riding, true);
  assert.equal(ride.update(8, 1000).riding, true);
  console.log('ok: restored ride');
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

// ── route profile by mode and speed
{
  assert.equal(routeProfile('walk', false, false), 'foot-walking');
  assert.equal(routeProfile('walk', true, false), 'driving-car', 'walk: hopped on a keke');
  assert.equal(routeProfile('walk', false, true), 'foot-walking', 'walk: got off');
  assert.equal(routeProfile('walk', true, true), 'driving-car', 'walk: riding again');
  for (const [mode, vehicle] of [['keke', 'driving-car'], ['car', 'driving-car']]) {
    assert.equal(routeProfile(mode, false, false), vehicle, `${mode}: before setting off`);
    assert.equal(routeProfile(mode, true, false), vehicle);
    assert.equal(routeProfile(mode, false, true), 'foot-walking', `${mode}: got off / parked`);
    assert.equal(routeProfile(mode, true, true), vehicle, `${mode}: riding again`);
  }
  assert.equal(routeProfile('shuttle', false, false), 'driving-car');
  assert.equal(routeProfile('shuttle', false, true), 'foot-walking');
  assert.equal(routeProfile('shuttle', true, true), 'foot-walking', 'shuttle: walking for good once off');
  assert.equal(routeProfile('bike', true, true), 'cycling-regular');
  console.log('ok: route profile');
}

// ── speed from positions, for phones that don't report it
{
  const a = { lat: 7.3, lng: 5.138, accuracy: 10, at: 0 };
  const b = { lat: 7.3009, lng: 5.138, accuracy: 10, at: 10000 }; // ~100 m in 10 s
  const v = speedBetween(a, b);
  assert.ok(Math.abs(v - 10) < 0.5, `~10 m/s, got ${v}`);
  assert.equal(speedBetween(null, a), null);
  assert.equal(speedBetween(a, { ...a, at: 500 }), null, 'too close together');
  assert.equal(speedBetween(a, { ...a, at: 60000 }), null, 'too far apart');
  assert.equal(speedBetween(b, a), null, 'out of order');
  assert.equal(speedBetween(a, { ...b, accuracy: 30 }), null, 'too rough: jitter could look like a vehicle');
  assert.equal(speedBetween(a, { ...b, accuracy: undefined }), null, 'accuracy unknown');
  // Speed from positions alone is enough to start and end a ride.
  const ride = createRideDetector();
  let prev = a;
  const step = (metres, secs) => {
    const next = { lat: prev.lat + metres / 111000, lng: prev.lng, accuracy: 10, at: prev.at + secs * 1000 };
    const r = ride.update(speedBetween(prev, next), next.at);
    prev = next;
    return r;
  };
  step(60, 5);
  assert.equal(step(60, 5).riding, true, 'keke at ~43 km/h');
  for (let i = 0; i < 3; i++) step(6, 5);
  assert.equal(step(6, 5).alighted, true, 'walking off at ~4 km/h');
  console.log('ok: speed from positions');
}
