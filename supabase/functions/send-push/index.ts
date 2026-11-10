// ── supabase/functions/send-push/index.ts ────────────────────────────────
//
// Sends what's due in push_queue (supabase/push_notifications.sql). Woken
// every minute by pg_cron's kick_push_sender() — only when something is
// due — never by the browser.
//
// Deploy: `supabase functions deploy send-push --no-verify-jwt`
// (the cron call has no user JWT; it uses the x-webhook-secret header,
// same pattern as send-welcome-email).
//
// Secrets (supabase secrets set ...):
//   VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY — the app's push key pair (base64url);
//                                         the public one is also VITE_VAPID_PUBLIC_KEY
//   VAPID_SUBJECT        — optional, defaults to mailto:hello@mapsbyfuta.xyz
//   PUSH_WEBHOOK_SECRET  — must equal the vault secret `push_webhook_secret`
//   IMAGE_PROXY_URL      — optional, same ImageKit endpoint the app uses
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are auto-provided.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { sendWebPush } from '../_shared/webpush.js';
import { buildPayload, decide } from '../_shared/pushRules.js';

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

type Row = {
  id: number;
  user_id: string;
  kind: string;
  title: string;
  body: string | null;
  url: string | null;
  image_path: string | null;
  tag: string | null;
  actions: unknown;
  created_at: string;
};
type Sub = { id: number; user_id: string; endpoint: string; p256dh: string; auth: string };

function imageUrl(path: string | null): string | undefined {
  if (!path) return undefined;
  const clean = encodeURI(path.replace(/^\/+/, ''));
  const proxy = (Deno.env.get('IMAGE_PROXY_URL') || '').trim().replace(/\/+$/, '');
  // 2:1 picture, small enough for a notification.
  if (proxy) return `${proxy}/${clean}?tr=w-720,h-360,c-maintain_ratio,fo-auto,q-70`;
  return `${Deno.env.get('SUPABASE_URL')}/storage/v1/object/public/place-images/${clean}`;
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const secret = Deno.env.get('PUSH_WEBHOOK_SECRET');
  if (!secret) {
    console.error('[send-push] PUSH_WEBHOOK_SECRET not set — rejecting.');
    return json(500, { error: 'Not configured' });
  }
  if (req.headers.get('x-webhook-secret') !== secret) return json(401, { error: 'Unauthorized' });

  const vapid = {
    publicKey: Deno.env.get('VAPID_PUBLIC_KEY') || '',
    privateKey: Deno.env.get('VAPID_PRIVATE_KEY') || '',
    subject: Deno.env.get('VAPID_SUBJECT') || 'mailto:hello@mapsbyfuta.xyz',
  };
  if (!vapid.publicKey || !vapid.privateKey) {
    console.error('[send-push] VAPID keys missing.');
    return json(500, { error: 'Not configured' });
  }

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });

  const { data: batch, error: claimError } = await admin.rpc('claim_push_batch', { p_limit: 200 });
  if (claimError) {
    console.error('[send-push] claim failed', claimError);
    return json(500, { error: 'Database error' });
  }
  const rows = (batch || []) as Row[];
  if (rows.length === 0) return json(200, { sent: 0 });

  const userIds = [...new Set(rows.map((r) => r.user_id))];
  const [{ data: profiles }, { data: subs }, { data: lastReviews }] = await Promise.all([
    admin.from('profiles').select('id, push_prefs').in('id', userIds),
    admin.from('push_subscriptions').select('id, user_id, endpoint, p256dh, auth').in('user_id', userIds),
    admin
      .from('push_queue')
      .select('user_id, sent_at')
      .eq('kind', 'review')
      .eq('status', 'sent')
      .in('user_id', userIds)
      .gte('sent_at', new Date(Date.now() - 24 * 3600 * 1000).toISOString()),
  ]);
  const prefsBy = new Map((profiles || []).map((p) => [p.id, p.push_prefs || {}]));
  const subsBy = new Map<string, Sub[]>();
  for (const s of (subs || []) as Sub[]) subsBy.set(s.user_id, [...(subsBy.get(s.user_id) || []), s]);
  const lastReviewBy = new Map<string, string>();
  for (const r of lastReviews || []) {
    const prev = lastReviewBy.get(r.user_id);
    if (!prev || r.sent_at > prev) lastReviewBy.set(r.user_id, r.sent_at);
  }

  const now = Date.now();
  const gone: number[] = [];
  const counts = { sent: 0, waiting: 0, skipped: 0, failed: 0 };

  for (const row of rows) {
    const verdict = decide(row, { now, prefs: prefsBy.get(row.user_id), lastReviewSentAt: lastReviewBy.get(row.user_id) || null });
    if (verdict === 'wait') {
      await admin.from('push_queue').update({ status: 'pending', claimed_at: null }).eq('id', row.id);
      counts.waiting++;
      continue;
    }
    if (verdict !== 'send') {
      await admin.from('push_queue').update({ status: 'skipped', status_note: verdict.slice(5) }).eq('id', row.id);
      counts.skipped++;
      continue;
    }
    const devices = subsBy.get(row.user_id) || [];
    if (devices.length === 0) {
      await admin.from('push_queue').update({ status: 'skipped', status_note: 'no-device' }).eq('id', row.id);
      counts.skipped++;
      continue;
    }

    const withImage = { ...row, image: imageUrl(row.image_path) };
    let delivered = 0;
    let lastStatus = 0;
    for (const sub of devices) {
      try {
        const res = await sendWebPush(sub, buildPayload(withImage, sub.endpoint), vapid, {
          topic: row.tag || undefined,
          urgency: row.kind === 'review' ? 'normal' : 'low',
        });
        lastStatus = res.status;
        if (res.ok) delivered++;
        else if (res.gone) gone.push(sub.id);
        else console.warn('[send-push] push service said', res.status, 'for queue row', row.id);
      } catch (err) {
        console.warn('[send-push] send error for queue row', row.id, err);
      }
    }
    if (delivered > 0) {
      await admin.from('push_queue').update({ status: 'sent', sent_at: new Date().toISOString(), status_note: null }).eq('id', row.id);
      if (row.kind === 'review') lastReviewBy.set(row.user_id, new Date().toISOString());
      counts.sent++;
    } else {
      await admin.from('push_queue').update({ status: 'failed', status_note: `push service ${lastStatus || 'unreachable'}` }).eq('id', row.id);
      counts.failed++;
    }
  }

  // Browsers that unsubscribed or were reset: forget them.
  if (gone.length) await admin.from('push_subscriptions').delete().in('id', gone);

  return json(200, counts);
});
