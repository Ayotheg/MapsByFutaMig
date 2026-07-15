import { useEffect, useState } from 'react';
import { supabase, getPlaceImageUrl } from '../../lib/supabase';

/**
 * Loads saved segments (+ their photos, + their linked waypoints) from
 * Supabase, shaped for SegmentsLayer/DetailModal. Mirrors legacy
 * `loadSavedSegments` (app.js ~2771–2795), minus:
 *   - the sessionStorage read-cache (Part B #1 in legacy) — same call as
 *     useWaypoints.js: Supabase's free-tier limits don't create the read
 *     pressure that cache was built to solve.
 *   - segColorIdx's module-level running counter for polyline colour —
 *     that's a rendering concern, handled in SegmentsLayer.jsx instead.
 *
 * ── SCHEMA ASSUMPTION — flagging per CLAUDE.md, not yet in a schema doc ──
 * No `segments`/`segment_images` schema is linked from CLAUDE.md yet ("link
 * to be added once Phase 1 backend work ships"). Following the same
 * normalization CLAUDE.md's Session Context already confirms for
 * `waypoints`/`waypoint_images` (Slice 2), this assumes:
 *
 *   segments (id, name, description, category, points jsonb, distance
 *             numeric, duration numeric, recorded_at timestamptz)
 *   segment_images (segment_id, storage_path, position)
 *
 * `points` (the GPS track — [{lat,lng,timestamp,speed,accuracy}, ...]) has
 * no natural relational home of its own, so it stays jsonb on `segments`,
 * same as legacy's embedded array.
 *
 * A segment's *waypoints* (shown in the detail modal) are NOT read from an
 * embedded array here — legacy's Firestore embedded `seg.waypoints`, but
 * our `waypoints` table already has a `segment_id` column (confirmed live
 * in Slice 2/CLAUDE.md), so this queries `waypoints WHERE segment_id = seg.id`
 * instead of duplicating that data. Deliberate deviation from legacy's
 * embedded-array shape — flag if the real schema embeds it differently.
 *
 * If these tables don't exist yet under these exact names/columns, this
 * hook's queries will fail — that's a Supabase-dashboard setup step, not a
 * code bug (same bootstrapping gap Slice 2 flagged for `waypoints`/
 * `waypoint_images`).
 */
export function useSegments() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      setLoading(true);
      setError(null);

      const [
        { data: segRows, error: segErr },
        { data: imgRows, error: imgErr },
        { data: wpRows, error: wpErr },
      ] = await Promise.all([
        supabase
          .from('segments')
          .select('id, name, description, category, points, distance, duration'),
        supabase
          .from('segment_images')
          .select('segment_id, storage_path, position')
          .order('position', { ascending: true }),
        supabase
          .from('waypoints')
          .select('id, name, description, lat, lng, segment_id')
          .not('segment_id', 'is', null),
      ]);

      if (cancelled) return;

      if (segErr || imgErr || wpErr) {
        setError(segErr || imgErr || wpErr);
        setLoading(false);
        return;
      }

      const imagesBySegment = {};
      for (const row of imgRows || []) {
        const url = getPlaceImageUrl(row.storage_path);
        if (!url) continue;
        (imagesBySegment[row.segment_id] ??= []).push(url);
      }

      const waypointsBySegment = {};
      for (const wp of wpRows || []) {
        (waypointsBySegment[wp.segment_id] ??= []).push({
          id: wp.id,
          name: wp.name,
          // numeric columns come back as strings over PostgREST — coerce
          // before doing math or handing to Leaflet (same rule useWaypoints
          // follows).
          lat: Number(wp.lat),
          lng: Number(wp.lng),
          desc: wp.description || '',
        });
      }

      const shaped = (segRows || []).map((seg) => ({
        id: seg.id,
        name: seg.name,
        description: seg.description || '',
        category: seg.category,
        // `points` is jsonb — comes back already parsed as an array, unlike
        // the numeric columns above.
        points: seg.points || [],
        distance: Number(seg.distance) || 0,
        duration: Number(seg.duration) || 0,
        imageUrls: imagesBySegment[seg.id] || [],
        waypoints: waypointsBySegment[seg.id] || [],
      }));

      setSegments(shaped);
      setLoading(false);
    }

    load().catch((e) => {
      if (!cancelled) {
        setError(e);
        setLoading(false);
      }
    });

    return () => {
      cancelled = true;
    };
  }, []);

  return { segments, loading, error };
}