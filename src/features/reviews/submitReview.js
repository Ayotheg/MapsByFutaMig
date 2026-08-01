import { supabase } from '../../lib/supabase';
import { track } from '../../lib/analytics';

// ── Submit a review ──────────────────────────────────────────────────────
// Ported from legacy's `reviewSubmitBtn` click handler (app.js ~7000–7062).
//
// Deliberate deviations from legacy:
// - Legacy wrote `placeName`/`placeType` onto every review doc and rolled
//   the new average into the waypoint via a client-side
//   `db.runTransaction(...)` (app.js ~7033–7043). Both are gone here:
//   `place_name`/`place_type` were dropped from the `reviews` table
//   (see FIREBASE_TO_SUPABASE_MIGRATION.md's "Step 6" — same denormalize
//   -vs-join call this doc already made for segments' `segmentName`), and
//   the rolling average is now a Postgres trigger on `reviews` insert
//   instead of a client transaction, which is what CLAUDE.md's schema
//   note flags legacy's approach as race-prone under concurrent reviews.
// - No local `wp.avgRating = newAvg` mutation (legacy app.js ~7047–7048) —
//   there's no client-computed new average to reflect anymore, the trigger
//   computes the real one server-side. The caller (`ReviewModal`) instead
//   calls `onSubmitted`, which `MapPage`/Slice 9 should wire to
//   `useWaypoints()`'s `refetch()` so the place card picks up the trigger's
//   real `avg_rating`/`review_count` on next read, same refetch-after-write
//   pattern Slice 4/5 already established for segments/waypoints.
// `userId` (Slice 10): legacy's `patchReviewWithAuth` (app.js ~7426–7471)
// bumps `users/{uid}.reviewCount` after the fact via a fragile
// poll-for-"Thanks"-text hack, once `window.FUTA_USER` exists. This port
// does it properly at insert time instead — `reviews.user_id` (added in
// FIREBASE_TO_SUPABASE_MIGRATION.md's "Step 7") is nullable, so an
// anonymous review still works exactly as before if `userId` is omitted;
// when it's set, the same `recompute_profile_review_count` trigger that
// Step 7 adds keeps `profiles.review_count` accurate without any
// client-side polling or increment call. Caller (`ReviewModal`) is
// responsible for passing the current `user?.id`.
export async function submitReview({ waypointId, rating, comment, userId }) {
  if (!waypointId || !(rating >= 1 && rating <= 5)) {
    throw new Error('submitReview: waypointId and a 1–5 rating are required.');
  }

  // Same 500-char clamp as legacy: `(commentEl.value || '').trim().slice(0, 500)`.
  const trimmedComment = (comment || '').trim().slice(0, 500);

  const { error } = await supabase.from('reviews').insert({
    waypoint_id: waypointId,
    rating,
    comment: trimmedComment || null,
    user_id: userId || null,
  });

  if (error) throw error;

  // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9) — only fires
  // after a confirmed successful insert, not on failed attempts.
  track('review_submitted', { waypoint_id: waypointId, rating });
}