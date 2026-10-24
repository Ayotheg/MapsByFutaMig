// Tests for supabase/functions/bachs-webhook/handler.ts against an in-memory
// fake database: promotion payments, event listing fees, duplicates, short
// payments, expiry + late rescue, and the double-payment warning.
// Run: node scripts/bachsWebhook.test.mjs
//
// handler.ts has no TypeScript-only syntax, so it's copied to a temporary
// .mjs and imported as plain JavaScript (no Deno needed).
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { copyFileSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const dir = mkdtempSync(join(tmpdir(), 'bachs-webhook-'));
const copy = join(dir, 'handler.mjs');
copyFileSync(new URL('../supabase/functions/bachs-webhook/handler.ts', import.meta.url), copy);
const { createHandler } = await import(pathToFileURL(copy).href);
rmSync(dir, { recursive: true, force: true });

const SECRET = 'whsec_test';

const db = {
  bachs_webhook_events: [],
  promotions: [{ id: 'promo-1', amount: '400.00', currency: 'NGN', payment_status: 'unpaid', status: 'awaiting_payment' }],
  events: ['ev-1', 'ev-2', 'ev-3'].map((id) => ({
    id,
    listing_fee: '3000.00',
    currency: 'NGN',
    payment_status: 'unpaid',
    status: 'awaiting_payment',
    bachs_payment_id: null,
  })),
};

// Just enough of the supabase-js query builder for handler.ts.
function query(table) {
  const filters = [];
  let op = 'select';
  let payload = null;
  let wantRows = false;
  const q = {
    select() { wantRows = true; return q; },
    insert(row) { op = 'insert'; payload = row; return q; },
    update(p) { op = 'update'; payload = p; return q; },
    delete() { op = 'delete'; return q; },
    eq(c, v) { filters.push((r) => r[c] === v); return q; },
    in(c, vs) { filters.push((r) => vs.includes(r[c])); return q; },
    maybeSingle() { return run().then((res) => ({ ...res, data: res.data?.[0] ?? null })); },
    then(ok, bad) { return run().then(ok, bad); },
  };
  async function run() {
    const rows = db[table];
    if (op === 'insert') {
      if (rows.some((r) => r.id === payload.id)) return { error: { code: '23505', message: 'duplicate' } };
      rows.push({ ...payload });
      return { error: null };
    }
    const hit = rows.filter((r) => filters.every((f) => f(r)));
    if (op === 'update') hit.forEach((r) => Object.assign(r, payload));
    if (op === 'delete') db[table] = rows.filter((r) => !hit.includes(r));
    return { data: wantRows || op === 'select' ? hit.map((r) => ({ ...r })) : null, error: null };
  }
  return q;
}

const handler = createHandler({
  createClient: () => ({ from: query }),
  env: { get: (k) => ({ BACHS_WEBHOOK_SECRET: SECRET, SUPABASE_URL: 'x', SUPABASE_SERVICE_ROLE_KEY: 'y' })[k] },
});

async function send(body, { sign = true } = {}) {
  const raw = JSON.stringify(body);
  const ts = String(Math.floor(Date.now() / 1000));
  const headers = { 'X-Bachs-Timestamp': ts };
  if (sign) headers['X-Bachs-Signature'] = createHmac('sha256', SECRET).update(`${ts}.${raw}`).digest('hex');
  const res = await handler(new Request('http://webhook.test', { method: 'POST', body: raw, headers }));
  return { status: res.status, text: await res.text() };
}

// Quiet the handler's own logging; keep a copy to assert on.
const logged = [];
for (const level of ['error', 'warn']) console[level] = (...args) => logged.push([level, ...args]);

const paid = (amount, id) => ({ id, status: 'SUCCEEDED', amount, currency: 'NGN' });
const row = (t, id) => db[t].find((r) => r.id === id);

// ── unsigned requests are refused
assert.equal((await send({ id: 'x', type: 'collection.succeeded' }, { sign: false })).status, 400);

// ── a promotion payment still works as before
await send({ id: 'e1', type: 'collection.succeeded', data: { ...paid('400.00', 'pay-p1'), reference: 'promo-1', metadata: { promotion_id: 'promo-1' } } });
assert.equal(row('promotions', 'promo-1').payment_status, 'paid');
assert.equal(row('promotions', 'promo-1').status, 'pending_review');

// ── an event listing fee, found by metadata.event_id
await send({ id: 'e2', type: 'collection.succeeded', data: { ...paid('3000.00', 'pay-1'), metadata: { event_id: 'ev-1' } } });
assert.equal(row('events', 'ev-1').payment_status, 'paid');
assert.equal(row('events', 'ev-1').status, 'pending_review');
assert.equal(row('events', 'ev-1').bachs_payment_id, 'pay-1');
assert.equal(row('promotions', 'promo-1').payment_status, 'paid', 'event payments never touch promotions');

// ── the same delivery twice is a no-op
assert.equal((await send({ id: 'e2', type: 'collection.succeeded', data: { ...paid('3000.00', 'pay-1'), metadata: { event_id: 'ev-1' } } })).text, 'Already processed');

// ── short payment (found by the "event:" reference only) is not marked paid
await send({ id: 'e3', type: 'collection.succeeded', data: { ...paid('2999.00', 'pay-2'), reference: 'event:ev-2' } });
assert.equal(row('events', 'ev-2').payment_status, 'unpaid');

// ── wrong currency is not marked paid
await send({ id: 'e3b', type: 'collection.succeeded', data: { id: 'pay-2b', status: 'SUCCEEDED', amount: '3000.00', currency: 'UGX', reference: 'event:ev-2' } });
assert.equal(row('events', 'ev-2').payment_status, 'unpaid');

// ── checkout.completed shape, reference only, with a retry's attempt suffix
await send({ id: 'e4', type: 'checkout.completed', data: { id: 'pay-3', payment_status: 'paid', charge: { amount: '3000.00', currency: 'NGN' }, reference: 'event:ev-2:lx3k9a' } });
assert.equal(row('events', 'ev-2').payment_status, 'paid');

// ── expiry, then a late success rescues it
await send({ id: 'e5', type: 'checkout.expired', data: { reference: 'event:ev-3' } });
assert.equal(row('events', 'ev-3').payment_status, 'expired');
await send({ id: 'e6', type: 'collection.succeeded', data: { ...paid('3000.00', 'pay-4'), metadata: { event_id: 'ev-3' } } });
assert.equal(row('events', 'ev-3').payment_status, 'paid');

// ── a SECOND payment for an already-paid event is flagged for a refund, not applied
logged.length = 0;
await send({ id: 'e7', type: 'collection.succeeded', data: { ...paid('3000.00', 'pay-5'), metadata: { event_id: 'ev-1' } } });
assert.equal(row('events', 'ev-1').bachs_payment_id, 'pay-1', 'first payment kept');
assert.ok(
  logged.some(([level, msg]) => level === 'error' && String(msg).includes('DOUBLE PAYMENT')),
  'double payment is logged'
);

// ── the sibling event of the same payment is not a double payment
logged.length = 0;
await send({ id: 'e8', type: 'checkout.completed', data: { id: 'pay-1', payment_status: 'paid', charge: { amount: '3000.00', currency: 'NGN' }, metadata: { event_id: 'ev-1' } } });
assert.ok(!logged.some(([, msg]) => String(msg).includes('DOUBLE PAYMENT')), 'same payment id is not flagged');

assert.equal(db.promotions.length, 1);
process.stdout.write('ok: bachs-webhook handles promotions and event listing fees\n');
