import { supabase } from './supabase';

// ── Where photos live ───────────────────────────────────────────────────
// With VITE_IMAGE_CDN_URL set, photos are served from Cloudflare R2 (zero
// egress fees) and written through the `image-upload` Edge Function. With
// it unset, everything stays on Supabase Storage as before. Read URLs are
// resolved in supabase.js `getPlaceImageUrl`; writes and deletes live here.

const PLACE_IMAGES_BUCKET = 'place-images';
// Paths are unique per upload (timestamp or per-entity id), so a file never
// changes under its URL and can be cached for a year.
const ONE_YEAR_SECONDS = '31536000';

const CDN = (import.meta.env.VITE_IMAGE_CDN_URL || '').trim().replace(/\/+$/, '');

async function functionError(error, fallback) {
  try {
    const body = await error.context?.json?.();
    if (body?.error) return new Error(body.error);
  } catch {
    // Body wasn't JSON; use the generic message.
  }
  return new Error(error?.message || fallback);
}

/** Stores one already-compressed image at `path` in the place-images store. */
export async function putImage(path, file, { upsert = false } = {}) {
  if (CDN) {
    const { error } = await supabase.functions.invoke('image-upload', {
      method: 'POST',
      body: file,
      headers: { 'x-image-path': path, 'x-image-upsert': upsert ? '1' : '0' },
    });
    if (error) throw await functionError(error, 'Photo upload failed.');
    return;
  }
  const { error } = await supabase.storage
    .from(PLACE_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert, cacheControl: ONE_YEAR_SECONDS });
  if (error) throw error;
}

/** Deletes stored images by path (admin only on both backends). */
export async function deleteImages(paths) {
  if (!paths.length) return;
  if (CDN) {
    const { error } = await supabase.functions.invoke('image-upload', {
      method: 'DELETE',
      body: { paths },
    });
    if (error) throw await functionError(error, 'Photo delete failed.');
    return;
  }
  const { error } = await supabase.storage.from(PLACE_IMAGES_BUCKET).remove(paths);
  if (error) throw error;
}
