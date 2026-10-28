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
import { createHandler } from './handler.ts';

// All logic lives in handler.ts so it can be tested under Node
// (scripts/bachsWebhook.test.mjs) without Deno or a real database.
Deno.serve(createHandler({ createClient, env: Deno.env }));
