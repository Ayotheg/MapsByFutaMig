// Tests for src/features/explore/eventsData.js: event dates are Lagos time
// whatever the device's time zone, and only web links count as links.
// Run: node scripts/eventsData.test.mjs  (also try TZ=America/New_York)
import assert from 'node:assert/strict';

const { lagosInstant, lagosDayKey, lagosEndOfDay, filterEvents, dayOfMonth, monthShort, shortWhen, isWebLink } =
  await import('../src/features/explore/eventsData.js');

// ── a day + time picked in the form is that time in Lagos (UTC+1)
assert.equal(lagosInstant('2026-10-25', '10:00').toISOString(), '2026-10-25T09:00:00.000Z');
assert.equal(lagosInstant('2026-10-25', 'xx'), null);

// ── 23:30 UTC on the 24th is already the 25th in Lagos
const lateUtc = '2026-10-24T23:30:00.000Z';
assert.equal(lagosDayKey(lateUtc), '2026-10-25');
assert.equal(dayOfMonth(lateUtc), 25);
assert.equal(monthShort(lateUtc), 'OCT');
assert.equal(shortWhen(lateUtc), 'Sun · 12:30 AM');

// ── an event leaves Explore at the end of its Lagos day
assert.equal(lagosEndOfDay('2026-10-25T09:00:00.000Z').toISOString(), '2026-10-25T22:59:59.999Z');

// ── "Today" means today in Lagos
const now = new Date('2026-10-25T08:00:00.000Z');
const events = [
  { id: 'a', startsAt: '2026-10-25T18:00:00.000Z', price: 0 },
  { id: 'b', startsAt: '2026-10-25T23:30:00.000Z', price: 5000 }, // the 26th in Lagos
];
assert.deepEqual(filterEvents(events, 'today', now).map((e) => e.id), ['a']);
assert.deepEqual(filterEvents(events, 'paid', now).map((e) => e.id), ['b']);

// ── only http(s) links are links
assert.equal(isWebLink('https://chat.whatsapp.com/AbC123'), true);
assert.equal(isWebLink('http://example.com/x'), true);
assert.equal(isWebLink('javascript:alert(1)'), false);
assert.equal(isWebLink('data:text/html,hi'), false);
assert.equal(isWebLink('https://exa mple.com'), false);
assert.equal(isWebLink(null), false);

process.stdout.write('ok: event dates are Lagos time and only web links count\n');
