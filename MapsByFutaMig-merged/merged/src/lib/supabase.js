import { createClient } from '@supabase/supabase-js';

// ── Supabase client (replaces the legacy `window.db` Firestore instance) ───
//
// URL/key come from Vite env vars, not hardcoded here, so the real anon key
// never sits in a source file that gets committed. Create a `.env.local`
// (already gitignored by the Vite scaffold) with:
//
//   VITE_SUPABASE_URL=https://ownzoiipqcblyjwfset.supabase.co
//   VITE_SUPABASE_ANON_KEY=<your anon/publishable key>
//
// See .env.example for the template.

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  // Fail loudly at startup rather than letting every data call silently
  // 401/reject later — matches CLAUDE.md's "flag rather than guess" rule.
  console.error(
    '[supabase] Missing VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env.local and fill in real values.'
  );
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// ── Storage helper ──────────────────────────────────────────────────────────
// waypoint_images.storage_path is a path inside the `place-images` bucket,
// not a ready-to-use URL (unlike legacy Firestore's imageUrls, which stored
// full download URLs directly). Every read site needs to resolve it.
const PLACE_IMAGES_BUCKET = 'place-images';

export function getPlaceImageUrl(storagePath) {
  if (!storagePath) return null;
  const { data } = supabase.storage.from(PLACE_IMAGES_BUCKET).getPublicUrl(storagePath);
  return data?.publicUrl ?? null;
}
