import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { kml as toGeoJSONKml } from '@tmcw/togeojson';
import '../waypoints/waypointMarkers.css';
import { buildWaypointMarker } from '../waypoints/waypointMarkers';
import {
  isUnknownAnnotationName,
  cleanKmlDescription,
  sanitiseAnnotationName,
  extractKmlLabel,
} from './kmlAnnotationUtils';

// Same 12 files + colors as legacy's `loadKmlsStaggered` file list
// (app.js ~347–360). Static assets copied from the legacy repo's `kml/`
// folder into `public/kml/` as part of this slice.
const KML_FILES = [
  ['/kml/test1.kml', '#00c896'],
  ['/kml/test2.kml', '#ff6b6b'],
  ['/kml/test3.kml', '#ffc107'],
  ['/kml/test4.kml', '#ff8b07'],
  ['/kml/test5.kml', '#0741ff'],
  ['/kml/test6.kml', '#fffb07'],
  ['/kml/test7.kml', '#07ff3d'],
  ['/kml/test8.kml', '#b007ff'],
  ['/kml/test9.kml', '#07c5ff'],
  ['/kml/test10.kml', '#ff07c9'],
  ['/kml/test11.kml', '#ff0713'],
  ['/kml/test12.kml', '#ff3907'],
];

const KML_NUDGE = 0.000018; // same magnitude as legacy KML_NUDGE

// `fetch(path)` with no timeout can hang indefinitely on a slow/dropped
// connection instead of ever rejecting — which is exactly what a
// "some KML files just don't show up, with nothing in the console"
// report looks like: `loadOne`'s catch block never fires because the
// promise never settles, so that file's markers simply never render and
// nothing gets logged either. Not a legacy behavior worth preserving —
// legacy had the same latent bug, just less visible since it also had a
// visible #mapLoader progress bar that would show mid-load forever.
// `withTimeout` + one retry below fixes both: a stuck request now fails
// fast instead of hanging, and a single transient blip (the kind seen
// in this app's testing — see the Supabase/Overpass network hiccups
// discussed in chat) gets a second chance before we give up on that file.
const KML_FETCH_TIMEOUT_MS = 8000;

function fetchWithTimeout(path, ms) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  return fetch(path, { signal: controller.signal }).finally(() => clearTimeout(timer));
}

/**
 * StaticKmlLayer — always-on (first-paint, NOT lazy) loading of the 12
 * bundled campus KML annotation files. MIGRATION_PLAN.md's Slice 5 bullet
 * explicitly separates this from the admin-only KML *upload* sub-panel
 * (ImportTrigger.jsx): this one is "static/first-paint tier ... NOT lazy".
 *
 * Ported from legacy `loadKML` + `bindKmlPopup` (app.js ~146–322) and the
 * `loadKmlsStaggered` IIFE (app.js ~324–380), minus:
 *
 * - `registerKmlAdmin`/`_kmlRegistry` — populated an admin-panel cache
 *   (Slice 11, not built).
 * - `FUTA_SEARCH.register(...)` — Slice 7's search index doesn't exist yet.
 * - The KML->OSM dedup block (`_findDuplicate`, app.js ~238-263) — WIRED IN
 *   as of Slice 6. `onAnnotationsChange` reports this layer's loaded points
 *   up to MapPage (id/lat/lng/name) so `useOSMAnnotations` can include them
 *   in its dedup index; `dedupSnaps`/`dedupBadges` (props, keyed
 *   `kml:<id>`) come back down and get applied to already-built markers via
 *   the `_placeCardOpts` mutation pattern, same as WaypointLayer.jsx. See
 *   that file's header comment for why this is a separate effect instead of
 *   applied at marker-build time (KML loads in staggered batches; the OSM
 *   fetch/dedup race is independent of it).
 * - The `_infoMode` gate and canvas `_wpCanvasRenderer` — same deviations
 *   WaypointLayer.jsx already made in Slice 2 (markers always render;
 *   plain L.circleMarker, no canvas renderer). Kept consistent rather than
 *   reintroducing an optimization Slice 2 explicitly opted out of.
 * - `window._kmlLayers`/`window._waypointLayers` globals — markers are
 *   tracked in a local ref instead, same pattern as WaypointLayer.jsx.
 * - The `#mapLoader` progress-bar DOM manipulation (`_loaderSet`/
 *   `_loaderDone`) — that UI doesn't exist in this port (`LoadingScreen.jsx`
 *   is still an unbuilt stub, and no Slice bullet covers it). The
 *   mobile/desktop staggered-batch *loading behavior* itself (1 file at a
 *   time on mobile, 3 in parallel on desktop, with a delay between
 *   batches) is preserved below since it's a real perf fix, not just UI —
 *   losing it would reintroduce the main-thread jank it was written to
 *   avoid. If a loading-progress UI is wanted, that's a separate,
 *   unscoped piece of work.
 *
 * click -> `onSelect(placeCardData)` instead of `window.openPlaceCard(...)`,
 * same prop-callback pattern WaypointLayer.jsx already uses.
 */
