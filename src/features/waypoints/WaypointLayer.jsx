import { useEffect, useRef } from 'react';
import L from 'leaflet';
import './waypointMarkers.css';
import { buildWaypointMarker } from './waypointMarkers';
import { useWaypoints } from './useWaypoints';
import { WP_TYPE_LABELS } from './wpTypeMeta';

/**
 * Renders every non-OSM waypoint as a marker on `map` and opens the place
 * card on click. Mirrors legacy `loadSavedWaypoints` + the lazy
 * `_setupViewportListener`/`_renderViewportMarkers` pair (app.js ~2592–2780,
 * ~3227–3243): only viewport-visible markers get added to the map up front;
 * the rest are lazily added the first time a pan/zoom brings them into view.
 * Markers are never removed once added, same as legacy.
 *
 * TODO Slice 6: legacy gates this whole thing behind `_infoMode` (an
 * information/raw view-mode toggle that doesn't exist yet in this port).
 * Until that toggle lands, waypoints always render.
 *
 * No props needed beyond `map` + `onSelect` — this is a plain feature
 * component, not a route, per CLAUDE.md's folder-structure rule.
 */
export default function WaypointLayer({ map, onSelect }) {
  const { waypoints } = useWaypoints();
  const markersRef = useRef([]); // [{ marker, wp }]

  // Build markers once per waypoints load and attach them to the map.
  useEffect(() => {
    if (!map || waypoints.length === 0) return;

    const entries = waypoints.map((wp) => {
      const marker = buildWaypointMarker(wp.lat, wp.lng, wp.name, wp.type);
      marker._rendered = false;
      marker.on('click', (e) => {
        // Leaflet bubbles marker clicks up to the map's own 'click' event
        // unless explicitly stopped here — matches legacy's
        // `_attachPlaceCardClick` exactly. Without this, MapPage's
        // map-click-closes-card listener would immediately close the card
        // that this same click just opened.
        L.DomEvent.stopPropagation(e);
        onSelect({
          name: wp.name,
          badge: WP_TYPE_LABELS[wp.type] || '📍 Waypoint',
          description: wp.description,
          lat: wp.lat,
          lng: wp.lng,
          imageUrls: wp.imageUrls,
          id: wp.id,
          type: wp.type,
        });
      });
      return { marker, wp };
    });
    markersRef.current = entries;

    // ── Initial paint: only what's in view (+ 20% padding), same as legacy.
    const bounds = map.getBounds().pad(0.2);
    let addedCount = 0;
    for (const { marker } of entries) {
      if (bounds.contains(marker.getLatLng())) {
        marker._rendered = true;
        marker.addTo(map);
        addedCount++;
      }
    }

    // ── Lazily add newly-visible markers as the user pans/zooms.
    function renderViewportMarkers() {
      const b = map.getBounds().pad(0.3); // legacy uses a wider pad here than the initial paint
      const toAdd = [];
      for (const { marker } of markersRef.current) {
        if (marker._rendered) continue;
        if (b.contains(marker.getLatLng())) {
          marker._rendered = true;
          toAdd.push(marker);
        }
      }
      toAdd.forEach((m) => m.addTo(map));
    }
    map.on('moveend zoomend', renderViewportMarkers);

    return () => {
      map.off('moveend zoomend', renderViewportMarkers);
      for (const { marker } of entries) {
        if (map.hasLayer(marker)) map.removeLayer(marker);
      }
      markersRef.current = [];
    };
  }, [map, waypoints, onSelect]);

  return null; // this feature only manipulates the Leaflet map imperatively
}
