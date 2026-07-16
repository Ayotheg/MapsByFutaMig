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
 * - The KML->OSM dedup block (`_findDuplicate`, app.js ~238-263) — there's
 *   no OSM annotation layer yet to dedupe against (Slice 6). Nothing to
 *   collide with right now, so this is legitimately a no-op rather than a
 *   gap — flagging for whoever builds Slice 6 to wire the dedup check in
 *   once an OSM layer exists here too.
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
export default function StaticKmlLayer({ map, onSelect }) {
  const markersRef = useRef([]);
  const loadedRef = useRef(false);

  useEffect(() => {
    if (!map || loadedRef.current) return;
    loadedRef.current = true;

    let cancelled = false;
    const posCount = {};

    async function loadOne(path, color) {
      try {
        const res = await fetch(path);
        const text = await res.text();
        const xml = new DOMParser().parseFromString(text, 'text/xml');
        const geo = toGeoJSONKml(xml);
        const kmlLabel = extractKmlLabel(geo);

        if (cancelled) return;

        L.geoJSON(geo, {
          filter: (f) => f.geometry?.type === 'Point',
          pointToLayer(f, ll) {
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

            marker.on('click', (e) => {
              L.DomEvent.stopPropagation(e);
              onSelect?.({
                name: displayName,
                badge: '📍 Annotation',
                description: cleanDesc,
                lat,
                lng,
                imageUrls: [],
                type: 'landmark',
              });
            });

            marker.addTo(map);
            markersRef.current.push(marker);
            return marker;
          },
        });
      } catch (e) {
        console.warn('KML load failed:', path, e.message);
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
    };
  }, [map, onSelect]);

  return null;
}
