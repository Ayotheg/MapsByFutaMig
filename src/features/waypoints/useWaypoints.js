import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase, getPlaceImageUrl } from '../../lib/supabase';

import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import L from 'leaflet';
import { isTimeoutError } from '../../lib/networkTimeout';
import { fetchAllRows } from '../../lib/fetchAllRows';
import { cacheGet, cacheSet } from '../../lib/localCache';

const CACHE_KEY = 'waypoints';
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
  // Set when we're showing a previous localStorage snapshot instead of a
  // fresh server response — either because the network call timed out/
  // failed, or because the browser told us up front we're offline. UI
  // (MapPage's OfflineBanner) uses this + cachedAt to tell the user what
  // they're looking at and let them retry.
  const [isOffline, setIsOffline] = useState(false);
  const [cachedAt, setCachedAt] = useState(null);

  // Bumped on every load() so a slow background phase-2 from an older load
  // can't overwrite the results of a newer one (e.g. admin edit → refetch).
  const loadIdRef = useRef(0);
  // Last full set of off-campus rows, kept so a refetch doesn't make them
  // vanish from the map/search while phase 2 re-downloads them.
  const bulkRef = useRef([]);

  const load = useCallback(async () => {
    const loadId = ++loadIdRef.current;
    setLoading(true);
    setError(null);

    // Cheap, synchronous check — if the browser already knows there's no
    // connection, don't waste 8s discovering that the slow way. Straight
    // to cache (or empty) so the loading screen isn't stuck waiting on a
    // request that has no chance of succeeding.
    if (typeof navigator !== 'undefined' && navigator.onLine === false) {
      const cached = cacheGet(CACHE_KEY);
      if (cached) {
        setWaypoints(cached.value);
        setIsOffline(true);
        setCachedAt(cached.savedAt);
      } else {
        setWaypoints([]);
        setError(new Error('offline'));
      }
      setLoading(false);
      return;
    }

    const EXPLORE_COLS =
      'is_explore, explore_tags, explore_priority, is_promoted, sponsor_name, promo_label';
    const BASE_COLS = 'id, name, description, type, lat, lng, source_type, segment_id, avg_rating, review_count';

    // ── Two-phase load ────────────────────────────────────────────────────
    // DATA SCALE — read before optimizing anything here: as of Sept 2026
    // the DB holds only ~600+ waypoints in total (owner-confirmed). An
    // earlier version of this comment claimed ~6,000 rows / ~90% osm_import
    // — that was WRONG/outdated; do not size caches, payloads or "large
    // dataset" optimizations off it. Run a `count` on the table if you
    // need the current number.
    //
    // The two-phase split below is defensive, kept for if/when the bulk
    // `osm_import` rows (scripts/osm-annotations, Lagos/Ogun state-wide
    // extraction, hundreds of km from campus) are loaded. It is harmless
    // at the current size.
    //   Phase 1 (blocks the loading screen): everything else — the real
    //     campus content (admin-annotated, GPS, student-submitted) + photos.
    //   Phase 2 (background, never blocks): the bulk osm_import rows,
    //     appended when they arrive. Search/legend counts update then.
    // Both phases are paged (lib/fetchAllRows.js) because PostgREST silently
    // caps one response at 1000 rows.
    const CORE_FILTER = 'source_type.is.null,source_type.neq.osm_import'; // `neq` alone would drop NULLs
    const coreQuery = (cols) => () =>
      supabase
        .from('waypoints')
        .select(cols)
        .eq('status', 'approved')
        .or(CORE_FILTER)
        .order('id', { ascending: true });
    const bulkQuery = (cols) => () =>
      supabase
        .from('waypoints')
        .select(cols)
        .eq('status', 'approved')
        .eq('source_type', 'osm_import')
        .order('id', { ascending: true });

    let cols = `${BASE_COLS}, ${EXPLORE_COLS}`;
    let [wpRes, imgRes] = await Promise.all([
      fetchAllRows(coreQuery(cols)),
      fetchAllRows(() =>
        supabase
          .from('waypoint_images')
          .select('waypoint_id, storage_path, position')
          .order('waypoint_id', { ascending: true })
          .order('position', { ascending: true })
          .order('id', { ascending: true })
      ),
    ]);
    if (wpRes.error && !isTimeoutError(wpRes.error)) {
      // Explore fields (supabase/explore_fields.sql) not migrated yet —
      // don't let that break waypoint loading for the whole map. Retry
      // without them; useExplorePicks.js already treats a waypoint
      // with none of these fields as simply "not featured".
      cols = BASE_COLS;
      wpRes = await fetchAllRows(coreQuery(cols));
      if (!wpRes.error) {
        console.info(
          '[waypoints] Explore fields not found — run supabase/explore_fields.sql to enable featuring places in Explore.'
        );
      }
    }
    const { data: wpRows, error: wpErr } = wpRes;
    const { data: imgRows, error: imgErr } = imgRes;

    if (loadId !== loadIdRef.current) return; // a newer load() superseded this one

    if (wpErr || imgErr) {
      // Network genuinely failed or timed out (as opposed to a real
      // server-side error like an RLS/permissions problem — those still
      // come back as wpErr/imgErr here too, so falling back to a stale
      // cache is the right move either way: better a slightly old map
      // than none at all).
      const timedOut = isTimeoutError(wpErr) || isTimeoutError(imgErr);
      const cached = cacheGet(CACHE_KEY);
      if (cached) {
        setWaypoints(cached.value);
        setIsOffline(true);
        setCachedAt(cached.savedAt);
        setError(null);
        console.warn(
          `[waypoints] Live load failed${timedOut ? ' (timed out)' : ''}, showing cached data from ${new Date(cached.savedAt).toLocaleString()}.`
        );
      } else {
        setError(wpErr || imgErr);
      }
      setLoading(false);
      return;
    }

    setIsOffline(false);

    // Group images by waypoint_id, resolving storage paths to public URLs.
    const imagesByWaypoint = {};
    for (const row of imgRows || []) {
      const url = getPlaceImageUrl(row.storage_path);
      if (!url) continue;
      (imagesByWaypoint[row.waypoint_id] ??= []).push(url);
    }

    // Shared across both phases so co-located pins fan out consistently.
    const posCount = {};
    function shape(rows) {
      const out = [];
      for (const wp of rows || []) {
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

        out.push({
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
      return out;
    }

    const core = shape(wpRows);
    // Keep whatever bulk rows we already had (from an earlier load) visible
    // while phase 2 re-downloads them, so a refetch never blanks them out.
    // Re-shaping them would double-count `posCount`, so they're appended as-is.
    setWaypoints([...core, ...bulkRef.current]);
    setCachedAt(null);
    setLoading(false); // ← loading screen ends here; phase 2 continues silently

    // ── Phase 2: bulk off-campus rows, in the background ─────────────────
    const bulkRes = await fetchAllRows(bulkQuery(cols));
    if (loadId !== loadIdRef.current) return; // superseded while downloading
    if (bulkRes.error) {
      // Not fatal: campus data is already on screen. Leave any earlier bulk
      // rows in place and don't overwrite the cache with a partial list.
      console.warn('[waypoints] Background load of off-campus places failed:', bulkRes.error?.message || bulkRes.error);
      return;
    }
    const bulk = shape(bulkRes.data);
    bulkRef.current = bulk;
    const full = [...core, ...bulk];
    setWaypoints(full);
    cacheSet(CACHE_KEY, full); // last-known-good, for next time the network's bad
  }, []);

  useEffect(() => {
    let cancelled = false;
    load().catch((e) => {
      if (!cancelled) {
        setError(e);
        setLoading(false);
      }
    });

    // Auto-recover: if we booted (or fell back) while offline/on a bad
    // connection, don't leave the user staring at a stale cache forever —
    // the instant the browser reports connectivity again, quietly refetch
    // live data in the background. `load()` swaps in the fresh result
    // itself (and flips isOffline back to false) once it lands, so this
    // needs no extra state here.
    const handleOnline = () => {
      if (!cancelled) load();
    };
    window.addEventListener('online', handleOnline);

    return () => {
      cancelled = true;
      window.removeEventListener('online', handleOnline);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Slice 5: exposed so the save flow can refresh waypoints after inserting
  // new ones tied to a just-saved segment (legacy's `reloadAllWaypoints()`).
  return { waypoints, loading, error, isOffline, cachedAt, refetch: load };
}