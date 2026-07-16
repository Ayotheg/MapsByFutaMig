import { useCallback, useEffect, useState } from 'react';
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
 * ── SCHEMA — CORRECTED as of Slice 5, see verification note below ──────
 * Slice 4 flagged this as an unverified guess ("mirroring waypoints/
 * waypoint_images") because CLAUDE.md's schema-doc link still said "TBD".
 * That's true of CLAUDE.md, but a real schema design doc —
 * `FIREBASE_TO_SUPABASE_MIGRATION.md` — already exists in the repo (landed
 * in the Slice 2 commit, just never linked from CLAUDE.md/MIGRATION_PLAN's
 * "Supabase schema/RLS" row). Its `Step 0` SQL is the actual target schema
 * a human would run in the Supabase SQL Editor, so it's a materially better
 * source of truth than a guess, even though it's still unconfirmed against
 * a *live* database (no DB credentials available to this session — see
 * repo-root notes for how to confirm live). Cross-checking against it found
 * two real mismatches in Slice 4's assumption, both fixed here:
 *
 *   1. There is no `points` jsonb column on `segments`. The GPS track is
 *      its own table, `segment_points (segment_id, seq, lat, lng,
 *      accuracy, speed, recorded_at)`, ordered by `seq`. Slice 4's `select`
 *      would have thrown ("column segments.points does not exist") the
 *      moment it ran against a real database built from that SQL.
 *   2. The distance/duration columns are named `distance_m` (metres) and
 *      `duration_ms` (milliseconds), not `distance`/`duration`. Same units
 *      Slice 4 already assumed (matching legacy's own `totalDistance`
 *      metres / `Date.now() - recStartTime` ms), just different column
 *      names. Shaped output below still exposes `distance`/`duration` to
 *      keep SegmentsLayer.jsx/DetailModal.jsx unchanged — only the
 *      Supabase-facing column names changed.
 *
 * `segment_images (segment_id, storage_path, position)` — Slice 4's
 * assumption already matched this doc exactly, no change needed there.
 *
 * A segment's *waypoints* (shown in the detail modal) are still NOT read
 * from an embedded array — `waypoints.segment_id` is a real FK per this
 * same doc, so `waypoints WHERE segment_id = seg.id` (Slice 4's deviation)
 * stands, now confirmed rather than assumed.
 *
 * ── Still unconfirmed, flagging for whoever does the live-data pass ──────
 * RLS is enabled on all five tables per the migration doc's Step 0, but
 * CLAUDE.md's Session Context only confirms SELECT policies were actually
 * added (in the Supabase dashboard) for `waypoints`/`waypoint_images`.
 * `segments`/`segment_points`/`segment_images` aren't mentioned as having
 * policies added — if they don't have one yet, these queries won't throw,
 * they'll just silently return empty arrays (RLS-with-no-policy blocks
 * rows rather than erroring), which reads as "no segments saved yet"
 * rather than "misconfigured". Worth a direct check before trusting an
 * empty segments list. Slice 5's save-flow INSERT has the same exposure in
 * the other direction — see segmentSave.js.
 */
export function useSegments() {
  const [segments, setSegments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);

    const [
      { data: segRows, error: segErr },
      { data: imgRows, error: imgErr },
      { data: wpRows, error: wpErr },
      { data: ptRows, error: ptErr },
    ] = await Promise.all([
      supabase
        .from('segments')
        .select('id, name, description, category, distance_m, duration_ms'),
      supabase
        .from('segment_images')
        .select('segment_id, storage_path, position')
        .order('position', { ascending: true }),
      supabase
        .from('waypoints')
        .select('id, name, description, lat, lng, segment_id')
        .not('segment_id', 'is', null),
      supabase
        .from('segment_points')
        .select('segment_id, seq, lat, lng')
        .order('seq', { ascending: true }),
    ]);

    if (segErr || imgErr || wpErr || ptErr) {
      setError(segErr || imgErr || wpErr || ptErr);
      setLoading(false);
      return;
    }

    const pointsBySegment = {};
    for (const row of ptRows || []) {
      (pointsBySegment[row.segment_id] ??= []).push({
        lat: Number(row.lat),
        lng: Number(row.lng),
      });
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
      // Sourced from segment_points now, not a jsonb column — see the
      // schema note above.
      points: pointsBySegment[seg.id] || [],
      distance: Number(seg.distance_m) || 0,
      duration: Number(seg.duration_ms) || 0,
      imageUrls: imagesBySegment[seg.id] || [],
      waypoints: waypointsBySegment[seg.id] || [],
    }));

    setSegments(shaped);
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

  // Slice 5: exposed so the save flow can refresh the list after inserting
  // a new segment — the equivalent of legacy's `reloadAllWaypoints()` +
  // `drawSavedSegment(newSeg)` pair, just re-fetching instead of hand-
  // splicing the new row into local state.
  return { segments, loading, error, refetch: load };
}