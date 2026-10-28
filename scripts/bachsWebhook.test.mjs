// Tests supabase/functions/bachs-webhook/handler.ts with an in-memory fake of
// the two tables it touches. No network, no BACHS, no real (or test) money:
// events are hand-built JSON signed with a throwaway secret.
//
// Run: node scripts/bachsWebhook.test.mjs   (Node >= 22.18 strips TS types)
import assert from 'node:assert/strict';
import { createHmac } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import path from 'node:path';

const handlerPath =
  process.env.HANDLER_PATH ?? 'supabase/functions/bachs-webhook/handler.ts';
const { createHandler } = await import(pathToFileURL(path.resolve(handlerPath)).href);

const SECRET = 'whsec_test_only';

// ── fake supabase-js (only the calls the webhook makes) ──────────────────
function makeDb({ promotions = [], faults = {}, beforeUpdate = null } = {}) {
  const tables = {
    promotions: promotions.map((p) => ({ ...p })),
    bachs_webhook_events: [],
  };
  const writes = []; // every attempted promotions update, for call-count asserts

  function builder(table) {
    const q = { op: null, values: null, filters: [], wantRows: false, single: false };
    const matches = (row) =>
      q.filters.every((f) => (f.kind === 'eq' ? row[f.col] === f.val : f.val.includes(row[f.col])));

    const run = () => {
      const fault = faults[`${table}.${q.op}`];
      if (fault) return { data: null, error: { message: fault, code: 'XX000' } };
      const rows = tables[table];
      if (q.op === 'insert') {
        if (rows.some((r) => r.id === q.values.id)) {
          return { data: null, error: { message: 'duplicate key', code: '23505' } };
        }
        rows.push({ ...q.values });
        return { data: null, error: null };
      }
      if (q.op === 'delete') {
        tables[table] = rows.filter((r) => !matches(r));
        return { data: null, error: null };
      }
      if (q.op === 'update') {
        writes.push({ table, values: q.values });
        if (beforeUpdate) beforeUpdate(tables); // simulate a concurrent change
        const hit = tables[table].filter(matches);
        hit.forEach((r) => Object.assign(r, q.values));
        return { data: q.wantRows ? hit.map((r) => ({ id: r.id })) : null, error: null };
      }
      // select
      const hit = rows.filter(matches);
      return { data: q.single ? (hit[0] ?? null) : hit, error: null };
    };

    const api = {
      insert(v) { q.op = 'insert'; q.values = v; return api; },
      update(v) { q.op = 'update'; q.values = v; return api; },
      delete() { q.op = 'delete'; return api; },
      select() { if (!q.op) q.op = 'select'; else q.wantRows = true; return api; },
      eq(col, val) { q.filters.push({ kind: 'eq', col, val }); return api; },
      in(col, val) { q.filters.push({ kind: 'in', col, val }); return api; },
      maybeSingle() { q.single = true; return api; },
      then(res, rej) { return Promise.resolve(run()).then(res, rej); },
    };
    return api;
  }
  return { tables, writes, client: { from: builder } };
}

// ── helpers ──────────────────────────────────────────────────────────────
const promo = (over = {}) => ({
  id: 'promo_1', amount: '5000.00', currency: 'NGN',
  payment_status: 'unpaid', status: 'draft', paid_at: null, bachs_payment_id: null, ...over,
});

const succeeded = (id = 'evt_1', over = {}) => ({
  id, type: 'collection.succeeded', created_at: new Date().toISOString(),
  data: { id: 'col_1', status: 'SUCCEEDED', amount: '5000.00', currency: 'NGN',
          metadata: { promotion_id: 'promo_1' }, ...over },
});
const checkoutDone = (id = 'evt_2') => ({
  id, type: 'checkout.completed',
  data: { id: 'chk_1', payment_status: 'paid', amount: '5000.00', currency: 'NGN',
          charge: { amount: '5000.00', currency: 'NGN' }, metadata: { promotion_id: 'promo_1' } },
});
const expired = (id = 'evt_x') => ({ id, type: 'checkout.expired', data: { metadata: { promotion_id: 'promo_1' } } });
const failed = (id = 'evt_f') => ({ id, type: 'collection.failed', data: { metadata: { promotion_id: 'promo_1' } } });