export default function StaticKmlLayer({ map, onSelect, onAnnotationsChange, dedupSnaps, dedupBadges }) {
  const markersRef = useRef([]);
  const namedMarkersById = useRef(new Map()); // Slice 6: id -> marker, for the snap/badge effect below
  const annotationsRef = useRef([]); // Slice 6: accumulated {id, lat, lng, name} for named points only
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!map || loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;
    const posCount = {};
    const localIdxByPath = {}; // Slice 6: per-file running index, mirrors legacy's `_kmlRegistry[path].length - 1`
    const namedMap = namedMarkersById.current; // captured once — same Map instance for this effect's lifetime

    async function loadOne(path, color, attempt = 1) {
      try {
        const res = await fetchWithTimeout(path, KML_FETCH_TIMEOUT_MS);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const text = await res.text();
        const xml = new DOMParser().parseFromString(text, 'text/xml');
        const geo = toGeoJSONKml(xml);
        const kmlLabel = extractKmlLabel(geo);

        if (cancelled) return;

        let pointCount = 0;
        L.geoJSON(geo, {
          filter: (f) => f.geometry?.type === 'Point',
          pointToLayer(f, ll) {
            pointCount += 1;
            const rawName = f.properties?.name || '';
            const rawDesc = f.properties?.description || '';
            const cleanDesc = cleanKmlDescription(rawDesc);
            const hasCustomDesc =
              cleanDesc && cleanDesc.length > 0 && cleanDesc.length < 80 && !cleanDesc.includes('http');
            const isNamed = !isUnknownAnnotationName(rawName) || hasCustomDesc;

            const posKey = `${ll.lat.toFixed(5)},${ll.lng.toFixed(5)}`;
            posCount[posKey] = (posCount[posKey] || 0) + 1;
            const n = posCount[posKey] - 1;
            const angle = (n * 137.5 * Math.PI) / 180;
            const lat = ll.lat + (n > 0 ? KML_NUDGE * Math.cos(angle) : 0);
            const lng =
              ll.lng + (n > 0 ? (KML_NUDGE * Math.sin(angle)) / Math.cos((ll.lat * Math.PI) / 180) : 0);

            const displayName = sanitiseAnnotationName(rawName, lat, lng, kmlLabel, rawDesc);

            let marker;
            if (isNamed) {
              marker = buildWaypointMarker(lat, lng, displayName, 'landmark');
            } else {
              marker = L.circleMarker([lat, lng], {
                radius: 5,
                fillColor: color,
                color: '#fff',
                weight: 2,
                fillOpacity: 1,
              });
            }

            marker._placeCardOpts = {
              name: displayName,
              badge: 'Annotation',
              description: cleanDesc,
              lat,
              lng,
              imageUrls: [],
              type: 'landmark',
            };
            marker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              onSelect?.(marker._placeCardOpts);
            });

            marker.addTo(map);
            markersRef.current.push(marker);

            // Slice 6: register named points for the OSM dedup index — mirrors
            // legacy's `!_isUnknownAnnotationName(displayName)` gate before
            // `FUTA_SEARCH.register` (app.js ~237). Unnamed dots are skipped:
            // an empty normalised name would otherwise match anything within
            // DEDUP_RADIUS_M, since ''.includes(x)/x.includes('') are both
            // vacuously true in findDuplicate's substring check.
            if (!isUnknownAnnotationName(displayName)) {
              const localIdx = (localIdxByPath[path] = (localIdxByPath[path] ?? -1) + 1);
              const id = `kml-${path}-${localIdx}`;
              namedMap.set(id, marker);
              annotationsRef.current = [...annotationsRef.current, { id, lat, lng, name: displayName }];
              onAnnotationsChange?.(annotationsRef.current);
            }

            return marker;
          },
        });

        if (!cancelled) {
          console.info(`KML loaded: ${path} (${pointCount} point${pointCount === 1 ? '' : 's'})`);
        }
      } catch (e) {
        if (cancelled) return;
        const reason = e.name === 'AbortError' ? `timed out after ${KML_FETCH_TIMEOUT_MS}ms` : e.message;
        if (attempt < 2) {
          console.warn(`KML load failed, retrying: ${path} (${reason})`);
          await new Promise((r) => setTimeout(r, 500));
          if (!cancelled) await loadOne(path, color, attempt + 1);
          return;
        }
        console.warn(`KML load failed after retry, giving up: ${path} (${reason})`);
      }
    }

    const isMobile = window.innerWidth <= 768;
    const batchSize = isMobile ? 1 : 3;
    const delay = isMobile ? 600 : 350;

    (async () => {
      for (let i = 0; i < KML_FILES.length; i += batchSize) {
        if (cancelled) return;
        const batch = KML_FILES.slice(i, i + batchSize);
        await Promise.all(batch.map(([p, c]) => loadOne(p, c)));
        if (i + batchSize < KML_FILES.length) {
          await new Promise((r) => setTimeout(r, delay));
        }
      }
    })();

    return () => {
      cancelled = true;
      markersRef.current.forEach((m) => {
        if (map.hasLayer(m)) map.removeLayer(m);
      });
      markersRef.current = [];
      namedMap.clear();
      annotationsRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map]);

  // ── Slice 6: apply OSM dedup snap/badge merges to already-built named
  // markers, whenever they change. Same pattern/rationale as
  // WaypointLayer.jsx's equivalent effect — see its header comment.
  useEffect(() => {
    for (const [id, marker] of namedMarkersById.current) {
      const key = `kml:${id}`;
      const snap = dedupSnaps && dedupSnaps[key];
      if (snap) {
        marker.setLatLng([snap.lat, snap.lng]);
        marker._placeCardOpts.lat = snap.lat;
        marker._placeCardOpts.lng = snap.lng;
      }
      const merge = dedupBadges && dedupBadges[key];
      if (merge && !marker._osmMerged) {
        marker._osmMerged = true;
        marker._placeCardOpts.osmBadge = merge.osmBadge;
        if (!marker._placeCardOpts.description && merge.desc) {
          marker._placeCardOpts.description = merge.desc;
        }
      }
    }
  }, [dedupSnaps, dedupBadges]);

  return null;
}
