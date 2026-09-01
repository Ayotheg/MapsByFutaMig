import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TYPE_ICON_KEYS } from '../../lib/typeIcons';
import { haversine } from '../../lib/geoUtils';
import { 
  scoreEnhanced,
  scoreText,
  parseSearchQuery, 
  filterByType, 
  filterByDistance, 
  filterByRating,
  getSynonyms,
} from './searchEnhancements';

/**
 * React port of legacy's `window.FUTA_SEARCH` (app.js ~547–648).
 *
 * Legacy builds this as a plain mutable object with a closed-over `index`
 * array, populated imperatively over the session by `register()` calls
 * from `loadSavedWaypoints`, `loadSavedSegments`/`drawSavedSegment`,
 * `loadKML`, and — for OSM results — `selectResult()`/`bindRouteInput`'s
 * OSM debounce. None of that data layer existed until this slice: Slice 4
 * explicitly deferred `drawSavedSegment`'s `FUTA_SEARCH.register(...)`
 * call, and Slice 5/6 both flagged the same for KML/waypoints, all
 * pointing at "Slice 7 (search)". This hook is where that gets picked up.
 *
 * Deviation, flagged: legacy never *removes* stale entries from three of
 * its four registration sources — once a waypoint/segment/KML point is
 * registered it stays in `FUTA_SEARCH.index` for the rest of the page
 * session, even if deleted server-side, with exactly one documented
 * exception (app.js ~1826–1832, a waypoints-only refresh inside the admin
 * flow that isn't built yet — Slice 11). Since this port re-fetches
 * waypoints/segments via `refetch()` after every save (Slice 4/5's save
 * flows), keeping stale entries around would leave deleted/renamed places
 * searchable forever within a session. This hook instead re-syncs the
 * "static" (waypoint/segment/kml) portion of the index on every
 * `waypoints`/`segments`/`kmlAnnotations` change, generalizing legacy's
 * one documented refresh case to all three static sources rather than
 * guessing which one specifically was meant. OSM entries registered via
 * `register()` (ephemeral, matches legacy exactly) are left untouched by
 * this resync — same as legacy, they persist for the session once found.
 *
 * `register`/`query`/`resolve`/`highlight`/`icon` all match legacy's
 * FUTA_SEARCH methods 1:1 (same dedup keys, same scoring weights).
 */

const TYPE_ICONS = { waypoint: 'geo-alt-fill', segment: 'route', osm: 'globe', kml: 'folder' };

function icon(entry) {
  return TYPE_ICON_KEYS[entry.subtype] || TYPE_ICONS[entry.subtype] || TYPE_ICONS[entry.type] || 'geo-alt-fill';
}

function highlight(text, q) {
  if (!q) return text;
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  return text.replace(re, '<mark>$1</mark>');
}