function setup(opts) {
  const db = makeDb(opts);
  const handler = createHandler({
    createClient: () => db.client,
    env: { get: (k) => ({ BACHS_WEBHOOK_SECRET: SECRET, SUPABASE_URL: 'http://fake', SUPABASE_SERVICE_ROLE_KEY: 'fake' })[k] },
  });
  const send = (event, { secret = SECRET, ts = Math.floor(Date.now() / 1000) } = {}) => {
    const body = JSON.stringify(event);
    const sig = createHmac('sha256', secret).update(`${ts}.${body}`).digest('hex');
    return handler(new Request('http://x/bachs-webhook', {
      method: 'POST',
      headers: { 'X-Bachs-Timestamp': String(ts), 'X-Bachs-Signature': sig },
      body,
    }));
  };
  return { db, send, row: () => db.tables.promotions[0] };
}

// ── harness ──────────────────────────────────────────────────────────────
const origErr = console.error, origWarn = console.warn;
let failures = 0;
async function test(name, fn) {
  const logs = { error: [], warn: [] };
  console.error = (...a) => logs.error.push(a.join(' '));
  console.warn = (...a) => logs.warn.push(a.join(' '));
  try { await fn(logs); console.log(`  ok   ${name}`); }
  catch (e) { failures++; console.log(`  FAIL ${name}\n       ${e.message.split('\n')[0]}`); }
  finally { console.error = origErr; console.warn = origWarn; }
}
const status = async (res) => res.status;

// ── happy path / idempotency ─────────────────────────────────────────────
await test('unpaid → paid on collection.succeeded', async () => {
  const t = setup({ promotions: [promo()] });
  assert.equal(await status(await t.send(succeeded())), 200);
  assert.equal(t.row().payment_status, 'paid');
  assert.equal(t.row().status, 'pending_review');
  assert.equal(t.row().bachs_payment_id, 'col_1');
});

await test('replayed event id is a no-op (200, one write only)', async () => {
  const t = setup({ promotions: [promo()] });
  await t.send(succeeded('evt_1'));
  const res = await t.send(succeeded('evt_1'));
  assert.equal(res.status, 200);
  assert.equal(await res.text(), 'Already processed');
  assert.equal(t.db.writes.length, 1);
});

await test('sibling events for one payment: second is a quiet no-op, not an error', async (logs) => {
  const t = setup({ promotions: [promo()] });
  await t.send(succeeded('evt_1'));
  const paidAt = t.row().paid_at;
  assert.equal(await status(await t.send(checkoutDone('evt_2'))), 200);
  assert.equal(t.row().paid_at, paidAt, 'paid_at must not be rewritten');
  assert.equal(logs.error.length, 0, `unexpected errors: ${logs.error}`);
});

// ── the fixed bugs ───────────────────────────────────────────────────────
await test('late success RESCUES a row already marked expired', async (logs) => {
  const t = setup({ promotions: [promo({ payment_status: 'expired' })] });
  assert.equal(await status(await t.send(succeeded())), 200);
  assert.equal(t.row().payment_status, 'paid');
  assert.ok(logs.warn.some((l) => l.includes('late payment rescued')));
});

await test('late success RESCUES a row already marked failed', async () => {
  const t = setup({ promotions: [promo({ payment_status: 'failed' })] });
  assert.equal(await status(await t.send(succeeded())), 200);
  assert.equal(t.row().payment_status, 'paid');
});

await test('expire event then late success end-to-end', async () => {
  const t = setup({ promotions: [promo()] });
  await t.send(expired('evt_x'));
  assert.equal(t.row().payment_status, 'expired');
  await t.send(succeeded('evt_1'));
  assert.equal(t.row().payment_status, 'paid');
});

await test('paid-update DB error → 500, dedupe row released, nothing marked paid', async (logs) => {
  const t = setup({ promotions: [promo()], faults: { 'promotions.update': 'connection reset' } });
  const res = await t.send(succeeded('evt_1'));
  assert.equal(res.status, 500);
  assert.equal(t.db.tables.bachs_webhook_events.length, 0, 'dedupe row must be released');
  assert.equal(t.row().payment_status, 'unpaid');
  assert.ok(logs.error.some((l) => l.includes('paid-update failed')));

});

