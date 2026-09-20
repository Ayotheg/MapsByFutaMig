import { supabase } from '../../lib/supabase';
import { track } from '../../lib/analytics';

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
// The browser still uses Supabase's publishable/anon key. The PIN gate is
// only a UI convenience; the SQL in supabase/admin_rls.sql is the real
// boundary and restricts writes to authenticated users whose profile is an
// admin. The same policies must be applied to the live project.

const PLACE_IMAGES_BUCKET = 'place-images';

async function findExistingWaypoint({ name, lat, lng }) {
  const { data, error } = await supabase
    .from('waypoints')
    .select('id, name')
    .ilike('name', name.trim())
    .eq('lat', lat)
    .eq('lng', lng)
    .eq('status', 'approved')
    .or('source_type.is.null,source_type.neq.osm_import')
    .limit(1)
    .maybeSingle();
  if (error) throw error;
  return data;
}

async function requireAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error || !session) {
    throw new Error('Unauthorized: You must be signed in to perform admin actions.');
  }
}

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
  await requireAuth();
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
  await requireAuth();
  const { error } = await supabase.storage.from(PLACE_IMAGES_BUCKET).remove(paths);
  if (error) throw error;
}

export async function insertImageRows(table, idColumn, entityId, paths, startPosition = 0) {
  if (!paths.length) return;
  await requireAuth();
  const rows = paths.map((p, i) => ({ [idColumn]: entityId, storage_path: p, position: startPosition + i }));
  const { error } = await supabase.from(table).insert(rows);
  if (error) throw error;
}

