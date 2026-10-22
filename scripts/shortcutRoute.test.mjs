// Tests for src/features/navigation/shortcutRoute.js (routing through
// approved footpaths). Run: node scripts/shortcutRoute.test.mjs
import assert from 'node:assert/strict';
import { walkablePaths, pickShortcuts, stitchRoute, isOnPath } from '../src/features/navigation/shortcutRoute.js';
import { startDirection, stepInstruction } from '../src/features/navigation/turnHelpers.js';

// ~110 m per 0.001° near FUTA (7.3°N). Base route: ~330 m east, then ~330 m north.
const base = {
  coords: [[7.298, 5.138], [7.298, 5.141], [7.301, 5.141]],
  distance: 662,
  duration: 662 / 1.4,
  steps: [],
};
const seg = (id, category, pts) => ({ id, name: `Path ${id}`, category, points: pts.map(([lat, lng]) => ({ lat, lng })) });

// Diagonal across the corner, near both ends of the route.
const diagonal = [[7.2981, 5.1381], [7.2995, 5.1395], [7.3009, 5.1409]];
// Runs alongside the route ~5 m off it: no real saving, like GPS jitter.
const alongside = [[7.29805, 5.1385], [7.29805, 5.1395]];
// Well away from the route.
const far = [[7.31, 5.15], [7.311, 5.151]];

// ── which segments count as paths
{
  const paths = walkablePaths([
    seg(1, 'shortcut', diagonal),
    seg(2, 'footpath', alongside),
    seg(3, 'road', diagonal),
    seg(4, 'indoor', diagonal),
    seg(5, 'shortcut', [[7.3, 5.14]]),
  ]);
  assert.deepEqual(paths.map((p) => p.id), [1, 2], 'only footpaths/shortcuts with 2+ points');
  assert.ok(Math.abs(paths[0].length - 437) < 10, `diagonal length ≈ 437 m, got ${paths[0].length}`);
  assert.deepEqual(walkablePaths(undefined), [], 'no segments loaded yet');
  console.log('ok: walkablePaths');
}

// ── picking shortcuts
{
  const paths = walkablePaths([seg(1, 'shortcut', diagonal), seg(2, 'footpath', alongside), seg(3, 'shortcut', far)]);
  const picks = pickShortcuts(base, paths);
  assert.deepEqual(picks.map((p) => p.id), [1], 'only the corner-cutting path is worth trying');
  assert.ok(picks[0].saving > 150, `diagonal saves ~180 m, got ${picks[0].saving}`);
  assert.deepEqual(picks[0].coords[0], diagonal[0], 'already in travel direction');

  const reversed = pickShortcuts(base, walkablePaths([seg(1, 'shortcut', [...diagonal].reverse())]));
  assert.deepEqual(reversed[0].coords[0], diagonal[0], 'a path recorded the other way is flipped');

  assert.deepEqual(pickShortcuts(base, paths, { maxEntry: 5 }), [], 'ends too far from the route');
  const many = walkablePaths([1, 2, 3].map((id) => seg(id, 'shortcut', diagonal)));
  assert.equal(pickShortcuts(base, many).length, 2, 'capped at MAX_SHORTCUTS');
  console.log('ok: pickShortcuts');
}

// ── stitching
{
  const leg = (coords, name = '') => ({
    coords,
    distance: 15,
    duration: 11,
    steps: [
      { type: 'depart', instruction: 'Head off', name, distance: 15, location: coords[0] },
      { type: 'arrive', instruction: 'You have arrived at your destination', location: coords[coords.length - 1] },
    ],
  });
  const [shortcut] = pickShortcuts(base, walkablePaths([seg(1, 'shortcut', diagonal)]));
  // Walking east onto a north-east path, then off it heading north.
  const legA = leg([[7.2981, 5.1371], [7.2981, 5.1381]]);
  const legB = leg([[7.3009, 5.1409], [7.3019, 5.1409]], 'Senate Road');
  const route = stitchRoute(legA, shortcut, legB, 1 / 1.4);
  assert.ok(route.distance < base.distance, `stitched ${route.distance} m beats ${base.distance} m`);
  assert.ok(Math.abs(route.duration - (22 + (route.distance - 30) / 1.4)) < 1e-6, 'path walked at the base pace');
  assert.equal(route.coords.length, 7, 'leg A + path + leg B');
  assert.deepEqual(
    route.steps.map((s) => s.instruction),
    ['Head off', 'Turn slightly left', 'Turn slightly left onto Senate Road', 'You have arrived at your destination'],
    'normal turn instructions; one depart and one arrive for the whole trip'
  );

  // Straight on to a straight path: nothing extra to announce.
  const straight = stitchRoute(leg([[7.2980, 5.1380], [7.2981, 5.1381]]), shortcut, leg([[7.3009, 5.1409], [7.3010, 5.1410]]), 1 / 1.4);
  assert.deepEqual(straight.steps.map((s) => s.type), ['depart', 'continue', 'arrive'], 'no turn onto the path');

  // A bend in the middle of the path is announced like a road junction.
  const [bent] = pickShortcuts(
    { ...base, coords: [[7.298, 5.138], [7.302, 5.138], [7.302, 5.142]] },
    walkablePaths([seg(2, 'shortcut', [[7.2981, 5.1381], [7.2981, 5.1395], [7.3019, 5.1395], [7.3019, 5.1405]])]),
    { minSaving: -Infinity }
  );
  const bentRoute = stitchRoute(leg([[7.2981, 5.1371], [7.2981, 5.1381]]), bent, leg([[7.3019, 5.1405], [7.3019, 5.1415]]), 1 / 1.4);
  assert.deepEqual(
    bentRoute.steps.map((s) => s.instruction),
    ['Head off', 'Turn left', 'Turn right', 'Continue straight', 'You have arrived at your destination'],
    'east → north (left) → east (right) → straight off the path'
  );
  console.log('ok: stitchRoute');
}

// ── first instruction: no compass words, relative turns once moving
{
  assert.equal(stepInstruction({ maneuver: { type: 'depart', bearing_after: 0 } }), 'Follow the route on the map');
  assert.equal(stepInstruction({ maneuver: { type: 'depart' }, name: 'Senate Road' }), 'Follow the route along Senate Road');
  assert.equal(startDirection(10, 350).instruction, 'Go straight ahead', 'small difference across north');
  assert.equal(startDirection(0, 90).instruction, 'Turn right');
  assert.equal(startDirection(90, 0).instruction, 'Turn left');
  assert.equal(startDirection(0, 180).instruction, 'Turn around');
  console.log('ok: start directions');
}

// ── on a path
{
  const paths = walkablePaths([seg(1, 'shortcut', diagonal)]);
  assert.equal(isOnPath(paths, 7.2995, 5.1395), true, 'on the path');
  assert.equal(isOnPath(paths, 7.2996, 5.1394), true, '~15 m off still counts');
  assert.equal(isOnPath(paths, 7.2985, 5.1405), false, 'well off it');
  assert.equal(isOnPath([], 7.2995, 5.1395), false, 'no paths');
  console.log('ok: isOnPath');
}
