import { useEffect, useRef } from 'react';
import L from 'leaflet';
import '../waypoints/waypointMarkers.css';
import { buildWaypointMarker } from '../waypoints/waypointMarkers';

/**
 * Renders every non-duplicate OSM item (already deduped by
 * `useOSMAnnotations`) as a marker, identical in appearance to a regular
 * waypoint marker (`buildWaypointMarker(lat, lng, name, 'poi')`).
 *
 * Ported from legacy `_renderOSMItems`'s render tail (app.js ~3093–3107).
 *
 * Faithfully NOT viewport-gated, unlike WaypointLayer: legacy's own
 * `_renderOSMItems` adds every deduped item to the map unconditionally (just
 * batched via requestAnimationFrame, 10 at a time, to avoid a single-frame
 * layout spike) — it does not check `map.getBounds()` first the way
 * `loadSavedWaypoints`'s initial paint does. That's a real inconsistency in
 * legacy (waypoints are pan-lazy, OSM annotations aren't); ported as-is per
 * CLAUDE.md's "match what's there" rule rather than silently "fixed" here.
 */
export default function OSMAnnotationLayer({ map, items, onSelect }) {
  const markersRef = useRef([]);

  useEffect(() => {
    if (!map || items.length === 0) return;

    const markers = items.map((item) => {
      const marker = buildWaypointMarker(item.lat, item.lng, item.name, 'poi');
      marker._placeCardOpts = {
        name: item.name,
        badge: item.badge,
        description: item.desc,
        lat: item.lat,
        lng: item.lng,
        imageUrls: [],
        type: 'poi',
      };
      marker.on('click', (e) => {
        L.DomEvent.stopPropagation(e);
        onSelect(marker._placeCardOpts);
      });
      return marker;
    });
    markersRef.current = markers;

    let cancelled = false;
    const BATCH = 10;
    let i = 0;
    function addBatch() {
      if (cancelled) return;
      const end = Math.min(i + BATCH, markers.length);
      while (i < end) {
        markers[i].addTo(map);
        i++;
      }
      if (i < markers.length) requestAnimationFrame(addBatch);
    }
    requestAnimationFrame(addBatch);

    return () => {
      cancelled = true;
      for (const m of markers) {
        if (map.hasLayer(m)) map.removeLayer(m);
      }
      markersRef.current = [];
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, items, onSelect]);

  return null;
}