await test('retry of the same event id after a transient failure is processed (same db)', async () => {
  const faults = { 'promotions.update': 'blip' };
  const t = setup({ promotions: [promo()], faults });
  assert.equal(await status(await t.send(succeeded('evt_1'))), 500);
  delete faults['promotions.update']; // DB recovers
  assert.equal(await status(await t.send(succeeded('evt_1'))), 200);
  assert.equal(t.row().payment_status, 'paid');
});

await test('0-row update (row changed after lookup) → 500 + released, logged', async (logs) => {
  // Row is 'unpaid' at lookup, then flips to 'paid' just before the update
  // runs, so the .in() guard matches nothing.
  const t = setup({
    promotions: [promo()],
    beforeUpdate: (tables) => { tables.promotions[0].payment_status = 'paid'; },
  });
  const res = await t.send(succeeded('evt_1'));
  assert.equal(res.status, 500);
  assert.equal(t.db.tables.bachs_webhook_events.length, 0);
  assert.ok(logs.error.some((l) => l.includes('matched 0 rows')));
});

await test('failed/expired update DB error → 500 + released', async () => {
  const t = setup({ promotions: [promo()], faults: { 'promotions.update': 'blip' } });
  assert.equal(await status(await t.send(failed('evt_f'))), 500);
  assert.equal(t.db.tables.bachs_webhook_events.length, 0);
});

await test('lookup error still releases dedupe row (existing behaviour kept)', async () => {
  const t = setup({ promotions: [promo()], faults: { 'promotions.select': 'blip' } });
  assert.equal(await status(await t.send(succeeded())), 500);
  assert.equal(t.db.tables.bachs_webhook_events.length, 0);
});

// ── guards that must NOT regress ─────────────────────────────────────────
await test('failure/expiry event can never downgrade a paid row', async () => {
  const t = setup({ promotions: [promo({ payment_status: 'paid' })] });
  await t.send(failed('evt_f'));
  await t.send(expired('evt_x'));
  assert.equal(t.row().payment_status, 'paid');
});

await test('underpaid amount is NOT marked paid and returns 200 (retry cannot help)', async (logs) => {
  const t = setup({ promotions: [promo()] });
  assert.equal(await status(await t.send(succeeded('evt_1', { amount: '100.00' }))), 200);
  assert.equal(t.row().payment_status, 'unpaid');
  assert.ok(logs.error.some((l) => l.includes('amount check failed')));
});

await test('wrong currency is NOT marked paid', async () => {
  const t = setup({ promotions: [promo()] });
  await t.send(succeeded('evt_1', { currency: 'USD' }));
  assert.equal(t.row().payment_status, 'unpaid');
});

await test('overpaid is accepted', async () => {
  const t = setup({ promotions: [promo()] });
  await t.send(succeeded('evt_1', { status: 'OVERPAID', received_amount: '5200.00' }));
  assert.equal(t.row().payment_status, 'paid');
});

await test('bad signature → 400 and nothing written', async () => {
  const t = setup({ promotions: [promo({ payment_status: 'expired' })] });
  const res = await t.send(succeeded(), { secret: 'attacker' });
  assert.equal(res.status, 400);
  assert.equal(t.row().payment_status, 'expired');
  assert.equal(t.db.tables.bachs_webhook_events.length, 0);
});

await test('stale timestamp → 400', async () => {
  const t = setup({ promotions: [promo()] });
  const res = await t.send(succeeded(), { ts: Math.floor(Date.now() / 1000) - 3600 });
  assert.equal(res.status, 400);
});

await test('unknown promotion → 200, nothing written', async () => {
  const t = setup({ promotions: [] });
  assert.equal(await status(await t.send(succeeded())), 200);
  assert.equal(t.db.writes.length, 0);
});

if (failures) { console.log(`\n${failures} failed`); process.exit(1); }
console.log('\nall bachs-webhook tests passed');
