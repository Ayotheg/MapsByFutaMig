# PROMOTE — Payment Integration (BACHS)

Handoff doc for whoever wires the Promote screen's payment up for real.
Scope is deliberately narrow: **getting a promotion from "form filled in"
to "BACHS confirms it's paid."** What happens to a *paid* promotion after
that — an admin review queue, pushing a Physical Shop onto the map, or
rendering an Online Store as a link-out card on Explore — is a separate
doc/slice (working title `PROMOTE_ADMIN_REVIEW.md`) and is explicitly not
covered here. `promotions.status` goes `awaiting_payment` → `pending_review`
and stops; nothing in this repo currently reads `pending_review` rows.

Everything referenced below already exists in this checkout — this doc is
a map of it, plus the parts that still need a real BACHS account and a
`supabase functions deploy` to actually go live.

## 0. TL;DR — what's built vs. what you need to do

**Built, and `npm run build` passes clean:**
- `src/features/promote/pricing.js` — the ₦/day rate, single source of truth
- `src/features/promote/submitPromotion.js` — validates the form, uploads
  photos, inserts the `promotions` row, calls the Edge Function
- `src/features/promote/PromotePage.jsx` — "Proceed to checkout" now calls
  the above and redirects to the BACHS URL it gets back
- `src/features/promote/PromoteCallbackPage.jsx` (route `/promote/callback`)
  — polls payment status after the BACHS redirect
- `supabase/promotions.sql` — table DDL + RLS (not yet run against a live DB)
- `supabase/functions/create-promotion-checkout/index.ts` — Edge Function,
  written but not deployed
- `supabase/functions/bachs-webhook/index.ts` — Edge Function, written but
  not deployed

**Your job, in order:**
1. Get a real BACHS account (sandbox first) — `https://bachs.io`.
2. Confirm the exact request/response shapes flagged in §3/§4 below against
   BACHS's actual API reference. Everything here was reconstructed from
   BACHS's public SDK READMEs (no direct API reference access from this
   session) — it's a strong starting point, not gospel. Search this repo
   for `⚠️ FLAGGED` to find every spot that needs a second look.
