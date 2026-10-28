// ── supabase/functions/image-upload/index.ts ─────────────────────────────
//
// Writes place photos to Cloudflare R2 (zero egress fees) on behalf of the
// signed-in user. The browser can't hold R2 keys, so it sends the already
// compressed image here (src/lib/imageHost.js) and this function checks the
// same rules the Supabase `place-images` storage policies enforce:
//
//   - signed-in users: may add files under waypoint/, promotion/, event/
//   - admins (profiles.is_admin): any folder, may overwrite and delete
//
// Photos are then served straight from R2 via its custom domain
// (VITE_IMAGE_CDN_URL), so this function is only on the upload path.
//
// POST   body = image bytes, headers: x-image-path, x-image-upsert (0|1)
// DELETE body = { "paths": ["waypoint/…/0-1700000000000.jpg", …] }  (admin)
//
// Deploy: `supabase functions deploy image-upload`
// Secrets (never in code): R2_ACCOUNT_ID, R2_ACCESS_KEY_ID,
//   R2_SECRET_ACCESS_KEY, R2_BUCKET — an R2 API token limited to that bucket
//   with Object Read & Write.

import { createClient } from 'npm:@supabase/supabase-js@2';
import { AwsClient } from 'npm:aws4fetch@1.0.20';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers':
    'authorization, x-client-info, apikey, content-type, x-image-path, x-image-upsert',
  'Access-Control-Allow-Methods': 'POST, DELETE, OPTIONS',
};

const MAX_BYTES = 2 * 1024 * 1024; // client compresses to ~800 KB; this is the hard ceiling
const ALLOWED_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
// <folder>/<entity id>/<file>.<ext> — one level of entity, no traversal.
const PATH_RE = /^(waypoint|waypoints|promotion|event|segments)\/[A-Za-z0-9_-]{1,64}\/[A-Za-z0-9._-]{1,100}\.(jpe?g|png|webp|gif)$/i;
const USER_FOLDERS = new Set(['waypoint', 'promotion', 'event']);
const MAX_DELETE = 50;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS_HEADERS });
  if (req.method !== 'POST' && req.method !== 'DELETE') {
    return json({ error: 'Method not allowed' }, 405);
  }

  const authHeader = req.headers.get('Authorization');
  if (!authHeader) return json({ error: 'Not signed in.' }, 401);

  const caller = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } },
  });
  const { data: userRes } = await caller.auth.getUser();
  const user = userRes?.user;
  if (!user) return json({ error: 'Not signed in.' }, 401);

  const { data: profile } = await caller
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .maybeSingle();
  const isAdmin = !!profile?.is_admin;

  const accountId = Deno.env.get('R2_ACCOUNT_ID');
  const bucket = Deno.env.get('R2_BUCKET');
  const accessKeyId = Deno.env.get('R2_ACCESS_KEY_ID');
  const secretAccessKey = Deno.env.get('R2_SECRET_ACCESS_KEY');
  if (!accountId || !bucket || !accessKeyId || !secretAccessKey) {
    console.error('[image-upload] R2 secrets are not set');
    return json({ error: 'Photo storage is not configured.' }, 500);
  }
  const r2 = new AwsClient({ accessKeyId, secretAccessKey, service: 's3', region: 'auto' });
  const objectUrl = (key: string) =>
    `https://${accountId}.r2.cloudflarestorage.com/${bucket}/${key}`;

  // ── Delete (admin only, same as the Storage policy) ──────────────────
  if (req.method === 'DELETE') {
    if (!isAdmin) return json({ error: 'Only admins can delete photos.' }, 403);
    let paths: unknown;
    try {
      ({ paths } = await req.json());
    } catch {
      return json({ error: 'Malformed request body — expected { paths }' }, 400);
    }
    if (!Array.isArray(paths) || paths.length === 0 || paths.length > MAX_DELETE) {
      return json({ error: `paths must list 1–${MAX_DELETE} files.` }, 400);
    }
    if (!paths.every((p) => typeof p === 'string' && PATH_RE.test(p))) {
      return json({ error: 'Invalid photo path.' }, 400);
    }
    for (const key of paths as string[]) {
      const res = await r2.fetch(objectUrl(key), { method: 'DELETE' });
      // R2 answers 204 for a missing key too; anything else is a real failure.
      if (!res.ok) {
        console.error('[image-upload] delete failed', key, res.status);
        return json({ error: 'Could not delete a photo. Try again.' }, 502);
      }
    }
    return json({ deleted: paths.length });
  }

  // ── Upload ───────────────────────────────────────────────────────────
  const path = req.headers.get('x-image-path') || '';
  if (!PATH_RE.test(path)) return json({ error: 'Invalid photo path.' }, 400);
  const folder = path.split('/')[0];
  if (!isAdmin && !USER_FOLDERS.has(folder)) {
    return json({ error: 'You are not allowed to upload to this folder.' }, 403);
  }

  const contentType = (req.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  if (!ALLOWED_TYPES.has(contentType)) {
    return json({ error: 'Only JPG, PNG, WebP or GIF photos are allowed.' }, 415);
  }
  const declared = Number(req.headers.get('content-length'));
  if (declared > MAX_BYTES) return json({ error: 'Photo is too large.' }, 413);
  const bytes = new Uint8Array(await req.arrayBuffer());
  if (bytes.byteLength === 0) return json({ error: 'Empty file.' }, 400);
  if (bytes.byteLength > MAX_BYTES) return json({ error: 'Photo is too large.' }, 413);

  // Only admins may replace an existing file (Storage `upsert`); everyone
  // else gets create-only via a conditional write.
  const overwrite = isAdmin && req.headers.get('x-image-upsert') === '1';
  const headers: Record<string, string> = {
    'Content-Type': contentType,
    'Cache-Control': CACHE_CONTROL,
  };
  if (!overwrite) headers['If-None-Match'] = '*';

  const res = await r2.fetch(objectUrl(path), { method: 'PUT', headers, body: bytes });
  if (res.status === 412) return json({ error: 'A photo already exists at that path.' }, 409);
  if (!res.ok) {
    console.error('[image-upload] put failed', path, res.status, await res.text());
    return json({ error: 'Could not save the photo. Try again.' }, 502);
  }
  return json({ path });
});
