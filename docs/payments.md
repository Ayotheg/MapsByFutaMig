# Payments (Promote, via BACHS)

Businesses pay to be featured. Payment goes through BACHS (https://bachs.io).

## Flow
1. `/promote` form → `src/features/promote/submitPromotion.js`: validates, uploads photos
   (`place-images/promotion/<id>/…`), inserts a `promotions` row (`awaiting_payment`, `unpaid`).
2. Calls Edge Function `create-promotion-checkout` (normal user JWT). It re-reads the row as
   the user, works out the price from `days` (`src/features/promote/pricing.js`; never trust a
   client amount), and returns a BACHS checkout URL. The browser redirects there.
3. BACHS calls Edge Function `bachs-webhook` (deployed `verify_jwt = false`). It checks the
   HMAC signature, skips repeat events (`bachs_webhook_events`), and sets
   `payment_status = 'paid'`, `status = 'pending_review'`.
4. `/promote/callback` (`PromoteCallbackPage.jsx`) polls `payment_status`. The redirect alone
   proves nothing.
5. An admin approves it in the admin panel (`supabase/promotions_admin.sql`).

## Rules
- Only `bachs-webhook` may mark a promotion paid. Never add a client-side "mark paid" path.
- BACHS amounts are in naira (major units). Don't multiply or divide by 100.
- Code: `supabase/functions/_shared/bachs.ts`, `supabase/promotions*.sql`.

## Secrets (Supabase secrets, never in code)
| Secret | Used by |
|---|---|
| `BACHS_SECRET_KEY` (`sk_sandbox_…` / `sk_live_…`) | create-promotion-checkout |
| `BACHS_WEBHOOK_SECRET` (different from the key) | bachs-webhook |
| `BACHS_BASE_URL` (optional, defaults to sandbox) | create-promotion-checkout |
| `SITE_URL` (no trailing slash) | create-promotion-checkout |

## Not yet confirmed against BACHS's docs
The REST paths, the webhook payload field holding the promotion id, and the exact HMAC
signed string. Check them in the function logs on the first real payment.