3. Run `supabase/promotions.sql` in the Supabase SQL editor.
4. `supabase secrets set` the values in §5, then
   `supabase functions deploy create-promotion-checkout` and
   `supabase functions deploy bachs-webhook --no-verify-jwt` (the flag on
   the second one is not optional — see that function's own header comment).
5. Register the webhook URL in BACHS's dashboard (§4.2).
6. Run one real sandbox checkout end to end (§6) before touching production
   keys.

## 1. Why an Edge Function at all (not just a client → BACHS call)

`CLAUDE.md`'s "Supabase only" rule rules out standing up a separate Node/
Express backend for this. A Supabase **Edge Function** satisfies that rule
(it's still Supabase, just server-side compute) while doing the one thing
the browser genuinely can't be trusted with: holding `BACHS_SECRET_KEY`.
If the client called BACHS directly, that secret key would have to ship in
the JS bundle, which is a live credential leak on day one — anyone could
open devtools and create arbitrary BACHS checkout sessions against your
account.

Two Edge Functions, not one, because they have different trust models:

| | `create-promotion-checkout` | `bachs-webhook` |
|---|---|---|
| Caller | This app's own client (signed-in user) | BACHS's servers |
| Auth | Supabase JWT (Supabase's default check) | HMAC signature over the raw body (BACHS's scheme — Supabase's own JWT check is disabled here) |
| Job | Ask BACHS for a checkout URL | Record BACHS's verdict once payment actually clears |
| Trust | Requester-scoped (can only touch their own promotion, via RLS) | Full trust once the signature checks out — this is the ONLY code path allowed to write `payment_status = 'paid'` |

## 2. End-to-end flow

```
Person fills the form on /promote
        │
        ▼
submitPromotion.js
  1. validates the form
  2. uploads photos → Storage (`place-images` bucket, `promotion/<id>/...`)
  3. INSERT promotions (status: awaiting_payment, payment_status: unpaid)
  4. supabase.functions.invoke('create-promotion-checkout', { promotionId })
        │
        ▼
create-promotion-checkout (Edge Function)
  1. re-fetches the promotion AS the caller (RLS proves ownership)
  2. re-derives the amount from the stored `days` — never trusts a
     client-sent amount
  3. calls BACHS: create a Product for this amount, then a checkout
     session against it (see §3 — this two-step shape is the flagged part)
  4. stores bachs_checkout_id/url on the row (service-role write)
  5. returns { checkoutUrl } to the client
        │
        ▼
Browser does a full redirect: window.location.href = checkoutUrl
        │
        ▼
Person pays on BACHS's hosted checkout page
        │
        ├─── success ──────────────► browser redirected to
        │                            /promote/callback?promotion=<id>
        │                            (proves nothing on its own — see below)
        │
        └─── cancel ───────────────► browser redirected to /promote?cancelled=1


Meanwhile, independently of the browser:

BACHS ──POST (signed)──► bachs-webhook (Edge Function)
                            1. verify X-Bachs-Timestamp / X-Bachs-Signature
                            2. dedupe on event.id (bachs_webhook_events)
                            3. on collection.succeeded / checkout.completed:
                               UPDATE promotions
                               SET payment_status='paid', status='pending_review'
                               WHERE id = <promotion_id from event> AND payment_status='unpaid'
```

**The success redirect and the webhook are two separate, unsynchronized
events.** A person can close the browser tab mid-flow after BACHS already
took their money (webhook still fires, redirect never happens), or the
webhook can lag a few seconds behind an instant-feeling redirect. That's
why `PromoteCallbackPage.jsx` **polls** `promotions.payment_status` instead
of treating "I got redirected to /callback" as proof of payment — the
webhook-written column is the only trustworthy signal in this whole flow.
Don't add a client-side "mark as paid" path anywhere, ever, even as a
fallback for a slow webhook — that defeats the entire reason this needs a
webhook at all.

## 3. BACHS API shape — what's confirmed, what's still open

This section was originally written from SDK READMEs alone, flagged as
"least certain." It's since been updated after a real sandbox account ran
the actual flow end-to-end (checkout creation → hosted payment page →
webhook delivery → signature verification), outside this specific repo
checkout but against the same Bachs API this integration targets. Most of
what was flagged is now resolved.

**Confirmed by an actual sandbox run (not SDK inference):**
- Auth: `Authorization: Bearer sk_sandbox_...` / `sk_live_...`
- Base URLs: `https://sandbox-api.bachs.io` and `https://api.bachs.io`
- Amounts are **major units** (naira, not kobo) in the *request* — e.g.
  send `500` for ₦500. Note: amounts come back in *webhook payloads* as
  strings like `"500.00"`, not numbers — parse before doing arithmetic on
  them, though nothing in this integration currently needs to.
- IDs are prefixed and opaque: `cust_`, `chk_`, `ch_`, `evt_`, `acct_`
- **Checkout endpoint is `/v1/checkout-sessions` (hyphen)** —
  `/v1/checkout_sessions` (underscore) 404s. Fixed in `bachs.ts`'s caller.
- **No Product needed.** An ad-hoc `pricing: { amount, currency }` body on
  the checkout-sessions call works directly — the Product-creation step
  has been removed from `create-promotion-checkout/index.ts` entirely.
- Checkout sessions take `success_url`, `cancel_url`, `reference`,
  `metadata` — confirmed present on both the request and round-tripped
  onto the resulting webhook event (`event.data.reference`,
  `event.data.metadata`).
- Webhook signature: `X-Bachs-Timestamp` + `X-Bachs-Signature` headers
  (and an equivalent combined `X-Bachs-Signature-V2: t=...,v1=...`),
  HMAC-SHA256 over `${timestamp}.${rawBody}`, verified against a real
  delivery and confirmed to pass with the correct secret and fail with a
  wrong one.
- Real webhook event shape, confirmed byte-for-byte:
  `{ id, type, created_at, organization_id, data }`. Event types seen:
  `checkout.completed` (data: `checkout_id`, `status`, `payment_status`,
  `amount`, `currency`, `reference`, `customer`, `charge: { id, ... }`,
  `metadata`) and `collection.succeeded` (data: `charge_id`,
  `checkout_id`, `status: "SUCCEEDED"`, `amount`, `currency`, `reference`,
  `metadata`).

**Fixed a real bug this uncovered:** the webhook handler read
`event.data?.id` for `bachs_payment_id`, but neither real event type has
a top-level `data.id` — it would have written `null` every time. Now
reads `data.charge_id ?? data.charge?.id ?? data.checkout_id`.

**Still genuinely unconfirmed:**
- **The checkout-sessions response's URL field name.** The real test
  proved the *redirect* worked (browser reached Bachs's hosted page) but
  never logged the creation response body, so whether it's `.url`,
  `.checkout_url`, or something else is still a guess (both are checked).
  `create-promotion-checkout/index.ts` now logs the raw response if
  neither is present — check Supabase function logs on first real deploy.
- Whether live mode needs a *separate* webhook registration from sandbox
  in Bachs's dashboard (observed to be the case via their UI's
  "Switch to live" toggle, which appears to scope API keys AND webhook
  endpoints separately) — register one under live mode too, don't assume
  the sandbox one carries over.

## 4. Edge Functions reference

### 4.1 `create-promotion-checkout`

- **Invoked from:** `submitPromotion.js`, via
  `supabase.functions.invoke('create-promotion-checkout', { body: { promotionId } })`
- **Auth:** normal Supabase JWT (default Edge Function behavior — no
  special flag needed on deploy)
- **Request:** `{ promotionId: string }`
- **Response (200):** `{ checkoutUrl: string }`
- **Response (4xx/5xx):** `{ error: string }` — `submitPromotion.js` surfaces
  this as the checkout error banner on `/promote`
- **Deploy:** `supabase functions deploy create-promotion-checkout`

### 4.2 `bachs-webhook`

- **Invoked from:** BACHS's servers, registered in their dashboard as this
  function's public URL:
  `https://<project-ref>.supabase.co/functions/v1/bachs-webhook`
- **Auth:** none from Supabase's side — **must** be deployed with
  `--no-verify-jwt`, or every real BACHS delivery gets rejected before this
  function's own code even runs. Auth is instead the HMAC signature check
  inside the function itself.
- **Deploy:** `supabase functions deploy bachs-webhook --no-verify-jwt`
- Always returns `200`/`400`/`500` fast — no long-running work inside the
  handler, since BACHS will retry on non-2xx (contributing to, not solving,
  the "at least once" duplicate-delivery case the idempotency table
  already guards against).

## 5. Secrets checklist

Set with `supabase secrets set KEY=value` (never commit these, never put
them in `.env` files that ship to the client — `VITE_`-prefixed vars are
the only ones that reach the browser bundle, and none of these should be):

| Secret | Used by | Notes |
|---|---|---|
| `BACHS_SECRET_KEY` | `create-promotion-checkout` | `sk_sandbox_...` in dev, `sk_live_...` in prod — same key, different prefix decides the environment per BACHS's own convention |
| `BACHS_WEBHOOK_SECRET` | `bachs-webhook` | From BACHS dashboard's webhook-endpoint settings — a **different** value from `BACHS_SECRET_KEY`, don't reuse it |
| `BACHS_BASE_URL` | `create-promotion-checkout` | Optional — defaults to the sandbox host if unset. Set explicitly once you're ready to point at `https://api.bachs.io` |
| `SITE_URL` | `create-promotion-checkout` | e.g. `https://mapsbyfuta.app`, no trailing slash — builds `success_url`/`cancel_url`. Falls back to the request's `Origin` header if unset (fine for local dev) |

`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` are
injected into every Edge Function automatically — do not set these by hand.

## 6. Testing plan (sandbox)

1. Run `supabase/promotions.sql`, confirm the three new tables exist.
2. Deploy both functions (§4) with sandbox secrets.
3. As a real signed-in test account, go through `/promote`: fill the form,
   pick a short duration (1 day = cheapest), hit "Proceed to checkout."
4. Confirm you land on BACHS's real hosted checkout page (not an error) —
   this alone validates §3's product/checkout-session shape.
5. Pay with a BACHS sandbox test card/method.
6. Confirm the browser lands on `/promote/callback?promotion=<id>` and
   eventually (poll interval 2.5s, timeout 60s) shows "Payment received."
7. Independently check the DB: `select payment_status, status, bachs_payment_id, paid_at from promotions where id = '<id>'`
   should show `paid` / `pending_review` with both fields populated —
   confirms the webhook actually fired and was processed, not just that the
   redirect looked right.
8. Trigger the same webhook event a second time from BACHS's dashboard (if
   it offers a "resend" option) and confirm the row doesn't change again
   and no error appears in the function's logs — validates the idempotency
   guard.
9. Try a cancelled/failed checkout and confirm `/promote?cancelled=1` and
   `payment_status = 'failed'` behave as expected too.
10. Only after all of the above: swap in live secrets, do one small real
    payment, confirm the same end-to-end behavior, then hand this back for
    the admin-review slice to pick up from `status = 'pending_review'`.

## 7. Explicitly out of scope here

- The admin "Promote" review tab (approve/reject a `pending_review` row)
- Pushing an approved Physical Shop into `waypoints` (and onto Explore/the
  map, styled like every other waypoint pin — `PlaceCard.jsx`'s existing
  style, per the person's own instruction)
- Rendering an approved Online Store as a link-out card (images + a button
  to whatever link they left) — likely close in spirit to the existing
  `is_channel`/`ExploreCard.jsx` link-out pattern, but that's a design
  decision for that slice, not assumed here
- Refunds, disputes, or subscription-style recurring promotions (BACHS
  supports all of these per its SDKs; this integration only ever uses a
  one-off checkout)

These are the next doc/slice, once this payment path is confirmed working
live.