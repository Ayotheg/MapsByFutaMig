import { supabase } from '../../lib/supabase';

/**
 * segmentSave.js — Supabase insert logic for the save flow.
 *
 * Re-targets legacy `saveToFbBtn`'s click handler (app.js ~2219–2302),
 * which wrote straight to Firebase (`window.db`, `firebase.firestore.
 * FieldValue.serverTimestamp()`). Per MIGRATION_PLAN.md's Slice 5 row:
 * "Re-target saveToFbBtn's Firebase write to a Supabase segments insert —
 * do not port window.db/firebase.firestore.FieldValue.serverTimestamp()
 * as-is." Also per CLAUDE.md: "Supabase only. Do not write any Firebase
 * code, even temporarily."
 *
 * Schema used matches `FIREBASE_TO_SUPABASE_MIGRATION.md`'s Step 0 SQL
 * (see useSegments.js's schema note for the full cross-check):
 *   segments(id, name, description, category, distance_m, duration_ms,
 *            recorded_at, created_at)
 *   segment_points(id, segment_id, seq, lat, lng, accuracy, speed,
 *                  recorded_at)
 *   segment_images(id, segment_id, storage_path, position)
 *   waypoints(id, name, description, type, lat, lng, source_type,
 *             segment_id, saved_at, created_at)
 *
 * ── Deliberate deviations from legacy ─────────────────────────────────
 * - No `imageUrls` array on `segments` — images upload to the
 *   `place-images` Storage bucket first, then one `segment_images` row
 *   per file (storage_path + position), same normalization Slice 2 used
 *   for waypoint photos. FIREBASE_TO_SUPABASE_MIGRATION.md's "important
 *   finding" section explicitly calls out base64-in-row as the anti-
 *   pattern to not reintroduce.
 * - No denormalized `segmentName` on the inserted waypoints (legacy wrote
 *   `segmentName: name` alongside `segmentId`) — the migration doc's
 *   "Decision to confirm" section already resolves this: join to
 *   `segments.name` via `segment_id` instead of storing a redundant copy.
 * - `recorded_at` on `segments` is set from `recStartTime` (when the
 *   import/recording began) — `created_at` is left to its DB default
 *   (`now()`), unlike legacy's single `serverTimestamp()` conflating both.
 *
 * ── Unverified — flag before relying on this in production ─────────────
 * This client uses the anon key (see lib/supabase.js), and Slice 10 (Auth)
 * hasn't landed — there's no authenticated user yet. For this INSERT to
 * succeed at all, the `segments`/`segment_points`/`waypoints` tables need
 * an RLS policy permitting anon inserts (matching legacy's actual
 * behavior, where anyone — no login gate existed before Slice 10 — could
 * save a route). Image uploads have the same exposure: CLAUDE.md only
 * confirms a *public-read* policy on the `place-images` bucket, not an
 * upload/write policy. Neither is confirmed live; this code will surface
 * whatever Postgres/Storage returns (typically a 401/403) if the policy
 * is missing, rather than silently failing.
 */

const PLACE_IMAGES_BUCKET = 'place-images';

/**
 * Uploads a File to Supabase Storage and returns its storage path (not a
 * public URL — same convention waypoint_images/segment_images already use,
 * resolved to a URL on read via getPlaceImageUrl).
 */
async function uploadSegmentImage(segmentId, file, position) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `segments/${segmentId}/${position}.${ext}`;
  const { error } = await supabase.storage
    .from(PLACE_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  return path;
}

/**
 * Saves a recorded/imported segment to Supabase: one `segments` row, its
 * `segment_points`, any uploaded `segment_images`, and one `waypoints` row
 * per recorded waypoint (linked via `segment_id`).
 *
 * @param {object} draft - { name, description, category, points, waypoints, distance, recStartTime }
 * @param {File[]} imageFiles - up to 5 selected photo files
 * @returns {Promise<string>} the new segment's id
 */
export async function saveSegment(draft, imageFiles = []) {
  const { name, description, category, points, waypoints, distance, recStartTime } = draft;

  const { data: segRow, error: segErr } = await supabase
    .from('segments')
    .insert({
      name,
      description,
      category,
      distance_m: distance,
      duration_ms: recStartTime ? Date.now() - recStartTime : 0,
      recorded_at: recStartTime ? new Date(recStartTime).toISOString() : new Date().toISOString(),
    })
    .select('id')
    .single();

  if (segErr) throw segErr;
  const segmentId = segRow.id;

  if (points.length > 0) {
    const pointRows = points.map((p, seq) => ({
      segment_id: segmentId,
      seq,
      lat: p.lat,
      lng: p.lng,
      accuracy: p.accuracy ?? null,
      speed: p.speed ?? null,
      recorded_at: p.timestamp ? new Date(p.timestamp).toISOString() : null,
    }));
    const { error: ptErr } = await supabase.from('segment_points').insert(pointRows);
    if (ptErr) throw ptErr;
  }

  if (imageFiles.length > 0) {
    const imageRows = [];
    for (let i = 0; i < imageFiles.length; i++) {
      const path = await uploadSegmentImage(segmentId, imageFiles[i], i);
      imageRows.push({ segment_id: segmentId, storage_path: path, position: i });
    }
    const { error: imgErr } = await supabase.from('segment_images').insert(imageRows);
    if (imgErr) throw imgErr;
  }

  if (waypoints.length > 0) {
    const wpRows = waypoints.map((wp) => ({
      name: wp.name,
      description: wp.desc || '',
      type: wp.type || 'landmark',
      lat: wp.lat,
      lng: wp.lng,
      source_type: 'gps_annotation',
      segment_id: segmentId,
      saved_at: new Date().toISOString(),
    }));
    const { error: wpErr } = await supabase.from('waypoints').insert(wpRows);
    if (wpErr) throw wpErr;
  }

  return segmentId;
}
