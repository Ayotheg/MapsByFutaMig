// ── supabase/functions/create-event-checkout/index.ts ────────────────────
//
// Ticketed events pay a flat listing fee before review. Same shape as
// create-promotion-checkout (see its comments and docs/payments.md): called
// by src/features/events/submitEvent.js with the user's JWT, reads the row
// as the caller (RLS proves ownership), sets the fee server-side, opens a
// BACHS checkout, and stores the checkout id/url with the service role.
//
// Deploy: `supabase functions deploy create-event-checkout`
// Secrets: BACHS_SECRET_KEY, BACHS_BASE_URL (optional), SITE_URL — the same
// ones create-promotion-checkout already uses.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { bachsRequest } from '../_shared/bachs.ts';

// Mirrors EVENT_LISTING_FEE in src/features/explore/eventsData.js — keep the
// two in sync. This copy decides what BACHS actually collects.
const EVENT_LISTING_FEE = 3000;

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

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

  const { data: event, error: fetchError } = await callerClient
    .from('events')
    .select('id, title, entry_type, listing_fee, currency, payment_status, status')
    .eq('id', eventId)
    .maybeSingle();

  if (fetchError) return json({ error: fetchError.message }, 500);
  if (!event) return json({ error: 'Event not found (or not yours).' }, 404);
  if (event.entry_type !== 'ticketed') {
    return json({ error: 'Free events have nothing to pay.' }, 409);
  }
  if (event.payment_status !== 'unpaid' || event.status !== 'awaiting_payment') {
    return json({ error: `This event is already ${event.payment_status}.` }, 409);
  }

  // Never trust the client-inserted fee.
  const amount = EVENT_LISTING_FEE;
  const currency = event.currency || 'NGN';
  if (Number(event.listing_fee) !== amount) {
    const { error: amountError } = await adminClient.from('events').update({ listing_fee: amount }).eq('id', event.id);
    if (amountError) return json({ error: amountError.message }, 500);
  }

  const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('Origin') || '';
  const successUrl = `${siteUrl}/event/callback?event=${event.id}`;
  const cancelUrl = `${siteUrl}/event?cancelled=1`;

  let checkout;
  try {
    checkout = await bachsRequest('/v1/checkout-sessions', {
      body: {
        pricing: { amount: amount.toFixed(2), currency },
        success_url: successUrl,
        cancel_url: cancelUrl,
        // bachs-webhook tells events from promotions by metadata.event_id,
        // or by this "event:" prefix if an event shape drops metadata.
        reference: `event:${event.id}`,
        metadata: { event_id: event.id },
      },
    });
  } catch (e) {
    console.error('[create-event-checkout] BACHS checkout failed:', event.id, e.message);
    return json({ error: `Could not start BACHS checkout: ${e.message}` }, 502);
  }

  const checkoutUrl = checkout.url || checkout.checkout_url;
  if (!checkoutUrl) {
    console.error('[create-event-checkout] no checkout URL in BACHS reply:', event.id, JSON.stringify(checkout).slice(0, 500));
    return json({ error: 'BACHS did not return a checkout URL.' }, 502);
  }

  const { error: updateError } = await adminClient
    .from('events')
    .update({ bachs_checkout_id: checkout.id, bachs_checkout_url: checkoutUrl })
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
