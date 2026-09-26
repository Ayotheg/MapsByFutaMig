// ── supabase/functions/bachs-webhook/index.ts ────────────────────────────
//
// BACHS calls this directly (server-to-server), never the browser — this
// is the ONLY code path in the whole app allowed to flip
// promotions.payment_status to 'paid'. create-promotion-checkout only ever
// sets payment_status indirectly by existing at all; it never writes
// payment_status itself. Keeping that a hard rule (not just a convention)
// is what makes it safe that promotions.sql grants no client UPDATE policy
// on this table — the money-confirming write only ever comes from a
// signature-verified BACHS request.
//
// Deploy: `supabase functions deploy bachs-webhook --no-verify-jwt`
// The `--no-verify-jwt` flag is REQUIRED — Supabase Edge Functions demand
// a valid Supabase JWT on every request by default, but BACHS obviously
// doesn't have one. This function does its own auth instead (the HMAC
// signature check below), which is why skipping Supabase's own JWT check
// here is correct and not a hole — the request is still verified, just by
// a different mechanism appropriate to a third-party webhook.
//
// Secrets needed: BACHS_WEBHOOK_SECRET (from the Bachs dashboard's
// webhook-endpoint settings, NOT the same value as BACHS_SECRET_KEY).
//
// Register this URL in the Bachs dashboard as the webhook endpoint:
//   https://<project-ref>.supabase.co/functions/v1/bachs-webhook
//
// ⚠️ FLAGGED, NOT CONFIRMED — same caveat as _shared/bachs.ts: the
// signature scheme below (HMAC-SHA256 over `${timestamp}.${rawBody}`,
// headers X-Bachs-Timestamp/X-Bachs-Signature, event shape
// { id, type, created_at, organization_id, data }) is reconstructed from
// the zeevx/php-bachs SDK's WebhookVerifier description, not a directly-
// read Bachs API reference. Confirm the exact header names, the exact
// string that gets signed, and the tolerance window against Bachs's real
// docs (or by logging one real sandbox delivery's raw headers/body before
// turning signature verification on) before trusting this live — an
// almost-right signature check that silently accepts forged requests is
// worse than an obviously-broken one.

import { createClient } from 'npm:@supabase/supabase-js@2';

const TOLERANCE_SECONDS = 300; // matches the PHP SDK's default tolerance

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const rawBody = await req.text();
  const timestamp = req.headers.get('X-Bachs-Timestamp');
  const signature = req.headers.get('X-Bachs-Signature');
  const webhookSecret = Deno.env.get('BACHS_WEBHOOK_SECRET');

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
    Deno.env.get('SUPABASE_URL'),
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')
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

  const promotionId = event.data?.metadata?.promotion_id || event.data?.reference;
  if (!promotionId) {
    console.error('[bachs-webhook] event has no promotion_id/reference, ignoring:', event.id, event.type);
    return new Response('OK (no promotion reference)', { status: 200 });
  }

  switch (event.type) {
    case 'collection.succeeded':
    case 'checkout.completed': {
      const { error } = await adminClient
        .from('promotions')
        .update({
          payment_status: 'paid',
          status: 'pending_review',
          bachs_payment_id: event.data?.id ?? null,
          paid_at: new Date().toISOString(),
        })
        .eq('id', promotionId)
        .eq('payment_status', 'unpaid'); // idempotent guard — a retried delivery is a no-op, not a re-write
      if (error) console.error('[bachs-webhook] paid-update failed:', error.message);
      break;
    }
    case 'collection.failed':
    case 'checkout.expired': {
      const { error } = await adminClient
        .from('promotions')
        .update({ payment_status: event.type === 'checkout.expired' ? 'expired' : 'failed' })
        .eq('id', promotionId)
        .eq('payment_status', 'unpaid'); // never downgrade an already-paid row
      if (error) console.error('[bachs-webhook] failed-update failed:', error.message);
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
});

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
