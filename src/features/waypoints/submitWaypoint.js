import { supabase } from '../../lib/supabase';
import { uploadImage, insertImageRows } from '../admin/adminSave';
import { haversine } from '../../lib/geoUtils';
import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import { track } from '../../lib/analytics';

// ── Student waypoint submissions (Slice 13) ──────────────────────────────
//
// Deliberately NOT added to `../admin/adminSave.js` — this is a
// student-facing path with different permissions (RLS's
// `student_insert_pending` policy, not `admin_update`) and different
// validation (campus bounds, rate limit, image count cap), not an admin
// action.  Reuses `uploadImage`/`insertImageRows` from adminSave.js rather
// than duplicating them.
//
// Reuses the real, already-surveyed `CAMPUS_BOUNDS` from `lib/campusBounds.js`
// (added Slice 5, used by the KML import pipeline's off-campus point
// filter) rather than inventing a second campus-bounds constant here.

const MAX_PENDING_PER_DAY = 5;
const MAX_IMAGES_PER_SUBMISSION = 5;
const DUPLICATE_RADIUS_METERS = 20;

export function isWithinCampusBounds(lat, lng) {
  return CAMPUS_BOUNDS.contains([lat, lng]);
}

/**
 * Nudges the submitter toward an existing approved waypoint instead of
 * creating a near-duplicate — a suggestion, not a hard block (campus has
 * legitimately close-together distinct places). Only checks against
 * already-approved waypoints (the same `waypoints` list `useWaypoints()`
 * already filters to `status='approved'`) — a student has no visibility
 * into other students' still-pending submissions to duplicate-check
 * against anyway, matching the RLS read policy.
 */
export async function findNearbyApprovedWaypoint(lat, lng, waypoints) {
  return (
    waypoints.find(
      (w) =>
        w.sourceType !== 'osm_import' &&
        haversine(lat, lng, w.lat, w.lng) <= DUPLICATE_RADIUS_METERS
    ) ?? null
  );
}

/** Whether `userId` still has submission attempts left today. Counts every
 * attempt logged in `waypoint_submission_log` regardless of
 * approve/reject outcome — a user who gets 5 submissions rejected in a
 * row shouldn't get 5 fresh attempts, see waypoint_submissions.sql's
 * schema note. */
export async function checkRateLimit(userId) {
  const since = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();
  const { count, error } = await supabase
    .from('waypoint_submission_log')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId)
    .gte('created_at', since);
  if (error) throw error;
  return (count ?? 0) < MAX_PENDING_PER_DAY;
}

/**
 * Inserts a new `pending` waypoint on behalf of a signed-in student, plus
 * its photos. RLS's `student_insert_pending` policy is the real
 * enforcement that this can only ever land as `status: 'pending'` and
 * `submitted_by: userId` — the checks below are client-side UX (fail
 * fast with a friendly message) on top of that, not a substitute for it.
 */
export async function submitWaypoint({ userId, name, description, type, lat, lng, files }) {
  if (!isWithinCampusBounds(lat, lng)) {
    throw new Error('That location is outside the FUTA campus area.');
  }
  if (files.length > MAX_IMAGES_PER_SUBMISSION) {
    throw new Error(`Please attach at most ${MAX_IMAGES_PER_SUBMISSION} photos.`);
  }
  const allowed = await checkRateLimit(userId);
  if (!allowed) {
    throw new Error(
      `You've reached today's limit of ${MAX_PENDING_PER_DAY} submissions. Try again tomorrow.`
    );
  }

  const { data, error } = await supabase
    .from('waypoints')
    .insert({
      name,
      description,
      type,
      lat,
      lng,
      // A new source_type value, alongside the existing 'gps_annotation'
      // (admin-added) and 'osm_import' (bulk-imported) — useWaypoints.js's
      // `source_type === 'osm_import'` skip doesn't need to change,
      // 'user_submission' rows render exactly like 'gps_annotation' ones
      // once approved.
      source_type: 'user_submission',
      status: 'pending',
      submitted_by: userId,
      saved_at: new Date().toISOString(),
    })
    .select('id')
    .single();
  if (error) throw error;
  const waypointId = data.id;

  const paths = [];
  for (let i = 0; i < files.length; i++) {
    paths.push(await uploadImage('waypoint', waypointId, files[i], i));
  }
  if (paths.length) {
    await insertImageRows('waypoint_images', 'waypoint_id', waypointId, paths);
  }

  await supabase.from('waypoint_submission_log').insert({ user_id: userId });

  // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9) — no free text
  // in props, avoids storing raw user-submitted content in the events
  // table twice (the waypoint row itself already has it).
  track('waypoint_suggested', {});

  return waypointId;
}

/**
 * A signed-in student's own submissions, any status. RLS's
 * `public_read_approved` policy's `or submitted_by = auth.uid()` clause
 * already scopes this correctly server-side — the `.eq('submitted_by',
 * ...)` below is just query efficiency (avoids also pulling every OTHER
 * approved waypoint back down over the wire only to discard them).
 */
export async function fetchMySubmissions(userId) {
  const { data, error } = await supabase
    .from('waypoints')
    .select('id, name, description, type, lat, lng, status, rejection_reason, saved_at')
    .eq('submitted_by', userId)
    .order('saved_at', { ascending: false });
  if (error) throw error;
  return data || [];
}

/** Lets a submitter withdraw their own still-pending submission before
 * it's reviewed. RLS's `student_delete_own_pending` policy is what
 * actually blocks this for approved/rejected rows — this function simply
 * fails (RLS-denied) if called on one of those; the caller's UI should
 * only ever show this action for pending rows. */
export async function withdrawSubmission(id) {
  const { error } = await supabase.from('waypoints').delete().eq('id', id);
  if (error) throw error;
}