// ── supabase/functions/create-event-checkout/index.ts ────────────────────
//
// Ticketed events pay a flat listing fee before review. Same shape as
// create-promotion-checkout (see its comments and docs/payments.md): called
// by src/features/events/submitEvent.js with the user's JWT, reads the row
// as the caller (RLS proves ownership), then claims it through
// claim_event_checkout() (supabase/events_checkout_guard.sql) — one locked
// step that hands back a still-open checkout, refuses while another call is
// opening one, or lets this call open a fresh one — and stores the result
// with the service role.
//
// Deploy: `supabase functions deploy create-event-checkout`
// Secrets: BACHS_SECRET_KEY, BACHS_BASE_URL (optional), SITE_URL — the same
// ones create-promotion-checkout already uses.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { bachsRequest } from '../_shared/bachs.ts';

// Mirrors EVENT_LISTING_FEE in src/features/explore/eventsData.js — keep the
// two in sync. This copy decides what BACHS actually collects.
const EVENT_LISTING_FEE = 3000;
// Always naira (events.currency is pinned to NGN in events_hardening.sql).
const CURRENCY = 'NGN';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const TRY_AGAIN = "We couldn't open the payment page. Please try again in a moment.";

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: CORS_HEADERS });
  }

  let eventId;
  try {
    ({ eventId } = await req.json());
  } catch {
    return json({ error: 'Malformed request body — expected { eventId }' }, 400);
  }
  if (!eventId || typeof eventId !== 'string') {
    return json({ error: 'eventId is required' }, 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Not signed in.' }, 401);
  }

  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

  // Read as the caller: RLS (events_select_own_or_admin) proves it's theirs.
  const { data: event, error: fetchError } = await callerClient
    .from('events')
    .select('id, entry_type, payment_status')
    .eq('id', eventId)
    .maybeSingle();
  if (fetchError) return json({ error: fetchError.message }, 500);
  if (!event) return json({ error: 'Event not found (or not yours).' }, 404);
  if (event.entry_type !== 'ticketed') {
    return json({ error: 'Free events have nothing to pay.' }, 409);
  }

  // One locked step decides what happens (claim_event_checkout). It also
  // sets the fee and currency, never trusting what the client inserted.
  const { data: claimRows, error: claimError } = await adminClient.rpc('claim_event_checkout', {
    p_id: event.id,
    p_fee: EVENT_LISTING_FEE,
  });
  if (claimError) {
    console.error('[create-event-checkout] claim failed:', event.id, claimError.message);
    return json({ error: TRY_AGAIN }, 500);
  }
  const claim = Array.isArray(claimRows) ? claimRows[0] : claimRows;
  switch (claim?.result) {
    case 'reuse':
      // A checkout for this event is still open: same one, never a second.
      return json({ checkoutUrl: claim.checkout_url });
    case 'busy':
      return json({ error: 'Your payment page is already opening. Wait a few seconds, then try again.' }, 409);
    case 'started':
      return json({ error: 'This event has already started, so it can no longer be listed.' }, 409);
    case 'not_payable':
      return json(
        {
          error:
            event.payment_status === 'paid'
              ? 'This event is already paid for.'
              : "This event can't be paid for in its current state.",
        },
        409
      );
    case 'claimed':
      break;
    default:
      return json({ error: 'Event not found (or not yours).' }, 404);
  }

  // Claimed: the row is 'unpaid' with the old checkout link cleared. If
  // anything below fails, release the claim so the next tap can try again.
  async function releaseClaim() {
    const { error } = await adminClient
      .from('events')
      .update({ bachs_checkout_started_at: null })
      .eq('id', event.id)
      .is('bachs_checkout_url', null);
    if (error) console.error('[create-event-checkout] could not release claim:', event.id, error.message);
  }

  // Every way back from BACHS lands on the event's status page, which reads
  // the row: success, cancelled (with "Try payment again"), failed, expired.
  const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('Origin') || '';
  const successUrl = `${siteUrl}/event/callback?event=${event.id}`;
  const cancelUrl = `${siteUrl}/event/callback?event=${event.id}&cancelled=1`;

  let checkout;
  try {
    checkout = await bachsRequest('/v1/checkout-sessions', {
      body: {
        pricing: { amount: EVENT_LISTING_FEE.toFixed(2), currency: CURRENCY },
        success_url: successUrl,
        cancel_url: cancelUrl,
        // bachs-webhook tells events from promotions by metadata.event_id,
        // or by this "event:<id>:" prefix (failed/collection events can carry
        // an empty metadata object). BACHS rejects a reference it has seen
        // before ("Duplicate reference"), so every attempt gets a suffix.
        reference: `event:${event.id}:${Date.now().toString(36)}`,
        metadata: { event_id: event.id },
      },
    });
  } catch (e) {
    // The raw BACHS message is for the logs, not the person paying.
    console.error('[create-event-checkout] BACHS checkout failed:', event.id, e.message);
    await releaseClaim();
    return json({ error: TRY_AGAIN }, 502);
  }

  const checkoutUrl = checkout.url || checkout.checkout_url;
  const checkoutId = checkout.checkout_id || checkout.id || null;
  if (!checkoutUrl) {
    console.error('[create-event-checkout] no checkout URL in BACHS reply:', event.id, JSON.stringify(checkout).slice(0, 500));
    await releaseClaim();
    return json({ error: TRY_AGAIN }, 502);
  }

  // BACHS's own expiry for this checkout, so "still open" (reuse) is exact.
  const expiresAt = checkout.expires_at && !Number.isNaN(Date.parse(checkout.expires_at)) ? checkout.expires_at : null;
  const { error: updateError } = await adminClient
    .from('events')
    .update({
      bachs_checkout_id: checkoutId,
      bachs_checkout_url: checkoutUrl,
      bachs_checkout_expires_at: expiresAt,
    })
    .eq('id', event.id);
  if (updateError) {
    // Non-fatal: the person can still pay with the URL they have.
    console.error('[create-event-checkout] failed to store checkout id/url:', updateError.message);
  }

  return json({ checkoutUrl });
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
