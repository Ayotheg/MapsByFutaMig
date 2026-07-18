import { supabase } from '../../lib/supabase';

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
export async function submitReview({ waypointId, rating, comment }) {
  if (!waypointId || !(rating >= 1 && rating <= 5)) {
    throw new Error('submitReview: waypointId and a 1–5 rating are required.');
  }

  // Same 500-char clamp as legacy: `(commentEl.value || '').trim().slice(0, 500)`.
  const trimmedComment = (comment || '').trim().slice(0, 500);

  const { error } = await supabase.from('reviews').insert({
    waypoint_id: waypointId,
    rating,
    comment: trimmedComment || null,
  });

  if (error) throw error;
}
