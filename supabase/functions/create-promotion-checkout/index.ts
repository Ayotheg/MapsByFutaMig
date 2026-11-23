// ── supabase/functions/create-promotion-checkout/index.ts ───────────────
//
// Called by submitPromotion.js via `supabase.functions.invoke(...)`,
// which forwards the caller's session JWT automatically — this function
// never sees the BACHS secret key from the browser, and the browser never
// sees it either. That's the entire reason this needs to be an Edge
// Function instead of a plain client → BACHS fetch: CLAUDE.md's
// "Supabase only" rule is satisfied (this IS Supabase, not a separate
// server), while still keeping BACHS_SECRET_KEY off the client bundle.
//
// Deploy: `supabase functions deploy create-promotion-checkout`
// Secrets needed (supabase secrets set ...):
//   BACHS_SECRET_KEY   — sk_sandbox_... / sk_live_...
//   BACHS_BASE_URL     — optional, defaults to the sandbox host (_shared/bachs.ts)
//   SITE_URL           — e.g. https://mapsbyfuta.app (no trailing slash) —
//                         used to build success_url/cancel_url. Falls back
//                         to the request's own Origin header if unset, so
//                         this also works from localhost during dev.
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / SUPABASE_ANON_KEY are
// injected automatically for every Edge Function — not set by hand.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { bachsRequest } from '../_shared/bachs.ts';

// Mirrors src/features/promote/pricing.js — keep the two in sync. These
// copies are the ones that decide what BACHS actually collects.
const NAIRA_PER_DAY = 200;
const MIN_DAYS = 1;
const MAX_DAYS = 30;
const PROMO_CODE = 'IAMAFUTARIAN';
const PROMO_DISCOUNT = 0.5;

