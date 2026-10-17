// ── supabase/functions/sync-resend-contact/index.ts ──────────────────────
//
// Mirrors a user's marketing consent (profiles.marketing_opt_in) into
// Resend. Called ONLY by the `on_profile_marketing_opt_in_changed` trigger
// (see supabase/marketing_optin.sql) via pg_net — never by the browser.
//
// Deploy: `supabase functions deploy sync-resend-contact --no-verify-jwt`
// Same auth as send-welcome-email: the shared x-webhook-secret header.
//
// Resend API (Oct 2026): Audiences are now Segments and contacts are
// global, so this uses /contacts + /contacts/{email}/segments/{id}, not the
// deprecated /audiences/{id}/contacts.
//   opt in  → resubscribe the contact if it exists (it may be one of the
//             subscribers imported earlier), else create it; then make sure
//             it's in the segment.
//   opt out → mark it unsubscribed. Never deleted.
//
// The trigger fires per change and pg_net requests can arrive out of
// order (on → off quickly), so the CURRENT profiles value decides what to
// do, not the payload's opt_in.
//
// Secrets needed (supabase secrets set ...):
//   RESEND_AUDIENCE_ID       — the subscribers segment id (Resend → Audience → Segments)
//   RESEND_CONTACTS_API_KEY  — optional; falls back to RESEND_API_KEY (which
//                              must then be Full access — a sending-only key
//                              can't manage contacts)
//   WELCOME_WEBHOOK_SECRET   — reused; equals the vault secret `welcome_webhook_secret`
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-provided.

import { createClient } from 'npm:@supabase/supabase-js@2';

const RESEND = 'https://api.resend.com';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

type ResendResult = { ok: boolean; status: number; detail: string };

async function resend(key: string, method: string, path: string, body?: unknown): Promise<ResendResult> {
  const res = await fetch(`${RESEND}${path}`, {
    method,
    headers: { Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const detail = await res.text();
  return { ok: res.ok, status: res.status, detail };
}

const alreadyExists = (r: ResendResult) => r.status === 409 || /already/i.test(r.detail);

async function subscribe(key: string, segmentId: string, email: string, firstName: string): Promise<ResendResult> {
  const contact = encodeURIComponent(email);
  let r = await resend(key, 'PATCH', `/contacts/${contact}`, { unsubscribed: false });
  if (r.status === 404) {
    r = await resend(key, 'POST', '/contacts', {
      email,
      first_name: firstName || undefined,
      unsubscribed: false,
      segments: [{ id: segmentId }],
    });
    if (r.ok) return r;
    // Created by a concurrent request in the meantime — resubscribe it below.
    if (!alreadyExists(r)) return r;
    r = await resend(key, 'PATCH', `/contacts/${contact}`, { unsubscribed: false });
  }
  if (!r.ok) return r;
  const add = await resend(key, 'POST', `/contacts/${contact}/segments/${segmentId}`);
  return add.ok || alreadyExists(add) ? { ...add, ok: true } : add;
}

async function unsubscribe(key: string, email: string): Promise<ResendResult> {
  const r = await resend(key, 'PATCH', `/contacts/${encodeURIComponent(email)}`, { unsubscribed: true });
  // Never in Resend → nothing to unsubscribe.
  return r.status === 404 ? { ...r, ok: true } : r;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('WELCOME_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[sync-resend-contact] WELCOME_WEBHOOK_SECRET not set — rejecting.');
    return json(500, { error: 'Not configured' });
  }
  if (req.headers.get('x-webhook-secret') !== webhookSecret) {
    return json(401, { error: 'Unauthorized' });
  }

  let payload: { user_id?: string; email?: string; first_name?: string | null; opt_in?: boolean };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const { user_id, email } = payload;
  if (!user_id || !email) {
    return json(400, { error: 'user_id and email are required' });
  }

  const key = Deno.env.get('RESEND_CONTACTS_API_KEY') || Deno.env.get('RESEND_API_KEY');
  const segmentId = Deno.env.get('RESEND_AUDIENCE_ID');
  if (!key || !segmentId) {
    console.error('[sync-resend-contact] RESEND_CONTACTS_API_KEY/RESEND_API_KEY or RESEND_AUDIENCE_ID missing.');
    return json(500, { error: 'Not configured' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  const { data: profile, error: readError } = await admin
    .from('profiles')
    .select('marketing_opt_in')
    .eq('id', user_id)
    .maybeSingle();
  if (readError || !profile) {
    console.error('[sync-resend-contact] profile read failed', user_id, readError);
    return json(500, { error: 'Database error' });
  }
  const optIn = profile.marketing_opt_in === true;

  const result = optIn
    ? await subscribe(key, segmentId, email, (payload.first_name ?? '').trim())
    : await unsubscribe(key, email);

  if (!result.ok) {
    console.error('[sync-resend-contact] Resend error', user_id, optIn ? 'opt_in' : 'opt_out', result.status, result.detail);
    return json(500, { error: 'Resend failed', status: result.status });
  }

  const { error: stampError } = await admin
    .from('profiles')
    .update({ resend_synced_at: new Date().toISOString() })
    .eq('id', user_id);
  if (stampError) console.error('[sync-resend-contact] resend_synced_at update failed', user_id, stampError);

  return json(200, { synced: true, opt_in: optIn });
});
