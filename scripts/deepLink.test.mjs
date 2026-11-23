// Run: node scripts/deepLink.test.mjs
import assert from 'node:assert/strict';
import { openTargetFromUrl, parseOpenTarget, withoutOpenParam } from '../src/features/notifications/deepLink.js';

assert.deepEqual(parseOpenTarget('review:wp_12'), { kind: 'review', id: 'wp_12' });
assert.deepEqual(parseOpenTarget('place:osm:a:b'), { kind: 'place', id: 'osm:a:b' });
assert.deepEqual(parseOpenTarget('explore'), { kind: 'explore' });
assert.deepEqual(parseOpenTarget('admin'), { kind: 'admin' });
assert.equal(parseOpenTarget('review:'), null);
assert.equal(parseOpenTarget('logout'), null);
assert.equal(parseOpenTarget(null), null);

assert.deepEqual(openTargetFromUrl('/map?open=review%3A42'), { kind: 'review', id: '42' });
assert.deepEqual(openTargetFromUrl('https://mapsbyfuta.xyz/map?open=profile'), { kind: 'profile' });
assert.deepEqual(openTargetFromUrl('?open=explore'), { kind: 'explore' });
assert.equal(openTargetFromUrl('/map'), null);

assert.equal(withoutOpenParam('https://mapsbyfuta.xyz/map?open=admin&meet=AB12#x'), '/map?meet=AB12#x');
assert.equal(withoutOpenParam('https://mapsbyfuta.xyz/map?open=admin'), '/map');

console.log('deepLink tests passed');