// The browser calls this cross-origin. Without these headers on EVERY
// response, the browser hides an error reply's body and supabase-js can
// only say "Failed to send a request to the Edge Function".
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

  let promotionId;
  let promoCode;
  try {
    ({ promotionId, promoCode } = await req.json());
  } catch {
    return json({ error: 'Malformed request body — expected { promotionId }' }, 400);
  }
  if (!promotionId || typeof promotionId !== 'string') {
    return json({ error: 'promotionId is required' }, 400);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return json({ error: 'Not signed in.' }, 401);
  }

  // Two clients, two purposes — same split adminSave.js's blockedWriteError
  // draws between "am I signed in" and "am I allowed":
  //  - `callerClient` is scoped to the caller's own JWT, so its SELECT is
  //    RLS-enforced by promotions_select_own_or_admin — this is what
  //    actually proves "this promotion belongs to the person calling,"
  //    not a manual `.eq('submitted_by', ...)` check that could be
  //    bypassed by anyone who knows another user's promotion id.
  //  - `adminClient` (service role) is the only thing allowed to WRITE
  //    the bachs_checkout_id/url columns, since promotions.sql grants no
  //    client-side UPDATE policy at all.
  const supabaseUrl = Deno.env.get('SUPABASE_URL');
  const callerClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_ANON_KEY'), {
    global: { headers: { Authorization: authHeader } },
  });
  const adminClient = createClient(supabaseUrl, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY'));

  const { data: promotion, error: fetchError } = await callerClient
    .from('promotions')
    .select('id, business_name, description, days, amount, currency, payment_status, submitted_by')
    .eq('id', promotionId)
    .maybeSingle();

  if (fetchError) return json({ error: fetchError.message }, 500);
  if (!promotion) return json({ error: 'Promotion not found (or not yours).' }, 404);
  if (promotion.payment_status !== 'unpaid') {
    return json({ error: `This promotion is already ${promotion.payment_status}.` }, 409);
  }

  // One ad per account at a time (mirrors src/features/promote/
  // activePromotion.js): no new checkout while another of this account's
  // ads is live or paid and waiting for approval.
  const { data: others, error: othersError } = await adminClient
    .from('promotions')
    .select('business_name, status, payment_status, waypoint_id, promo_ends_at')
    .eq('submitted_by', promotion.submitted_by)
    .neq('id', promotion.id)
    .in('status', ['approved', 'pending_review']);
  if (othersError) return json({ error: othersError.message }, 500);
  const nowMs = Date.now();
  const blocking = (others || []).find(
    (p) =>
      (p.status === 'approved' && p.waypoint_id && p.promo_ends_at && Date.parse(p.promo_ends_at) > nowMs) ||
      (p.status === 'pending_review' && p.payment_status === 'paid')
  );
  if (blocking) {
    return json(
      {
        error:
          blocking.status === 'approved'
            ? `You already have an ad running for "${blocking.business_name}". You can place a new ad once it ends.`
            : `Your ad for "${blocking.business_name}" is paid and waiting for approval. You can place a new ad once it has finished running.`,
      },
      409
    );
  }

  // The amount charged is re-derived here from the stored `days` and the
  // optional promo code, NEVER taken from the client-inserted `amount` or
  // the request body. A tampered client could otherwise ask BACHS to
  // collect ₦1 for a 30-day campaign; the promo discount only applies
  // when the code matches PROMO_CODE above.
  const days = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Number(promotion.days) || MIN_DAYS));
  const promoApplied =
    typeof promoCode === 'string' && promoCode.trim().toUpperCase() === PROMO_CODE;
  const fullAmount = days * NAIRA_PER_DAY;
  const amount = promoApplied ? Math.round(fullAmount * (1 - PROMO_DISCOUNT)) : fullAmount;
  // Always naira, never the row's currency: the client inserts that column,
  // and the webhook compares the payment against it (promotions.currency is
  // also pinned to NGN in events_hardening.sql).
  const currency = 'NGN';

  // Overwrite whatever amount the client inserted, so the row (and the
  // admin Promotions tab) shows what is actually being charged.
  if (Number(promotion.amount) !== amount) {
    const { error: amountError } = await adminClient
      .from('promotions')
      .update({ amount })
      .eq('id', promotion.id);
    if (amountError) return json({ error: amountError.message }, 500);
  }

  const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('Origin') || '';
  const successUrl = `${siteUrl}/promote/callback?promotion=${promotion.id}`;
  const cancelUrl = `${siteUrl}/promote?cancelled=1`;

  let checkout;
  try {
    // Ported from cefa161 (BachTest), CONFIRMED by a real sandbox checkout
    // + webhook round-trip: `/v1/checkout-sessions` (hyphen; the underscore
    // path 404s) takes an ad-hoc `pricing: { amount, currency }` directly,
    // so no Product is created first. (The old two-step product flow sent
    // `price` as a bare number, which BACHS rejects, and needed an extra
    // products:write scope.)
    checkout = await bachsRequest('/v1/checkout-sessions', {
      body: {
        // BACHS money fields are decimal STRINGS in major units ("100.00");
        // a JS number is rejected ("pricing.amount: Input should be a valid
        // string"). BachTest sent promotion.amount straight from the
        // numeric column, which PostgREST already returns as that string.
        pricing: { amount: amount.toFixed(2), currency },
        success_url: successUrl,
        cancel_url: cancelUrl,
        // `reference` round-trips through BACHS and back onto the
        // webhook event — bachs-webhook/index.ts reads
        // metadata.promotion_id first and falls back to this if a given
        // event shape omits metadata, belt-and-suspenders since this is
        // the one link between "a payment happened" and "which row it's
        // for."
        reference: promotion.id,
        metadata: { promotion_id: promotion.id },
      },
    });
  } catch (e) {
    console.error('[create-promotion-checkout] BACHS checkout failed:', promotion.id, e.message);
    return json({ error: `Could not start BACHS checkout: ${e.message}` }, 502);
  }

  const checkoutUrl = checkout.url || checkout.checkout_url;
  if (!checkoutUrl) {
    console.error('[create-promotion-checkout] no checkout URL in BACHS reply:', promotion.id, JSON.stringify(checkout).slice(0, 500));
    return json({ error: 'BACHS did not return a checkout URL.' }, 502);
  }

  const { error: updateError } = await adminClient
    .from('promotions')
    .update({ bachs_checkout_id: checkout.id, bachs_checkout_url: checkoutUrl })
    .eq('id', promotion.id);
  if (updateError) {
    // Non-fatal — the checkout itself was created successfully and the
    // person can still pay; losing this bookkeeping write just means an
    // admin can't look the checkout id up from the row later. Logged,
    // not thrown, so a transient DB hiccup doesn't strand a person who
    // already has a valid checkout URL in hand.
    console.error('[create-promotion-checkout] failed to store checkout id/url:', updateError.message);
  }

  return json({ checkoutUrl });
});

function json(body, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}
