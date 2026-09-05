import { useCallback, useEffect, useState } from 'react';
import { supabase, getPlaceImageUrl } from '../../lib/supabase';

import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import L from 'leaflet';
// Same nudge constant/formula as legacy app.js `loadSavedWaypoints` — when
// multiple waypoints share (near-)identical coordinates, fan them out in a
// small spiral so pins don't render exactly on top of each other.
const NUDGE = 0.00004;

/**
 * Loads all waypoints + their images from Supabase, shaped for the map layer
 * and place-card. Mirrors legacy `loadSavedWaypoints`, minus:
 *   - segments/segment_images join (Slice 4 — see WaypointLayer.jsx TODO)
 *   - sessionStorage read-cache (Part B #1 in legacy) — Supabase's free-tier
 *     read limits are far more generous than old Firestore-quota pressure
 *     that caching was built to solve; revisit only if it becomes a problem.
 *   - viewport-batched DOM insertion — handled in WaypointLayer.jsx instead,
 *     since that's a rendering concern, not a data-fetching one.
 */
// Slice 13: student-submitted waypoints stay `status: 'pending'` until an
// admin approves them (RLS enforces this server-side — see
// `supabase/waypoint_submissions.sql`). The map itself should only ever
// render `approved` rows; a signed-in student's own pending/rejected
// submissions are surfaced separately via `MyWaypointSubmissionsPanel.jsx`
// (`src/features/waypoint-submissions/`), not mixed into this list — the
// simpler "approved-only here, own-submissions in their own panel" shape,
// rather than teaching WaypointLayer a new pending-pin visual state.
export function useWaypoints() {
  const [waypoints, setWaypoints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const EXPLORE_COLS =
      'is_explore, explore_tags, explore_priority, is_promoted, sponsor_name, promo_label';
    const BASE_COLS = 'id, name, description, type, lat, lng, source_type, segment_id, avg_rating, review_count';

    let wpRows, wpErr;
    {
      const res = await supabase.from('waypoints').select(`${BASE_COLS}, ${EXPLORE_COLS}`).eq('status', 'approved');
      if (res.error) {
        // Explore fields (supabase/explore_fields.sql) not migrated yet —
        // don't let that break waypoint loading for the whole map. Retry
        // without them; useExplorePicks.js already treats a waypoint
        // with none of these fields as simply "not featured".
        const fallback = await supabase.from('waypoints').select(BASE_COLS).eq('status', 'approved');
        wpRows = fallback.data;
        wpErr = fallback.error;
        if (!fallback.error) {
          console.info(
            '[waypoints] Explore fields not found — run supabase/explore_fields.sql to enable featuring places in Explore.'
          );
        }
      } else {
        wpRows = res.data;
        wpErr = res.error;
      }
    }
    const { data: imgRows, error: imgErr } = await supabase
      .from('waypoint_images')
      .select('waypoint_id, storage_path, position')
      .order('position', { ascending: true });

    if (wpErr || imgErr) {
      setError(wpErr || imgErr);
      setLoading(false);
      return;
    }

    // Group images by waypoint_id, resolving storage paths to public URLs.
    const imagesByWaypoint = {};
    for (const row of imgRows || []) {
      const url = getPlaceImageUrl(row.storage_path);
      if (!url) continue;
      (imagesByWaypoint[row.waypoint_id] ??= []).push(url);
    }

    const posCount = {};

    const shaped = [];
    for (const wp of wpRows || []) {
            // numeric columns come back as strings over PostgREST — coerce
      // before doing any math or handing to Leaflet.
      const rawLat = Number(wp.lat);
      const rawLng = Number(wp.lng);

      // Skip OSM-bulk-imported waypoints that fall inside the FUTA campus
      // box — those still risk duplicating the live campus-only Overpass
      // layer. Outside campus (e.g. Lagos/Ogun data), render normally.
      if (wp.source_type === 'osm_import' && CAMPUS_BOUNDS.contains(L.latLng(rawLat, rawLng))) continue;

      const key = `${rawLat.toFixed(5)},${rawLng.toFixed(5)}`;
      posCount[key] = (posCount[key] || 0) + 1;
      const n = posCount[key] - 1;
      const angle = (n * 137.5 * Math.PI) / 180;
      const lat = rawLat + (n > 0 ? NUDGE * Math.cos(angle) : 0);
      const lng =
        rawLng + (n > 0 ? (NUDGE * Math.sin(angle)) / Math.cos((rawLat * Math.PI) / 180) : 0);

      shaped.push({
        id: wp.id,
        name: wp.name,
        description: wp.description || '',
        type: wp.type,
        lat,
        lng,
        sourceType: wp.source_type,
        segmentId: wp.segment_id,
        imageUrls: imagesByWaypoint[wp.id] || [],
        // Slice 8: `avg_rating` is a nullable `numeric` column — no reviews
        // yet means `null`, not `0`, same as legacy's Firestore doc simply
        // not having an `avgRating` field until the first review lands.
        // PostgREST returns numeric columns as strings — coerce here, same
        // rule as lat/lng above.
        avgRating: wp.avg_rating != null ? Number(wp.avg_rating) : null,
        reviewCount: Number(wp.review_count) || 0,
        // Explore panel fields (supabase/explore_fields.sql) — plain
        // columns on this same row, not a separate table/fetch. Falsy/
        // empty defaults here matter: `useExplorePicks.js` treats
        // `isExplore: false` waypoints as simply not in the rotation,
        // same as if these columns didn't exist yet (pre-migration).
        isExplore: !!wp.is_explore,
        exploreTags: wp.explore_tags || [],
        explorePriority: wp.explore_priority ?? 0,
        isPromoted: !!wp.is_promoted,
        sponsorName: wp.sponsor_name || '',
        promoLabel: wp.promo_label || 'Promoted',
      });
    }

    setWaypoints(shaped);
    setLoading(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((e) => {
      if (!cancelled) {
        setError(e);
        setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slice 5: exposed so the save flow can refresh waypoints after inserting
  // new ones tied to a just-saved segment (legacy's `reloadAllWaypoints()`).
  return { waypoints, loading, error, refetch: load };
}