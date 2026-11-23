// ── supabase/functions/send-welcome-email/index.ts ───────────────────────
//
// Sends the Resend welcome template to a newly confirmed user, exactly once.
// Called ONLY by the `on_auth_user_confirmed_welcome` trigger on auth.users
// (see supabase/welcome_email.sql) via pg_net — never by the browser.
//
// Deploy: `supabase functions deploy send-welcome-email --no-verify-jwt`
// The `--no-verify-jwt` flag is REQUIRED — the database trigger has no user
// JWT. This function does its own auth instead (the shared
// x-webhook-secret header below), same pattern as bachs-webhook.
//
// Secrets needed (supabase secrets set ...):
//   RESEND_API_KEY          — dedicated "sending access" key for mapsbyfuta.xyz
//   WELCOME_TEMPLATE_ID     — published Resend template id or alias
//   WELCOME_FROM            — e.g. "Maps By FUTA <hello@mapsbyfuta.xyz>"
//   WELCOME_WEBHOOK_SECRET  — must equal the vault secret `welcome_webhook_secret`
//   WELCOME_NAME_VAR        — optional; template variable that receives the
//                             first name (defaults to `first_name`)
//   WELCOME_SUBJECT         — optional; defaults to "Welcome to Maps By FUTA"
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-provided.
//
// Duplicate protection: the profile row is *claimed* (welcome_email_sent_at
// set only if still null) before calling Resend, so two concurrent calls
// can't both send. If Resend fails the claim is released so a retry can
// send. Resend's Idempotency-Key is a second guard.

import { createClient } from 'npm:@supabase/supabase-js@2';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });

function firstName(name: string | null | undefined, email: string): string {
  const source = (name ?? '').trim() || email.split('@')[0];
  return source.split(/\s+/)[0];
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 });
  }

  const webhookSecret = Deno.env.get('WELCOME_WEBHOOK_SECRET');
  if (!webhookSecret) {
    console.error('[send-welcome-email] WELCOME_WEBHOOK_SECRET not set — rejecting.');
    return json(500, { error: 'Not configured' });
  }
  if (req.headers.get('x-webhook-secret') !== webhookSecret) {
    return json(401, { error: 'Unauthorized' });
  }

  let payload: { user_id?: string; email?: string; name?: string | null };
  try {
    payload = await req.json();
  } catch {
    return json(400, { error: 'Invalid JSON' });
  }
  const { user_id, email, name } = payload;
  if (!user_id || !email) {
    return json(400, { error: 'user_id and email are required' });
  }

  const resendKey = Deno.env.get('RESEND_API_KEY');
  const templateId = Deno.env.get('WELCOME_TEMPLATE_ID');
  const from = Deno.env.get('WELCOME_FROM');
  const nameVar = Deno.env.get('WELCOME_NAME_VAR') || 'first_name';
  const subject = Deno.env.get('WELCOME_SUBJECT') || 'Welcome to Maps By FUTA';
  if (!resendKey || !templateId || !from) {
    console.error('[send-welcome-email] RESEND_API_KEY / WELCOME_TEMPLATE_ID / WELCOME_FROM missing.');
    return json(500, { error: 'Not configured' });
  }

  const admin = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
    { auth: { persistSession: false } },
  );

  // Make sure the profile row exists (handle_new_user normally creates it;
  // this covers the case where that trigger swallowed an error).
  await admin.from('profiles').upsert({ id: user_id }, { onConflict: 'id', ignoreDuplicates: true });

  // Claim: only succeeds if the welcome email hasn't been sent yet.
  const { data: claimed, error: claimError } = await admin
    .from('profiles')
    .update({ welcome_email_sent_at: new Date().toISOString() })
    .eq('id', user_id)
    .is('welcome_email_sent_at', null)
    .select('id');
  if (claimError) {
    console.error('[send-welcome-email] claim failed', user_id, claimError);
    return json(500, { error: 'Database error' });
  }
  if (!claimed || claimed.length === 0) {
    return json(200, { skipped: 'already sent' });
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${resendKey}`,
      'Content-Type': 'application/json',
      'Idempotency-Key': `welcome-${user_id}`,
    },
    body: JSON.stringify({
      from,
      to: [email],
      subject,
      template: {
        id: templateId,
        variables: { [nameVar]: firstName(name, email) },
      },
    }),
  });

  if (!res.ok) {
    const detail = await res.text();
    console.error('[send-welcome-email] Resend error', res.status, detail);
    // Release the claim so a later retry can send.
    await admin.from('profiles').update({ welcome_email_sent_at: null }).eq('id', user_id);
    return json(500, { error: 'Resend failed', status: res.status });
  }

  const sent = await res.json();
  return json(200, { sent: true, id: sent?.id });
});
