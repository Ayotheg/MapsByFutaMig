import { useEffect, useMemo, useState } from 'react';
import L from 'leaflet';
import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import { osmBadge, findDuplicate } from './osmAnnotationUtils';

const OSM_CACHE_KEY = 'futa_osm_annotations_v1';
const OSM_CACHE_TTL = 5 * 60 * 1000;

// overpass-api.de is the canonical instance but occasionally answers with a
// non-2xx (e.g. 406/429 under load) response that omits CORS headers
// entirely, which the browser then reports as a same-origin-policy/CORS
// failure rather than the underlying HTTP error — that's what produced the
// "Cross-Origin Request Blocked ... 406" + "NetworkError when attempting to
// fetch resource" pair in the reported bug. Retrying against community
// mirrors that run the same Overpass QL API keeps this feature working
// without standing up our own proxy.
const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

/**
 * Fetches named OSM POIs within campus bounds (via Overpass), caches them in
 * sessionStorage (same 5-min TTL as legacy), and dedups against `dedupIndex`
 * — a live `{ id, lat, lng, name, source }[]` built by the caller from
 * whatever's already loaded (waypoints, KML annotations).
 *
 * Ported from legacy `loadOSMAnnotations` + `_renderOSMItems`'s dedup pass
 * (app.js ~2896–3107). Split into two effects on purpose:
 *   1. The Overpass fetch runs once on mount, exactly like legacy's single
 *      `loadOSMAnnotations()` call.
 *   2. Dedup against `dedupIndex` is a pure `useMemo`, recomputed whenever
 *      the index changes (e.g. once KML annotations finish loading) —
 *      WITHOUT re-fetching. This lets late-arriving KML entries retroactively
 *      catch a duplicate the first pass missed, closing the gap Slice 5 left
 *      as a no-op ("wire it in once Slice 6's OSM layer exists").
 *
 * Returns:
 *  - items: non-duplicate OSM items, ready to render as new markers
 *  - snaps: { "<source>:<id>": {lat,lng} } — existing markers to reposition
 *    to the OSM (building-centroid) coordinate
 *  - badgeMerges: { "<source>:<id>": {osmBadge, desc} } — richer info to
 *    merge into that place's card
 */
export function useOSMAnnotations(dedupIndex) {
  const [rawItems, setRawItems] = useState([]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const raw = sessionStorage.getItem(OSM_CACHE_KEY);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Date.now() - parsed.ts < OSM_CACHE_TTL) {
            if (!cancelled) setRawItems(parsed.items);
            return;
          }
          sessionStorage.removeItem(OSM_CACHE_KEY);
        }
      } catch {
        /* sessionStorage unavailable/corrupt — fall through to a live fetch */
      }

      const S = CAMPUS_BOUNDS.getSouth();
      const W = CAMPUS_BOUNDS.getWest();
      const N = CAMPUS_BOUNDS.getNorth();
      const E = CAMPUS_BOUNDS.getEast();
      const bbox = `${S},${W},${N},${E}`;
      const query =
        '[out:json][timeout:30];\n(\n' +
        `  node["name"]["amenity"](${bbox});\n` +
        `  node["name"]["building"](${bbox});\n` +
        `  node["name"]["office"](${bbox});\n` +
        `  node["name"]["leisure"](${bbox});\n` +
        `  node["name"]["shop"](${bbox});\n` +
        `  node["name"]["tourism"](${bbox});\n` +
        `  way["name"]["building"](${bbox});\n` +
        `  way["name"]["amenity"](${bbox});\n` +
        `  way["name"]["office"](${bbox});\n` +
        `  way["name"]["leisure"](${bbox});\n` +
        ');\nout center;';

      try {
        let data = null;
        let lastErr = null;
        for (const endpoint of OVERPASS_ENDPOINTS) {
          try {
            const res = await fetch(endpoint, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                Accept: 'application/json',
              },
              body: 'data=' + encodeURIComponent(query),
            });
            if (!res.ok) throw new Error(`${endpoint} responded ${res.status}`);
            data = await res.json();
            break; // success — stop trying further mirrors
          } catch (err) {
            lastErr = err;
            // try the next mirror
          }
        }
        if (!data) throw lastErr || new Error('all Overpass endpoints failed');
        const elements = data.elements || [];
        const seen = new Set();
        const items = [];
        for (const el of elements) {
          const name = ((el.tags && el.tags.name) || '').trim();
          if (!name) continue;
          const lat = el.lat != null ? el.lat : el.center && el.center.lat;
          const lng = el.lon != null ? el.lon : el.center && el.center.lon;
          if (lat == null || lng == null) continue;
          if (!CAMPUS_BOUNDS.contains(L.latLng(lat, lng))) continue;
          const key = name + '|' + lat.toFixed(4) + '|' + lng.toFixed(4);
          if (seen.has(key)) continue;
          seen.add(key);
          items.push({ name, lat, lng, tags: el.tags || {} });
        }
        try {
          sessionStorage.setItem(OSM_CACHE_KEY, JSON.stringify({ ts: Date.now(), items }));
        } catch {
          /* storage full/unavailable — cache is a perf nicety, not required */
        }
        if (!cancelled) setRawItems(items);
      } catch (err) {
        console.warn('OSM annotation load failed:', err.message);
      }
    }

    load();
    return () => {
      cancelled = true;
    };
  }, []); // fetch once — matches legacy's single loadOSMAnnotations() call

  return useMemo(() => {
    const items = [];
    const snaps = {};
    const badgeMerges = {};
    let deduped = 0;
    let snapped = 0;

    for (const item of rawItems) {
      const badge = osmBadge(item.tags);
      const desc = item.tags['addr:street'] || item.tags.description || item.tags.operator || '';
      const conflict = findDuplicate(item.lat, item.lng, item.name, dedupIndex);

      if (conflict) {
        deduped++;
        const key = `${conflict.source}:${conflict.id}`;
        if (!snaps[key]) {
          snaps[key] = { lat: item.lat, lng: item.lng };
          snapped++;
        }
        if (!badgeMerges[key]) {
          badgeMerges[key] = { osmBadge: badge, desc: desc || undefined };
        }
        continue; // do NOT render a second marker for this place
      }

      items.push({
        name: item.name,
        lat: item.lat,
        lng: item.lng,
        badge,
        desc,
        id: 'osm-' + item.lat.toFixed(6) + '-' + item.lng.toFixed(6),
      });
    }

    if (deduped > 0) {
      console.log(
        `🔁 OSM dedup: suppressed ${deduped} duplicate(s), snapped ${snapped} marker(s) to OSM coords`
      );
    }

    return { items, snaps, badgeMerges };
  }, [rawItems, dedupIndex]);
}
