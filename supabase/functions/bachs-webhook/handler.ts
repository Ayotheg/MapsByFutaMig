// ── supabase/functions/bachs-webhook/handler.ts ──────────────────────────
//
// The webhook's logic (see index.ts for the deploy notes and the
// signature-scheme caveat). Handles two kinds of payment:
//   - business promotions (create-promotion-checkout), keyed by
//     metadata.promotion_id or the bare reference;
//   - event listing fees (create-event-checkout), keyed by
//     metadata.event_id or an "event:<id>" reference — see
//     handleEventPayment below and supabase/events.sql.

const TOLERANCE_SECONDS = 300; // matches the PHP SDK's default tolerance

// Dependencies are injected so scripts/bachsWebhook.test.mjs can run this
// under Node with an in-memory fake database. index.ts wires the real ones.
export function createHandler({ createClient, env }) {
  return async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const timestamp = req.headers.get('X-Bachs-Timestamp');
  const signature = req.headers.get('X-Bachs-Signature');
  const webhookSecret = env.get('BACHS_WEBHOOK_SECRET');

  if (!webhookSecret) {
    console.error('[bachs-webhook] BACHS_WEBHOOK_SECRET not set — rejecting, cannot verify.');
    return new Response('Webhook not configured', { status: 500 });
  }
  if (!timestamp || !signature) {
    return new Response('Missing signature headers', { status: 400 });
  }
  if (!/^\d+$/.test(timestamp)) {
    return new Response('Malformed timestamp', { status: 400 });
  }
  const ageSeconds = Math.abs(Date.now() / 1000 - Number(timestamp));
  if (ageSeconds > TOLERANCE_SECONDS) {
    return new Response('Stale request', { status: 400 });
  }

  const expectedSignature = await hmacSha256Hex(webhookSecret, `${timestamp}.${rawBody}`);
  if (!timingSafeEqual(expectedSignature, signature)) {
    return new Response('Invalid signature', { status: 400 });
  }

  let event;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return new Response('Malformed JSON', { status: 400 });
  }
  if (!event?.id || !event?.type) {
    return new Response('Event missing id/type', { status: 400 });
  }

  const adminClient = createClient(
    env.get('SUPABASE_URL'),
    env.get('SUPABASE_SERVICE_ROLE_KEY')
  );

  // Idempotency: insert the event id first. A unique-violation means this
  // exact event was already processed (BACHS delivers "at least once" per
  // its own docs) — return 200 immediately rather than re-applying it.
  // See promotions.sql's bachs_webhook_events comment for why a duplicate
  // collection.failed arriving after a collection.succeeded is the actual
  // failure mode this guards against, not just theoretical hygiene.
  const { error: dedupeError } = await adminClient
    .from('bachs_webhook_events')
    .insert({ id: event.id, type: event.type });
  if (dedupeError) {
    if (dedupeError.code === '23505') {
      return new Response('Already processed', { status: 200 });
    }
    console.error('[bachs-webhook] dedupe insert failed:', dedupeError.message);
    // Fall through and process anyway — an unrelated DB hiccup on the
    // bookkeeping table shouldn't block a real payment confirmation.
  }

  // Event listing fees are told apart by metadata.event_id, or the
  // "event:" reference prefix create-event-checkout sets.
  const reference = event.data?.reference;
  const eventId =
    event.data?.metadata?.event_id ||
    (typeof reference === 'string' && reference.startsWith('event:') ? reference.slice('event:'.length) : null);
  if (eventId) {
    return handleEventPayment(adminClient, event, eventId);
  }

  const promotionId = event.data?.metadata?.promotion_id || reference;
  if (!promotionId) {
    console.error('[bachs-webhook] event has no promotion_id/reference, ignoring:', event.id, event.type);
    return new Response('OK (no promotion reference)', { status: 200 });
  }

  switch (event.type) {
    case 'collection.succeeded':
    case 'checkout.completed': {
      // Amount check — a signature-verified "succeeded" event only proves
      // BACHS collected *something*, not that it was the right amount.
      // Compare what BACHS says it collected against the price we stored
      // (create-promotion-checkout re-derives promotions.amount server-side
      // before creating the checkout, so it is the trusted expected value).
      const { data: promotion, error: lookupError } = await adminClient
        .from('promotions')
        .select('amount, currency, payment_status')
        .eq('id', promotionId)
        .maybeSingle();
      if (lookupError) {
        console.error('[bachs-webhook] promotion lookup failed:', lookupError.message);
        // Release the dedupe row so BACHS's retry isn't swallowed as
        // "already processed" — nothing was applied yet.
        await releaseEvent(adminClient, event.id);
        return new Response('Lookup failed', { status: 500 });
      }
      if (!promotion) {
        console.error('[bachs-webhook] no promotion row for', promotionId, 'event', event.id);
        break;
      }

      const check = checkAmountPaid(event, promotion);
      if (!check.ok) {
        // Deliberately NOT marked paid, failed, or expired — same stance as
        // collection.underpaid below: a mismatch needs a human decision.
        console.error('[bachs-webhook] amount check failed, NOT marking paid:', {
          eventId: event.id,
          promotionId,
          reason: check.reason,
          expected: promotion.amount,
          expectedCurrency: promotion.currency,
          paid: check.paid,
          paidCurrency: check.currency,
        });
        break;
      }

      // Already paid by a sibling event (BACHS can emit both
      // collection.succeeded and checkout.completed for one payment, with
      // different event ids) — nothing to do, and NOT an error.
      if (promotion.payment_status === 'paid') break;

      const { data: updated, error } = await adminClient
        .from('promotions')
        .update({
          payment_status: 'paid',
          status: 'pending_review',
          bachs_payment_id: event.data?.id ?? null,
          paid_at: new Date().toISOString(),
        })
        .eq('id', promotionId)
        // A late success must rescue a row our own expiry/failure event
        // already closed — the customer really paid. 'paid' stays excluded.
        .in('payment_status', ['unpaid', 'expired', 'failed'])
        .select('id');
      if (error) {
        console.error('[bachs-webhook] paid-update failed:', error.message);
        await releaseEvent(adminClient, event.id);
        return new Response('Update failed', { status: 500 });
      }
      if (!updated || updated.length === 0) {
        // The row was payable at lookup time but matched nothing now, so it
        // changed underneath us. Let BACHS retry rather than lose the payment.
        console.error('[bachs-webhook] paid-update matched 0 rows:', event.id, promotionId);
        await releaseEvent(adminClient, event.id);
        return new Response('Update matched no rows', { status: 500 });
      }
      if (promotion.payment_status !== 'unpaid') {
        console.warn('[bachs-webhook] late payment rescued a', promotion.payment_status, 'promotion:', promotionId);
      }
      break;
    }
    case 'collection.failed':
    case 'checkout.expired': {
      const { error } = await adminClient
        .from('promotions')
        .update({ payment_status: event.type === 'checkout.expired' ? 'expired' : 'failed' })
        .eq('id', promotionId)
        .eq('payment_status', 'unpaid'); // never downgrade an already-paid row
      if (error) {
        console.error('[bachs-webhook] failed-update failed:', error.message);
        await releaseEvent(adminClient, event.id);
        return new Response('Update failed', { status: 500 });
      }
      break;
    }
    case 'collection.underpaid': {
      // Deliberately not auto-marked 'paid' or 'failed' — an underpaid
      // collection needs a human decision (top up? refund? honor it
      // anyway?), not a silent automatic status. Logged for now; the
      // admin review tab (PROMOTE_ADMIN_REVIEW.md, not built yet) is the
      // right place to surface this, not this webhook guessing.
      console.warn('[bachs-webhook] underpaid collection for promotion', promotionId, event.data);
      break;
    }
    default:
      // Unhandled event types (subscription/invoice/customer events —
      // this app never creates those) are intentionally ignored, not
      // errored on, so BACHS doesn't get a stream of failures for
      // webhook traffic this integration never subscribed to on purpose.
      break;
  }

  return new Response('OK', { status: 200 });
  };
}