export function useSearchIndex({ waypoints, segments, kmlAnnotations, userLocation = null }) {
  // Mutable, not React state — legacy's FUTA_SEARCH.index is queried
  // synchronously from event handlers (keystrokes, clicks), never drives
  // a render on its own. Matches the imperative-Leaflet-ref pattern this
  // project already uses elsewhere (see CLAUDE.md's "raw Leaflet" rule).
  const indexRef = useRef([]);
  const idSetRef = useRef(new Set());
  const nameCoordSetRef = useRef(new Set());
  const userLocationRef = useRef(userLocation);

  const register = useCallback((entry) => {
    const idKey = entry.id || '';
    const normName = (entry.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
    const ncKey = normName + '|' + (entry.lat || 0).toFixed(5) + '|' + (entry.lng || 0).toFixed(5);

    if (idKey && idSetRef.current.has(idKey)) return;
    if (nameCoordSetRef.current.has(ncKey)) return;
    if (
      normName &&
      !entry.lat &&
      !entry.lng &&
      indexRef.current.some((e) => (e.name || '').toLowerCase().replace(/[^a-z0-9]/g, '') === normName)
    )
      return;

    if (idKey) idSetRef.current.add(idKey);
    nameCoordSetRef.current.add(ncKey);
    indexRef.current.push(entry);
  }, []);

  // ── Resync the static (waypoint/segment/kml) portion on data change ──
  useEffect(() => {
    userLocationRef.current = userLocation;
  }, [userLocation]);

  useEffect(() => {
    indexRef.current = indexRef.current.filter(
      (e) => e.source !== 'waypoint' && e.source !== 'segment' && e.source !== 'kml'
    );
    idSetRef.current.clear();
    nameCoordSetRef.current.clear();
    indexRef.current.forEach((e) => {
      if (e.id) idSetRef.current.add(e.id);
      const normName = (e.name || '').toLowerCase().replace(/[^a-z0-9]/g, '');
      nameCoordSetRef.current.add(normName + '|' + (e.lat || 0).toFixed(5) + '|' + (e.lng || 0).toFixed(5));
    });

    // waypoint entries — mirrors app.js ~3446's register() shape
    (waypoints || []).forEach((wp) => {
      register({
        id: wp.id,
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
        desc: wp.description || '',
        type: wp.type,
        subtype: wp.type,
        imageUrls: wp.imageUrls || [],
        avgRating: wp.avgRating,
        reviewCount: wp.reviewCount,
        source: 'waypoint',
      });
    });

    // segment entries — mirrors drawSavedSegment's register() (app.js
    // ~2579–2588): midpoint of the route's points, name/desc/category.
    (segments || []).forEach((seg) => {
      if (!seg.points || seg.points.length === 0) return;
      const mid = seg.points[Math.floor(seg.points.length / 2)];
      register({
        id: seg.id,
        lat: mid.lat,
        lng: mid.lng,
        name: seg.name,
        desc: seg.description || seg.category || '',
        type: 'segment',
        subtype: 'segment',
        source: 'segment',
      });
    });

    // KML annotation entries — mirrors app.js ~3537.
    (kmlAnnotations || []).forEach((a) => {
      register({
        id: a.id,
        lat: a.lat,
        lng: a.lng,
        name: a.name,
        desc: '',
        type: 'waypoint',
        subtype: 'kml',
        source: 'kml',
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [waypoints, segments, kmlAnnotations]);

  const query = useCallback((q, limit = 6) => {
    if (!q || q.trim().length < 1) return [];
    
    // Parse query for natural language intent (no special syntax needed)
    const parsed = parseSearchQuery(q);
    const queryText = parsed.query || q;
    
    // Score all entries with improved scoring (includes fuzzy, partial matching, synonyms, distance + rating)
    let results = indexRef.current
      .map((e) => ({ 
        ...e, 
        _score: scoreEnhanced(e, queryText, userLocationRef.current, {
          includeDistance: true,
          includeRating: true,
        })
      }))
      .filter((e) => e._score > 0);
    
    // ── Apply implicit type filtering (improved) ────────────────────────
    // If a type was detected (explicit @cafe or implicit "show me cafes"),
    // filter results. But ALSO include synonyms!
    if (parsed.typeFilter) {
      // Get all synonyms for this type
      const syns = getSynonyms(parsed.typeFilter);
      results = results.filter(e => {
        const subtype = (e.subtype || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const type = (e.type || '').toLowerCase().replace(/[^a-z0-9]/g, '');
        const combined = `${subtype}${type}`.toLowerCase();
        
        // Check if entry type matches ANY synonym
        return syns.some(syn => {
          const synNorm = syn.toLowerCase().replace(/[^a-z0-9]/g, '');
          return combined.includes(synNorm) || subtype.includes(synNorm) || type.includes(synNorm);
        });
      });
    }
    
    // Apply rating filter if specified
    if (parsed.ratingFilter) {
      results = filterByRating(results, parsed.ratingFilter);
    }
    
    // Apply distance filter if specified or if "near me" intent detected
    if (parsed.distanceFilter) {
      results = filterByDistance(results, parsed.distanceFilter, userLocationRef.current?.lat, userLocationRef.current?.lng);
    } else if (parsed.nearMe && userLocationRef.current?.lat && userLocationRef.current?.lng) {
      // Default "near me" radius: 2km
      results = filterByDistance(results, 2000, userLocationRef.current.lat, userLocationRef.current.lng);
    }
    
    // ── SORTING by user intent ────────────────────────────────────────
    // If user asked for "best" or "top rated", sort by rating
    // If user asked for "closest" or "near me", sort by distance (already filtered)
    if (parsed.sortBy === 'rating') {
      results.sort((a, b) => (b.avgRating || 0) - (a.avgRating || 0));
    } else if (parsed.sortBy === 'distance' && userLocationRef.current?.lat && userLocationRef.current?.lng) {
      results.sort((a, b) => {
        const distA = haversine(userLocationRef.current.lat, userLocationRef.current.lng, a.lat, a.lng);
        const distB = haversine(userLocationRef.current.lat, userLocationRef.current.lng, b.lat, b.lng);
        return distA - distB;
      });
    } else {
      // Default: sort by enhanced score
      results.sort((a, b) => b._score - a._score);
    }
    
    return results.slice(0, limit);
  }, []);

  const resolve = useCallback(
    (input) => {
      if (!input) return null;
      const coordMatch = input.match(/(-?\d+\.?\d*)[,\s]+(-?\d+\.?\d*)/);
      if (coordMatch) {
        return { lat: parseFloat(coordMatch[1]), lng: parseFloat(coordMatch[2]), name: input, type: 'coord' };
      }
      const results = query(input, 1);
      return results.length ? results[0] : null;
    },
    [query]
  );

  return useMemo(
    () => ({ register, query, resolve, highlight, icon, indexRef }),
    [register, query, resolve]
  );
}