export async function deleteImageRows(table, ids) {
  if (!ids.length) return;
  await requireAuth();
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
//
// Explore fields (isExplore/exploreTags/explorePriority/isPromoted/
// sponsorName/promoLabel — supabase/explore_fields.sql) are optional
// patch fields, not required ones: AdminEditModal.jsx always passes them
// now, but this stays backward-compatible with any other caller passing
// only name/description/type.
export async function updateWaypoint(id, { name, description, type, isExplore, exploreTags, explorePriority, isPromoted, sponsorName, promoLabel }) {
  await requireAuth();
  // Admin edits are only opened from the approved waypoint list. Writing the
  // status explicitly repairs older rows whose status is still null and does
  // not depend on a database default being present.
  const patch = { name, description, type, status: 'approved' };
  const explorePatch = {};
  let warning = null;
  if (isExplore !== undefined) explorePatch.is_explore = !!isExplore;
  if (exploreTags !== undefined) explorePatch.explore_tags = exploreTags;
  if (explorePriority !== undefined) explorePatch.explore_priority = explorePriority;
  if (isPromoted !== undefined) explorePatch.is_promoted = !!isPromoted;
  if (sponsorName !== undefined) explorePatch.sponsor_name = sponsorName || null;
  if (promoLabel !== undefined) explorePatch.promo_label = promoLabel || 'Promoted';

  const hasExploreFields = Object.keys(explorePatch).length > 0;
  const { data, error } = await supabase
    .from('waypoints')
    .update(hasExploreFields ? { ...patch, ...explorePatch } : patch)
    .eq('id', id)
    .select('id')
    .maybeSingle();

  if (error && hasExploreFields && /column .* does not exist/i.test(error.message || '')) {
    // supabase/explore_fields.sql hasn't been run yet — don't let that
    // block saving the ordinary name/description/type edit too.
    const { data: baseData, error: baseError } = await supabase
      .from('waypoints')
      .update(patch)
      .eq('id', id)
      .select('id')
      .maybeSingle();
    if (baseError) throw baseError;
    if (!baseData) throw new Error('Waypoint was not updated. Check your admin access and try again.');
    warning = 'Saved the waypoint, but Explore fields need supabase/explore_fields.sql before those options can be saved.';
  }
  if (error) throw error;
  if (!data) throw new Error('Waypoint was not updated. Check your admin access and try again.');
  // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9).
  track('admin_action', { action: 'update', entity: 'waypoint' });
  return { warning };
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
  await requireAuth();
  const { error } = await supabase.from('waypoints').delete().eq('id', id);
  if (error) throw error;
  track('admin_action', { action: 'delete', entity: 'waypoint' });
}

// Legacy: `adminAddPointSave` (app.js ~3418–3459). `source_type:
// 'gps_annotation'` matches legacy's literal value exactly (the type this
// port's `useWaypoints.js` already filters `osm_import` rows out by).
export async function insertWaypoint({ name, description, type, lat, lng }) {
  await requireAuth();
  const existing = await findExistingWaypoint({ name, lat, lng });
  if (existing) {
    throw new Error(`This waypoint already exists: "${existing.name}". Edit the existing point instead of importing it again.`);
  }
  // The migrated schema preserves Firestore IDs as text and older databases
  // may not have the later default from waypoint_submissions.sql yet.
  const id = crypto.randomUUID();
  const { data, error } = await supabase
    .from('waypoints')
    .insert({
      id,
      name,
      description,
      type,
      lat,
      lng,
      source_type: 'gps_annotation',
      status: 'approved',
      saved_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) {
    if (error.code === '23505') {
      throw new Error('This waypoint already exists. Refresh the map and edit the existing point instead.');
    }
    throw error;
  }
  track('admin_action', { action: 'insert', entity: 'waypoint' });
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
  await requireAuth();
  const { data, error } = await supabase
    .from('waypoints')
    .update({ status: 'approved' })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Submission was not approved. Check your admin access and try again.');
  track('admin_action', { action: 'approve', entity: 'waypoint_submission' });
}

export async function rejectWaypoint(id, reason) {
  await requireAuth();
  const { data, error } = await supabase
    .from('waypoints')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', id)
    .select('id')
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new Error('Submission was not rejected. Check your admin access and try again.');
  track('admin_action', { action: 'reject', entity: 'waypoint_submission' });
}

// ── Segments ─────────────────────────────────────────────────────────────
// Legacy: `adminSaveBtn`'s segment branch (app.js ~4156–4197) also
// batch-writes a denormalized `segmentName` onto every child waypoint doc.
// Not ported — waypoints join to `segments.name` live via `segment_id`
// (Slice 4/5's established deviation, confirmed against
// FIREBASE_TO_SUPABASE_MIGRATION.md), so there's no copy to keep in sync.
export async function updateSegment(id, { name, description, category }) {
  await requireAuth();
  const { error } = await supabase.from('segments').update({ name, description, category }).eq('id', id);
  if (error) throw error;
  track('admin_action', { action: 'update', entity: 'segment' });
}

// Legacy: `adminDeleteBtn`'s segment branch (app.js ~4302–4318). Per
// FIREBASE_TO_SUPABASE_MIGRATION.md's schema, `segment_points`/
// `segment_images` cascade-delete with the segment; `waypoints.segment_id`
// is `on delete set null` (children are orphaned from the route, not
// deleted) — matches legacy's own behavior of only ever deleting the
// segment doc itself, never its recorded waypoints.
export async function deleteSegment(id) {
  await requireAuth();
  const { error } = await supabase.from('segments').delete().eq('id', id);
  if (error) throw error;
  track('admin_action', { action: 'delete', entity: 'segment' });
}

// ── KML tab → "Import to Supabase" ──────────────────────────────────────
// Legacy: the KML edit-modal's `aeKmlImportBtn` handler (app.js
// ~4017–4096) — turns a session-only admin-loaded KML feature into a real
// row. Point features become a waypoint; line features become a segment
// (+ its recorded `segment_points`, one per vertex, distance computed via
// `haversine` — same as legacy's own inline distance loop there).
export async function insertKmlPointAsWaypoint({ name, description, type = 'landmark', lat, lng }) {
  return insertWaypoint({ name, description, type, lat, lng });
}

export async function insertKmlLineAsSegment({ name, description, points, distanceM }) {
  await requireAuth();
  const { data, error } = await supabase
    .from('segments')
    .insert({
      id: crypto.randomUUID(),
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
  track('admin_action', { action: 'insert', entity: 'segment' });

  if (points.length > 0) {
    const rows = points.map((p, seq) => ({ segment_id: segmentId, seq, lat: p.lat, lng: p.lng }));
    const { error: ptErr } = await supabase.from('segment_points').insert(rows);
    if (ptErr) throw ptErr;
  }
  return segmentId;
}