// Event listing fees: the same rules as the promotion branch above, against
// `events`. The expected amount is events.listing_fee (set server-side by
// create-event-checkout); a paid event moves to 'pending_review' for the
// admin Events tab. Free events never reach here (no checkout).
async function handleEventPayment(adminClient, event, eventId) {
  switch (event.type) {
    case 'collection.succeeded':
    case 'checkout.completed': {
      const { data: row, error: lookupError } = await adminClient
        .from('events')
        .select('listing_fee, currency, payment_status')
        .eq('id', eventId)
        .maybeSingle();
      if (lookupError) {
        console.error('[bachs-webhook] event lookup failed:', lookupError.message);
        await releaseEvent(adminClient, event.id);
        return new Response('Lookup failed', { status: 500 });
      }
      if (!row) {
        console.error('[bachs-webhook] no event row for', eventId, 'event', event.id);
        break;
      }

      const check = checkAmountPaid(event, { amount: row.listing_fee, currency: row.currency });
      if (!check.ok) {
        console.error('[bachs-webhook] event amount check failed, NOT marking paid:', {
          eventId: event.id,
          listingId: eventId,
          reason: check.reason,
          expected: row.listing_fee,
          expectedCurrency: row.currency,
          paid: check.paid,
          paidCurrency: check.currency,
        });
        break;
      }

      // Sibling event (collection.succeeded + checkout.completed) already applied.
      if (row.payment_status === 'paid') break;

      const { data: updated, error } = await adminClient
        .from('events')
        .update({
          payment_status: 'paid',
          status: 'pending_review',
          bachs_payment_id: event.data?.id ?? null,
          paid_at: new Date().toISOString(),
        })
        .eq('id', eventId)
        // A late success rescues a row an expiry/failure event already closed.
        .in('payment_status', ['unpaid', 'expired', 'failed'])
        .select('id');
      if (error) {
        console.error('[bachs-webhook] event paid-update failed:', error.message);
        await releaseEvent(adminClient, event.id);
        return new Response('Update failed', { status: 500 });
      }
      if (!updated || updated.length === 0) {
        console.error('[bachs-webhook] event paid-update matched 0 rows:', event.id, eventId);
        await releaseEvent(adminClient, event.id);
        return new Response('Update matched no rows', { status: 500 });
      }
      if (row.payment_status !== 'unpaid') {
        console.warn('[bachs-webhook] late payment rescued a', row.payment_status, 'event:', eventId);
      }
      break;
    }
    case 'collection.failed':
    case 'checkout.expired': {
      const { error } = await adminClient
        .from('events')
        .update({ payment_status: event.type === 'checkout.expired' ? 'expired' : 'failed' })
        .eq('id', eventId)
        .eq('payment_status', 'unpaid'); // never downgrade an already-paid row
      if (error) {
        console.error('[bachs-webhook] event failed-update failed:', error.message);
        await releaseEvent(adminClient, event.id);
        return new Response('Update failed', { status: 500 });
      }
      break;
    }
    case 'collection.underpaid':
      console.warn('[bachs-webhook] underpaid collection for event', eventId, event.data);
      break;
    default:
      break;
  }
  return new Response('OK', { status: 200 });
}

