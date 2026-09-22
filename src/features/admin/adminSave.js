import { supabase } from '../../lib/supabase';
import { track } from '../../lib/analytics';
import { normalizeWaypointType } from '../waypoints/wpTypeMeta';

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


// ── Silent-failure guard ─────────────────────────────────────────────────
// Postgres Row-Level Security does NOT raise an error when an UPDATE or
// DELETE is filtered out by policy — PostgREST answers "204 OK, 0 rows
// changed". supabase-js therefore reports `error: null` and the old code
// happily showed "Waypoint updated!" / "Approved" while nothing had been
// written (and, since nothing changed, the map never refreshed). Every
// admin write below now asks for the affected rows back (`.select('id')`)
// and calls this when none came back, so a blocked write is a loud,
// explained failure instead of a silent no-op.
async function blockedWriteError(action) {
  let reason =
    'The database accepted the request but changed nothing — a Row-Level Security policy blocked it.';
  try {
    const { data: userRes } = await supabase.auth.getUser();
    const user = userRes?.user;
    if (!user) {
      reason = 'You are not signed in to Maps By FUTA. Sign in first, then open the admin panel again.';
    } else {
      const { data: profile } = await supabase
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .maybeSingle();
      if (!profile?.is_admin) {
        reason =
          `Your account (${user.email || user.id}) is not marked as an admin in the database, ` +
          'so it is not allowed to change waypoints. The PIN only unlocks the panel — the database checks ' +
          "profiles.is_admin. Run: update profiles set is_admin = true where id = '" + user.id + "';";
      } else {
        reason =
          'Your account is an admin, but the waypoints table has no policy allowing this action. ' +
          'Run supabase/admin_waypoint_policies.sql in the Supabase SQL editor.';
      }
    }
  } catch {
    // Diagnosis is best-effort; fall through with the generic message.
  }
  return new Error(`Could not ${action}. ${reason}`);
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
//
// Explore fields (isExplore/exploreTags/explorePriority/isPromoted/
// sponsorName/promoLabel — supabase/explore_fields.sql) are optional
// patch fields, not required ones: AdminEditModal.jsx always passes them
// now, but this stays backward-compatible with any other caller passing
// only name/description/type.
export async function updateWaypoint(id, { name, description, type, isExplore, exploreTags, explorePriority, isPromoted, sponsorName, promoLabel }) {
  // Never write a type the map/legend can't render (see wpTypeMeta.js).
  const patch = { name, description };
  if (type !== undefined) patch.type = normalizeWaypointType(type);
  const explorePatch = {};
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
    .select('id');

  // PostgREST's missing-column message is "Could not find the 'x' column of
  // 'waypoints' in the schema cache" (code PGRST204); Postgres' own is
  // "column ... does not exist" (42703). The old check only matched the
  // second form, so a not-yet-migrated Explore column blocked the whole save.
  const missingColumn =
    error &&
    (error.code === 'PGRST204' ||
      error.code === '42703' ||
      /column .* does not exist|could not find the .* column/i.test(error.message || ''));

  if (missingColumn && hasExploreFields) {
    // supabase/explore_fields.sql hasn't been run yet — don't let that
    // block saving the ordinary name/description/type edit too.
    const { data: baseData, error: baseError } = await supabase
      .from('waypoints')
      .update(patch)
      .eq('id', id)
      .select('id');
    if (baseError) throw baseError;
    if (!baseData?.length) throw await blockedWriteError('save this waypoint');
    throw new Error(
      'Saved name/description/type, but Explore fields need supabase/explore_fields.sql run first — the Explore toggle/tags/priority above were not saved.'
    );
  }
  if (error) throw error;
  if (!data?.length) throw await blockedWriteError('save this waypoint');
  // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9).
  track('admin_action', { action: 'update', entity: 'waypoint' });
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
  const { data, error } = await supabase.from('waypoints').delete().eq('id', id).select('id');
  if (error) throw error;
  if (!data?.length) throw await blockedWriteError('delete this waypoint');
  track('admin_action', { action: 'delete', entity: 'waypoint' });
}

// Legacy: `adminAddPointSave` (app.js ~3418–3459). `source_type:
// 'gps_annotation'` matches legacy's literal value exactly (the type this
// port's `useWaypoints.js` already filters `osm_import` rows out by).
//
// `isPerson` (supabase/people_entries.sql): a Person entry is the same
// insert, minus a location — `lat`/`lng` are left null rather than
// required, since a person has nowhere on the map to pin. Everything
// else (status/source_type/admin write path) is identical to a Place.
export async function insertWaypoint({
  name,
  description,
  type,
  lat,
  lng,
  isPerson,
  isExplore,
  exploreTags,
  explorePriority,
  isPromoted,
  sponsorName,
  promoLabel,
}) {
  const row = {
    id: crypto.randomUUID(),
    name,
    description,
    lat: isPerson ? null : lat,
    lng: isPerson ? null : lng,
    source_type: 'gps_annotation',
    // Explicit, not left to the column default: the map only ever loads
    // `status = 'approved'` rows (useWaypoints.js), so an admin-added
    // point must be approved on insert or it never shows up.
    status: 'approved',
    saved_at: new Date().toISOString(),
  };
  if (!isPerson) row.type = normalizeWaypointType(type);
  if (isPerson) row.is_person = true;
  const explorePatch = {};
  if (isExplore !== undefined) explorePatch.is_explore = !!isExplore;
  if (exploreTags !== undefined) explorePatch.explore_tags = exploreTags;
  if (explorePriority !== undefined) explorePatch.explore_priority = explorePriority;
  if (isPromoted !== undefined) explorePatch.is_promoted = !!isPromoted;
  if (sponsorName !== undefined) explorePatch.sponsor_name = sponsorName || null;
  if (promoLabel !== undefined) explorePatch.promo_label = promoLabel || 'Promoted';
  Object.assign(row, explorePatch);

  const { data, error } = await supabase.from('waypoints').insert(row).select('id').single();

  // supabase/people_entries.sql hasn't been run yet — `is_person` doesn't
  // exist as a column. Don't let that block adding a Person entirely;
  // retry without it (it'll just behave like an ordinary waypoint with no
  // coordinates until the migration runs).
  const missingColumn =
    error &&
    (error.code === 'PGRST204' ||
      error.code === '42703' ||
      /column .* does not exist|could not find the .* column/i.test(error.message || ''));
  if (missingColumn && (isPerson || Object.keys(explorePatch).length > 0)) {
    const withoutIsPerson = { ...row };
    delete withoutIsPerson.is_person;
    for (const field of Object.keys(explorePatch)) delete withoutIsPerson[field];
    const { data: retryData, error: retryError } = await supabase
      .from('waypoints')
      .insert(withoutIsPerson)
      .select('id')
      .single();
    if (retryError) throw retryError;
    track('admin_action', { action: 'insert', entity: 'waypoint' });
    return retryData.id;
  }

  if (error) throw error;
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
  const { data, error } = await supabase
    .from('waypoints')
    .update({ status: 'approved', rejection_reason: null })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw await blockedWriteError('approve this submission');
  track('admin_action', { action: 'approve', entity: 'waypoint_submission' });
}

export async function rejectWaypoint(id, reason) {
  const { data, error } = await supabase
    .from('waypoints')
    .update({ status: 'rejected', rejection_reason: reason })
    .eq('id', id)
    .select('id');
  if (error) throw error;
  if (!data?.length) throw await blockedWriteError('reject this submission');
  track('admin_action', { action: 'reject', entity: 'waypoint_submission' });
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
  track('admin_action', { action: 'update', entity: 'segment' });
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
  track('admin_action', { action: 'insert', entity: 'segment' });

  if (points.length > 0) {
    const rows = points.map((p, seq) => ({ segment_id: segmentId, seq, lat: p.lat, lng: p.lng }));
    const { error: ptErr } = await supabase.from('segment_points').insert(rows);
    if (ptErr) throw ptErr;
  }
  return segmentId;
}