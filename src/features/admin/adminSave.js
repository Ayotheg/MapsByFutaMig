import { supabase } from '../../lib/supabase';

// ── Admin panel — Supabase mutation helpers ─────────────────────────────
//
// Re-targets legacy's `window.db.collection(...).update/delete/add(...)`
// calls (app.js ~3418–4320, the `adminSaveBtn`/`adminDeleteBtn`/
// `adminAddPointSave` handlers + the KML edit-modal's "IMPORT TO FIREBASE"
// button) onto Supabase, matching CLAUDE.md's "Supabase only" rule and
// segmentSave.js's (Slice 5) established insert/upload pattern.
//
// ── Deliberate deviation from legacy: images ────────────────────────────
// Legacy keeps a single `imageUrls: string[]` field per waypoint/segment
// doc (base64 data URIs, resaved wholesale on every edit — app.js
// ~4109/4162). This schema normalizes images into their own
// `waypoint_images`/`segment_images` tables (Slice 2/4/5's precedent), so
// there's no single array to overwrite — this file exposes row-level
// upload/insert/delete instead. `AdminEditModal.jsx` fetches a waypoint's/
// segment's existing image rows itself (own concern, not threaded through
// useWaypoints.js/useSegments.js, which only expose resolved display URLs)
// and reconciles added/removed images against these functions on save.
//
// ── Unverified — flag before relying on this live ───────────────────────
// Same exposure segmentSave.js already flagged: this client uses the anon
// key. Legacy's PIN gate is (by its own comment, adminPin.js) a UI
// convenience only — these UPDATE/DELETE/INSERT calls need real RLS
// policies (ideally scoped to `auth.uid()`, now that Slice 10 exists) on
// `waypoints`/`segments`/`waypoint_images`/`segment_images`/
// `segment_points` before they'll actually succeed for anyone. Not
// confirmed live.

const PLACE_IMAGES_BUCKET = 'place-images';

// ── Images ───────────────────────────────────────────────────────────────

/** Raw image rows (with row id + storage_path, not just a resolved URL) —
 * needed so the edit modal can delete/reorder individual images, which
 * useWaypoints.js/useSegments.js's shaped output doesn't expose. */
export async function fetchImageRows(table, idColumn, entityId) {
  const { data, error } = await supabase
    .from(table)
    .select('id, storage_path, position')
    .eq(idColumn, entityId)
    .order('position', { ascending: true });
  if (error) throw error;
  return data || [];
}

export async function uploadImage(kind, entityId, file, position) {
  const ext = (file.name.split('.').pop() || 'jpg').toLowerCase();
  const path = `${kind}/${entityId}/${position}-${Date.now()}.${ext}`;
  const { error } = await supabase.storage
    .from(PLACE_IMAGES_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: true });
  if (error) throw error;
  return path;
}

export async function removeStorageFiles(paths) {
  if (!paths.length) return;
  const { error } = await supabase.storage.from(PLACE_IMAGES_BUCKET).remove(paths);
  if (error) throw error;
}

export async function insertImageRows(table, idColumn, entityId, paths, startPosition = 0) {
  if (!paths.length) return;
  const rows = paths.map((p, i) => ({ [idColumn]: entityId, storage_path: p, position: startPosition + i }));
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}

export async function deleteImageRows(table, ids) {
  if (!ids.length) return;
  const { error } = await supabase.from(table).delete().in('id', ids);
  if (error) throw error;
}

// ── Waypoints ────────────────────────────────────────────────────────────
// Legacy: `adminSaveBtn`'s waypoint branch (app.js ~4103–4154). This port
// skips all the imperative marker/popup/search-entry patching legacy does
// after the write (`marker.setIcon`, `_placeCardOpts` rebuild, `FUTA_
// SEARCH.index.find(...)` mutation) — WaypointLayer/PlaceCard/useSearchIndex
// all re-render declaratively from the `waypoints` prop once the caller
// calls `refetch()`, same "refetch instead of hand-patch" deviation
// segmentSave.js already established for the save flow.
export async function updateWaypoint(id, { name, description, type }) {
  const { error } = await supabase.from('waypoints').update({ name, description, type }).eq('id', id);
  if (error) throw error;
}