// BACHS money fields are decimal STRINGS in major units ("200.00"), never
// minor units/floats (docs.bachs.io, event pages). `promotions.amount` is
// numeric(12,2) in naira too, so no x100 conversion between the two — we
// only go to integer kobo here to compare without float drift.
//
// Real field names (docs.bachs.io/guides/webhooks/events/*):
//   collection.succeeded → data.amount, data.currency, data.status
//                          (SUCCEEDED | ACCEPTED | OVERPAID; OVERPAID also
//                          carries data.received_amount)
//   checkout.completed   → data.charge.amount / data.charge.currency
//                          (data.amount is the checkout total; data.charge
//                          is null for free checkouts), data.payment_status
// `settlement_amount` is NOT used: it is the net credited after fees/FX, so
// it can legitimately be lower than the price.
//
// Comparison is paid >= expected, not ===: with fee_bearer = 'customer'
// BACHS adds its fee on top of the price, so `amount` can exceed
// promotions.amount. Short payments are what this guards against.
function toMinorUnits(value) {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}

// `expected` is { amount, currency }: a promotions row, or an events row's
// listing_fee/currency.
function checkAmountPaid(event, expected) {
  const d = event.data ?? {};
  const isCollection = event.type === 'collection.succeeded';

  if (isCollection) {
    // ACCEPTED = "accepted on other terms" (not a full-price payment);
    // only SUCCEEDED and OVERPAID are full-amount states.
    if (d.status && d.status !== 'SUCCEEDED' && d.status !== 'OVERPAID') {
      return { ok: false, reason: `collection status ${d.status} is not a full payment` };
    }
  } else if (d.payment_status !== 'paid') {
    return { ok: false, reason: `checkout payment_status is ${d.payment_status}` };
  }

  const charge = d.charge ?? null;
  const paidRaw = isCollection
    ? (d.status === 'OVERPAID' ? d.received_amount ?? d.amount : d.amount)
    : (charge?.amount ?? d.amount);
  const currency = isCollection ? d.currency : (charge?.currency ?? d.currency);

  const paid = toMinorUnits(paidRaw);
  const expectedMinor = toMinorUnits(expected.amount);
  if (paid === null || expectedMinor === null) {
    return { ok: false, reason: 'amount missing or not numeric', paid: paidRaw, currency };
  }
  if (!currency || String(currency).toUpperCase() !== String(expected.currency).toUpperCase()) {
    return { ok: false, reason: 'currency mismatch', paid: paidRaw, currency };
  }
  if (paid < expectedMinor) {
    return { ok: false, reason: 'paid less than the expected amount', paid: paidRaw, currency };
  }
  return { ok: true, paid: paidRaw, currency };
}

async function hmacSha256Hex(secret, message) {
  const key = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function timingSafeEqual(a, b) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Un-claim an event id so BACHS's retry is processed instead of being
// swallowed as "Already processed". Only call this when nothing was applied.
async function releaseEvent(adminClient, eventId) {
  const { error } = await adminClient.from('bachs_webhook_events').delete().eq('id', eventId);
  if (error) console.error('[bachs-webhook] could not release dedupe row:', eventId, error.message);
}
