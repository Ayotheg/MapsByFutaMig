import { createClient } from '@supabase/supabase-js';

// ── Supabase client (replaces the legacy `window.db` Firestore instance) ───
//
// URL/key come from Vite env vars, not hardcoded here, so the real anon key
// never sits in a source file that gets committed. Create a `.env.local`
// (already gitignored by the Vite scaffold) with:
//
//   VITE_SUPABASE_URL=https://ownnzoiipqcblyjwfset.supabase.co
//   VITE_SUPABASE_ANON_KEY=<your anon/publishable key>
//
// See .env.example for the template.

// Vite preserves whitespace from .env files. Trim both values so a copied
// key cannot become a different websocket URL (for example, with `%0A`).
const supabaseUrl = import.meta.env.VITE_SUPABASE_URL?.trim();
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY?.trim();

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup rather than letting every data call silently
  // 401/reject later — matches CLAUDE.md's "flag rather than guess" rule.
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env.local and fill in real values.'
  );
}

// A reset-password LINK lands with `#access_token=…&type=recovery` in the
// URL, and supabase-js would turn that into a signed-in session on whatever
// page it hits (e.g. /map when /reset-password isn't in Supabase's Redirect
// URLs) — the "click the link and you're just logged in" bug. Before the
// client reads the URL, forward it, hash intact, to ResetPasswordPage, which
// asks for a new password and signs out afterwards. The sign-in card's
// code-based reset never puts this in the URL, so it's unaffected.
if (
  typeof window !== 'undefined' &&
  /(^|[#&])type=recovery(&|$)/.test(window.location.hash) &&
  window.location.pathname !== '/reset-password'
) {
  window.location.replace(`/reset-password${window.location.hash}`);
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Storage helper ──────────────────────────────────────────────────────────
// waypoint_images.storage_path is a path inside the `place-images` bucket,
// not a ready-to-use URL (unlike legacy Firestore's imageUrls, which stored
// full download URLs directly). Every read site needs to resolve it.
const PLACE_IMAGES_BUCKET = 'place-images';

// When set, photos are served from this origin (Cloudflare R2 behind a custom
// domain) instead of Supabase Storage. See lib/imageHost.js and
// IMAGE_MIGRATION.md.
const IMAGE_CDN_URL = (import.meta.env.VITE_IMAGE_CDN_URL || '').trim().replace(/\/+$/, '');

// Read-only image proxy (ImageKit) in front of Supabase Storage. Photos are
// fetched from Supabase once, then resized and served from the proxy's cache,
// so repeat views stop costing Supabase egress. Uploads still go to Supabase.
const IMAGE_PROXY_URL = (import.meta.env.VITE_IMAGE_PROXY_URL || '').trim().replace(/\/+$/, '');
// w-900: plenty for a place card on a phone; q-75 + f-auto keep it small.
const IMAGE_PROXY_TRANSFORM = 'tr=w-900,q-75,f-auto';

export function getPlaceImageUrl(storagePath) {
  if (!storagePath) return null;
  if (IMAGE_CDN_URL) return `${IMAGE_CDN_URL}/${storagePath}`;
  if (IMAGE_PROXY_URL) return `${IMAGE_PROXY_URL}/${storagePath}?${IMAGE_PROXY_TRANSFORM}`;
  const { data } = supabase.storage.from(PLACE_IMAGES_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl ?? null;
}
