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

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  let promotionId;
  try {
    ({ promotionId } = await req.json());
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

  // The amount charged is re-derived from the stored row, NEVER taken
  // from the request body — submitPromotion.js doesn't even send one.
  // A tampered client could otherwise ask BACHS to collect ₦1 for a
  // 30-day campaign; this function is the one place that can't be
  // tricked into that, since `promotion.amount` was itself computed
  // server-side-equivalent at insert time from `days` (pricing.js's
  // computeAmount, mirrored — see submitPromotion.js).
  const amount = promotion.amount;
  const currency = promotion.currency || 'NGN';

  const siteUrl = Deno.env.get('SITE_URL') || req.headers.get('Origin') || '';
  const successUrl = `${siteUrl}/promote/callback?promotion=${promotion.id}`;
  const cancelUrl = `${siteUrl}/promote?cancelled=1`;

  let checkout;
  try {
    // ⚠️ Product-based checkout, per _shared/bachs.ts's flag — Bachs's
    // SDK examples check out against a pre-created Product rather than
    // an ad-hoc amount. A fresh, single-use Product per promotion keeps
    // this correct (never reuses/mutates a shared "Promotion" product
    // that different campaigns' prices would fight over) at the cost of
    // one extra API call per checkout. Replace this whole block with a
    // direct ad-hoc-amount checkout call if/once step 2 of that flag's
    // checklist finds one.
    const product = await bachsRequest('/v1/products', {
      body: {
        name: `Promotion (${promotion.days} day${promotion.days === 1 ? '' : 's'}) — ${promotion.business_name}`,
        price: amount,
        currency,
      },
    });

    checkout = await bachsRequest('/v1/checkout_sessions', {
      body: {
        product_cart: [{ product_id: product.id, quantity: 1 }],
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
    return json({ error: `Could not start BACHS checkout: ${e.message}` }, 502);
  }

  const checkoutUrl = checkout.url || checkout.checkout_url;
  if (!checkoutUrl) {
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
    headers: { 'Content-Type': 'application/json' },
  });
}