// Legacy: `adminDeleteBtn`'s waypoint branch (app.js ~4283–4300). Only
// deletes the waypoints row — `waypoint_images` cascade-deletes per the DB
// FK (FIREBASE_TO_SUPABASE_MIGRATION.md Step 0), but the Storage *files*
// themselves don't (a DB cascade can't reach Storage) — callers should
// pass the waypoint's image storage_paths so this can also call
// removeStorageFiles, or they'll be orphaned. Flagged, not silently
// skipped: legacy never had this problem (base64-in-doc, nothing external
// to orphan).
export async function deleteWaypoint(id) {
  const { error } = await supabase.from('waypoints').delete().eq('id', id);
  if (error) throw error;
}

// Legacy: `adminAddPointSave` (app.js ~3418–3459). `source_type:
// 'gps_annotation'` matches legacy's literal value exactly (the type this
// port's `useWaypoints.js` already filters `osm_import` rows out by).
export async function insertWaypoint({ name, description, type, lat, lng }) {
  const { data, error } = await supabase
    .from('waypoints')
    .insert({
      name,
      description,
      type,
      lat,
      lng,
      source_type: 'gps_annotation',
      saved_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  return data.id;
}

// ── Pending submissions (Slice 13) ──────────────────────────────────────
// No legacy equivalent — a genuinely new admin action, not a port. Lives
// here (not `submitWaypoint.js`) for the same reason every other function
// in this file does: it's an admin write. RLS's `admin_update` policy
// (`supabase/waypoint_submissions.sql`) is what actually enforces only
// admins can call these successfully — this client uses the anon key,
// same as every other call in this file.
export async function approveWaypoint(id) {
  const { error } = await supabase.from('waypoints').update({ status: 'approved' }).eq('id', id);
  if (error) throw error;
}

export async function rejectWaypoint(id, reason) {
  const { error } = await supabase
    .from('waypoints')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', id);
  if (error) throw error;
}

// ── Segments ─────────────────────────────────────────────────────────────
// Legacy: `adminSaveBtn`'s segment branch (app.js ~4156–4197) also
// batch-writes a denormalized `segmentName` onto every child waypoint doc.
// Not ported — waypoints join to `segments.name` live via `segment_id`
// (Slice 4/5's established deviation, confirmed against
// FIREBASE_TO_SUPABASE_MIGRATION.md), so there's no copy to keep in sync.
export async function updateSegment(id, { name, description, category }) {
  const { error } = await supabase.from('segments').update({ name, description, category }).eq('id', id);
  if (error) throw error;
}

// Legacy: `adminDeleteBtn`'s segment branch (app.js ~4302–4318). Per
// FIREBASE_TO_SUPABASE_MIGRATION.md's schema, `segment_points`/
// `segment_images` cascade-delete with the segment; `waypoints.segment_id`
// is `on delete set null` (children are orphaned from the route, not
// deleted) — matches legacy's own behavior of only ever deleting the
// segment doc itself, never its recorded waypoints.
export async function deleteSegment(id) {
  const { error } = await supabase.from('segments').delete().eq('id', id);
  if (error) throw error;
}

// ── KML tab → "Import to Supabase" ──────────────────────────────────────
// Legacy: the KML edit-modal's `aeKmlImportBtn` handler (app.js
// ~4017–4096) — turns a session-only admin-loaded KML feature into a real
// row. Point features become a waypoint; line features become a segment
// (+ its recorded `segment_points`, one per vertex, distance computed via
// `haversine` — same as legacy's own inline distance loop there).
export async function insertKmlPointAsWaypoint({ name, description, lat, lng }) {
  return insertWaypoint({ name, description, type: 'landmark', lat, lng });
}

export async function insertKmlLineAsSegment({ name, description, points, distanceM }) {
  const { data, error } = await supabase
    .from('segments')
    .insert({
      name,
      description,
      category: 'other',
      distance_m: distanceM,
      duration_ms: 0,
      recorded_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  const segmentId = data.id;

  if (points.length > 0) {
    const rows = points.map((p, seq) => ({ segment_id: segmentId, seq, lat: p.lat, lng: p.lng }));
    const { error: ptErr } = await supabase.from('segment_points').insert(rows);
    if (ptErr) throw ptErr;
  }
  return segmentId;
}