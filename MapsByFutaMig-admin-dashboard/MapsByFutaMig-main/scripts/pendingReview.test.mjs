// Tests for src/features/reviews/pendingReview.js (delayed "Rate your
// visit" prompt). Run: node scripts/pendingReview.test.mjs
import assert from 'node:assert/strict';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k),
};

const { rememberVisit, checkPendingReview, clearPendingReview, REVIEW_DELAY_MS, REVIEW_EXPIRY_MS } = await import(
  '../src/features/reviews/pendingReview.js'
);

const salon = { id: 42, name: 'Niche Barbing Salon', type: 'shop', lat: 7.29, lng: 5.13 };
const t0 = 1_000_000_000_000;

// ── not asked straight away, asked once the delay has passed
{
  rememberVisit(salon, t0);
  const early = checkPendingReview(t0 + REVIEW_DELAY_MS - 1);
  assert.equal(early.dest, null, 'not due before the delay');
  assert.equal(early.dueAt, t0 + REVIEW_DELAY_MS, 'reports when it will be due');
  assert.deepEqual(checkPendingReview(t0 + REVIEW_DELAY_MS).dest, { id: 42, name: 'Niche Barbing Salon', type: 'shop' });
  console.log('ok: review is due only after the delay');
}

// ── the latest visit replaces the previous one; clearing ends it
{
  rememberVisit({ id: 7, name: 'Food Bolt', type: 'food' }, t0 + 10);
  assert.equal(checkPendingReview(t0 + 10 + REVIEW_DELAY_MS).dest.id, 7, 'latest visit wins');
  clearPendingReview();
  assert.equal(checkPendingReview(t0 + REVIEW_EXPIRY_MS).dest, null, 'cleared');
  console.log('ok: latest visit wins, clearing removes it');
}

// ── expires and is cleaned up
{
  rememberVisit(salon, t0);
  assert.equal(checkPendingReview(t0 + REVIEW_EXPIRY_MS + 1).dest, null, 'expired');
  assert.equal(store.size, 0, 'expired entry removed from storage');
  console.log('ok: old visits expire');
}

// ── places without an id (map taps, internet results) are never stored
{
  rememberVisit({ name: 'Somewhere', type: 'shop' }, t0);
  assert.equal(store.size, 0);
  console.log('ok: no id, no prompt');
}

// ── broken / unavailable storage never throws
{
  store.set('futa_pending_review_v1', '{not json');
  assert.equal(checkPendingReview(t0).dest, null, 'corrupt entry ignored');
  const saved = globalThis.localStorage;
  globalThis.localStorage = { getItem() { throw new Error('blocked'); }, setItem() { throw new Error('blocked'); }, removeItem() { throw new Error('blocked'); } };
  assert.doesNotThrow(() => rememberVisit(salon, t0));
  assert.equal(checkPendingReview(t0 + REVIEW_DELAY_MS).dest, null);
  assert.doesNotThrow(() => clearPendingReview());
  globalThis.localStorage = saved;
  console.log('ok: storage failures are silent');
}
