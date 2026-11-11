import { supabase } from '../../lib/supabase';

// Reviews for one place, newest first, through the `get_place_reviews` RPC
// (supabase/reviews_read.sql) — `reviews` itself isn't readable by the
// public role. Each row: { id, rating, comment, created_at, reviewer_name }
// (reviewer_name is null for guest reviews).
export const REVIEWS_PAGE_SIZE = 5;

export async function fetchPlaceReviews(waypointId, offset = 0) {
  const { data, error } = await supabase.rpc('get_place_reviews', {
    p_waypoint_id: String(waypointId),
    p_limit: REVIEWS_PAGE_SIZE,
    p_offset: offset,
  });
  if (error) throw error;
  return data || [];
}
