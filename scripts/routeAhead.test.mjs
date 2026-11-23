// Tests for src/features/navigation/routeAhead.js (route-up heading and the
// mid-trip "Nearby places" list). Run: node scripts/routeAhead.test.mjs
import assert from 'node:assert/strict';
import {
  cumulativeDistances,
  pointAlong,
  bearingBetween,
  headingAhead,
  placesAlong,
  startLandmark,
} from '../src/features/navigation/routeAhead.js';

// ~111 m per 0.001° of latitude near FUTA (7.3°N).
const A = [7.298, 5.138];
const north = [[7.298, 5.138], [7.299, 5.138], [7.3, 5.138]]; // heading north
const east = [[7.298, 5.138], [7.298, 5.139], [7.298, 5.14]]; // heading east
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// ── distances + interpolation
{
  const cum = cumulativeDistances(north);
  near(cum[2], 221, 2, 'two 0.001° steps north ≈ 221 m');
  const mid = pointAlong(north, cum, cum[1]);
  near(mid[0], 7.299, 1e-9, 'pointAlong at a vertex returns it');
  assert.deepEqual(pointAlong(north, cum, -5), north[0], 'clamped before start');
  assert.deepEqual(pointAlong(north, cum, 1e6), north[2], 'clamped past end');
  console.log('ok: cumulative distances and pointAlong');
}

// ── bearings
{
  near(bearingBetween(north[0], north[1]), 0, 0.5, 'north');
  near(bearingBetween(east[0], east[1]), 90, 0.5, 'east');
  near(bearingBetween(north[1], north[0]), 180, 0.5, 'south');
  near(headingAhead(east, cumulativeDistances(east), 50), 90, 0.5, 'headingAhead east');
  near(headingAhead(north, cumulativeDistances(north), 1e6), 0, 0.5, 'headingAhead past the end still points along the last stretch');
  console.log('ok: bearings and headingAhead');
}

// ── left / right relative to travel
{
  const cum = cumulativeDistances(north);
  const places = [
    { key: 'west', lat: 7.2985, lng: 5.1379 }, // ~11 m west of the road
    { key: 'east', lat: 7.2995, lng: 5.1381 }, // ~11 m east
    { key: 'far', lat: 7.2985, lng: 5.139 }, // ~110 m away
    { key: 'behind', lat: 7.2975, lng: 5.138 }, // before the start
    { key: 'noCoords', lat: null, lng: null },
  ];
  const found = placesAlong(north, cum, 0, cum[2], places);
  assert.deepEqual(found.map((f) => f.place.key), ['west', 'east'], 'nearest first, far/behind/no-coords dropped');
  assert.equal(found[0].side, 'left', 'west of a north-bound road is on the left');
  assert.equal(found[1].side, 'right', 'east of a north-bound road is on the right');

  const eastCum = cumulativeDistances(east);
  const [south] = placesAlong(east, eastCum, 0, eastCum[2], [{ key: 's', lat: 7.2979, lng: 5.1385 }]);
  assert.equal(south.side, 'right', 'south of an east-bound road is on the right');
  console.log('ok: left/right and filtering');
}

// ── repeated points (zero-length segment) must not decide the side
{
  const dup = [A, A, [7.299, 5.138]];
  const cum = cumulativeDistances(dup);
  const [hit] = placesAlong(dup, cum, 0, cum[2], [{ key: 'w', lat: 7.298, lng: 5.1379 }]);
  assert.equal(hit.side, 'left', 'place west of the start, heading north, is on the left');
  console.log('ok: zero-length segments are ignored');
}

// ── a place to walk towards at the start
{
  const cum = cumulativeDistances(north);
  const places = [
    { key: 'tooClose', name: 'Kiosk', lat: 7.2981, lng: 5.138, own: true }, // ~11 m ahead
    { key: 'noName', name: '', lat: 7.2983, lng: 5.138 }, // ~33 m ahead
    { key: 'osm', name: 'Shop', lat: 7.2985, lng: 5.1381 }, // ~55 m ahead
    { key: 'own', name: 'Library', lat: 7.2988, lng: 5.1381, own: true }, // ~88 m ahead
    { key: 'pastTurn', name: 'Senate', lat: 7.2995, lng: 5.138, own: true }, // beyond `to`
    { key: 'offRoute', name: 'Far Hall', lat: 7.2985, lng: 5.1395, own: true }, // ~165 m off the route
  ];
  const prefer = (p) => p.own;
  assert.equal(startLandmark(north, cum, 0, 150, places)?.place.name, 'Shop', 'nearest named place at least 20 m ahead');
  assert.equal(startLandmark(north, cum, 0, 150, places, { prefer })?.place.name, 'Library', 'own places beat nearer ones');
  assert.equal(startLandmark(north, cum, 0, 150, places.slice(0, 3), { prefer })?.place.name, 'Shop', 'falls back to any place');
  assert.equal(startLandmark(north, cum, 0, 100, [places[4]], { prefer }), null, 'nothing past the first turn');
  assert.equal(startLandmark(north, cum, 0, 150, [places[0], places[5]], { prefer }), null, 'nothing suitable');
  console.log('ok: startLandmark');
}

// ── range limits
{
  const cum = cumulativeDistances(north);
  assert.deepEqual(placesAlong(north, cum, 50, 50, [{ key: 'x', lat: 7.2985, lng: 5.138 }]), [], 'empty range');
  assert.deepEqual(placesAlong([A], [0], 0, 10, [{ key: 'x', lat: A[0], lng: A[1] }]), [], 'single-point route');
  const window = placesAlong(north, cum, 120, cum[2], [{ key: 'early', lat: 7.2985, lng: 5.1379 }]);
  assert.deepEqual(window, [], 'places before `from` are not listed');
  console.log('ok: range limits');
}
