// Run: node scripts/pushRules.test.mjs
import assert from 'node:assert/strict';
import { buildPayload, decide, inQuietHours, isApplePush, lagosHour, urgencyFor } from '../supabase/functions/_shared/pushRules.js';

const HOUR = 3600 * 1000;
// 10 Nov 2026, 12:00 Lagos (11:00 UTC).
const noon = Date.UTC(2026, 10, 10, 11);
const iso = (ms) => new Date(ms).toISOString();

// Lagos is UTC+1.
assert.equal(lagosHour(noon), 12);
assert.equal(lagosHour(Date.UTC(2026, 10, 10, 23)), 0);

// Quiet hours: 22:00–06:59 Lagos.
assert.equal(inQuietHours(Date.UTC(2026, 10, 10, 20, 59)), false); // 21:59
assert.equal(inQuietHours(Date.UTC(2026, 10, 10, 21)), true); // 22:00
assert.equal(inQuietHours(Date.UTC(2026, 10, 11, 5, 59)), true); // 06:59
assert.equal(inQuietHours(Date.UTC(2026, 10, 11, 6)), false); // 07:00

// Review reminder: sends in the day, waits at night, then expires.
const review = { kind: 'review', created_at: iso(noon - HOUR) };
assert.equal(decide(review, { now: noon }), 'send');
assert.equal(decide(review, { now: Date.UTC(2026, 10, 10, 22) }), 'wait'); // 23:00 Lagos
assert.equal(decide(review, { now: noon + 3 * 24 * HOUR }), 'skip:expired');

// Switched off → never sent.
assert.equal(decide(review, { now: noon, prefs: { reviews: false } }), 'skip:switched-off');
assert.equal(decide(review, { now: noon, prefs: { weekly: false } }), 'send');

// One review reminder a day.
assert.equal(decide(review, { now: noon, lastReviewSentAt: iso(noon - 5 * HOUR) }), 'wait');
assert.equal(decide(review, { now: noon, lastReviewSentAt: iso(noon - 25 * HOUR) }), 'send');

// Admin alerts can't be switched off; the test ping ignores quiet hours.
assert.equal(decide({ kind: 'admin', created_at: iso(noon) }, { now: noon, prefs: { weekly: false, reviews: false } }), 'send');
const midnight = Date.UTC(2026, 10, 10, 23);
assert.equal(decide({ kind: 'test', created_at: iso(midnight) }, { now: midnight }), 'send');
assert.equal(decide({ kind: 'test', created_at: iso(noon) }, { now: midnight }), 'skip:expired');
assert.equal(decide({ kind: 'nope', created_at: iso(noon) }, { now: noon }), 'skip:unknown-kind');

// iPhone titles get the emoji; Chrome gets icon + picture instead.
assert.equal(isApplePush('https://web.push.apple.com/QGx'), true);
assert.equal(isApplePush('https://fcm.googleapis.com/fcm/send/x'), false);
assert.equal(isApplePush('not a url'), false);
const row = { kind: 'review', title: 'How was Campus Cuts?', body: 'b', url: '/map?open=review:1', image: 'https://x/y.jpg', actions: [{ action: 'rate', title: 'Rate now' }, { action: 'later', title: 'Not now' }, { action: 'x', title: 'x' }] };
const apple = JSON.parse(buildPayload(row, 'https://web.push.apple.com/a'));
const chrome = JSON.parse(buildPayload(row, 'https://fcm.googleapis.com/fcm/send/a'));
assert.equal(apple.title, '⭐ How was Campus Cuts?');
assert.equal(chrome.title, 'How was Campus Cuts?');
assert.equal(chrome.icon, '/push/review.png');
assert.equal(chrome.actions.length, 2);
assert.equal(JSON.parse(buildPayload({ kind: 'weekly', title: 't' }, 'https://x.y/z')).url, '/map');

// Admin preview: looks like the round-up, sent now, never switched off.
const preview = { kind: 'preview', title: 'Your week on campus', created_at: iso(midnight) };
assert.equal(decide(preview, { now: midnight, prefs: { weekly: false } }), 'send');
assert.equal(JSON.parse(buildPayload(preview, 'https://fcm.googleapis.com/x')).icon, '/push/weekly.png');
assert.equal(JSON.parse(buildPayload(preview, 'https://web.push.apple.com/x')).title, '📍 Your week on campus');

// Never "low" urgency (phones may hold those until charging).
assert.equal(urgencyFor('weekly'), 'normal');
assert.equal(urgencyFor('admin'), 'normal');
assert.equal(urgencyFor('preview'), 'high');
assert.equal(urgencyFor('test'), 'high');

console.log('pushRules tests passed');
