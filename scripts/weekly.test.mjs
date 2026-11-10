// Run: node scripts/weekly.test.mjs
import assert from 'node:assert/strict';
import { nextDigestDate, previewDigest } from '../src/features/notifications/weekly.js';

// Tue 10 Nov 2026 → Sun 15 Nov.
assert.equal(nextDigestDate(Date.UTC(2026, 10, 10, 9)), '2026-11-15');
// Sunday 15 Nov, 17:59 Lagos (16:59 UTC) → today; 18:00 Lagos → next week.
assert.equal(nextDigestDate(Date.UTC(2026, 10, 15, 16, 59)), '2026-11-15');
assert.equal(nextDigestDate(Date.UTC(2026, 10, 15, 17, 0)), '2026-11-22');
// Saturday 23:30 UTC is already Sunday 00:30 in Lagos.
assert.equal(nextDigestDate(Date.UTC(2026, 10, 14, 23, 30)), '2026-11-15');

// Quiet week: nothing.
assert.equal(previewDigest({}), null);

// Only places / only events: specific titles.
assert.deepEqual(previewDigest({ places: 4 }), { title: '4 new places on campus this week', body: '4 new places' });
assert.deepEqual(previewDigest({ events: 1 }), { title: '1 event on campus this week', body: '1 event this week' });

// Mixed, with a normal announcement.
assert.deepEqual(previewDigest({ places: 4, events: 3, ann: { title: 'Freshers: find your lecture halls' } }), {
  title: 'Your week on campus',
  body: '4 new places · 3 events this week · Freshers: find your lecture halls',
});

// Lead announcement takes the title; its message (or the counts) the body.
assert.deepEqual(previewDigest({ places: 2, ann: { title: 'Exams start Monday', body: 'Find every hall on the map', lead: true } }), {
  title: 'Exams start Monday',
  body: 'Find every hall on the map',
});
assert.deepEqual(previewDigest({ places: 2, ann: { title: 'Exams start Monday', body: ' ', lead: true } }).body, '2 new places');

// Lead place.
assert.deepEqual(previewDigest({ places: 4, events: 1, leadName: 'Albert Ilemobade Library' }), {
  title: 'Albert Ilemobade Library is on the map, plus 3 more',
  body: '4 new places · 1 event this week',
});
assert.equal(previewDigest({ places: 1, leadName: 'SEET Lab 2' }).title, 'SEET Lab 2 is on the map');

console.log('weekly tests passed');
