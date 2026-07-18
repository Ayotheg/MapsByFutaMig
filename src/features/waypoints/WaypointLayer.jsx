import { useEffect, useRef } from 'react';
import L from 'leaflet';
import './waypointMarkers.css';
import { buildWaypointMarker } from './waypointMarkers';
import { WP_TYPE_LABELS } from './wpTypeMeta';

/**
 * Renders every non-OSM waypoint as a marker on `map` and opens the place
 * card on click. Mirrors legacy `loadSavedWaypoints` + the lazy
 * `_setupViewportListener`/`_renderViewportMarkers` pair (app.js ~2592–2780,
 * ~3227–3243): only viewport-visible markers get added to the map up front;
 * the rest are lazily added the first time a pan/zoom brings them into view.
 * Markers are never removed once added, same as legacy — EXCEPT now that
 * Slice 3's place-type filter exists, a rendered marker can still be
 * removed/re-added by `isTypeVisible`, same as legacy's own `_applyVisibility`
 * (app.js ~6183–6190) toggling `map.hasLayer`/`addTo`/`removeLayer` on
 * `window._waypointLayers` independently of the viewport-lazy-load pass.
 *
 * Slice 6: legacy gates this whole thing behind `_infoMode`. Resolved via
 * the CSS-only raw-mode kill switch in waypointMarkers.css instead of a
 * `viewMode` prop here — see useViewMode.js's header comment for why.
 *
 * Slice 6: `snaps`/`badgeMerges` come from `useOSMAnnotations` (an OSM POI
 * within `DEDUP_RADIUS_M` of, and name-matching, one of these waypoints).
 * Applied via the same mutable `marker._placeCardOpts` pattern legacy's own
 * `_renderOSMItems` uses to enrich an *existing* marker's cached place-card
 * data in place (app.js ~3050–3062) — necessary here because `snaps`/
 * `badgeMerges` can arrive *after* this effect already built the markers
 * (the OSM fetch and this waypoint load race independently), so a second
 * effect below mutates already-built markers rather than waiting to build
 * markers only once every input is ready.
 *
 * `waypoints` is now a prop instead of this component calling
 * `useWaypoints()` itself — Slice 3's legend needs the same list (for
 * per-type/per-group counts), and fetching it twice would double the
 * Supabase read. MapPage now owns the single `useWaypoints()` call.
 *
 * `isTypeVisible(type)` comes from Slice 3's `useTypeVisibility` hook
 * (features/legend), also lifted to MapPage so the legend panel and this
 * layer share one visibility state instead of drifting out of sync.
 */
export default function WaypointLayer({ map, waypoints, isTypeVisible, onSelect, snaps, badgeMerges }) {
  const markersRef = useRef([]); // [{ marker, wp }]

  // Build markers once per waypoints load and attach them to the map.
  useEffect(() => {
    if (!map || waypoints.length === 0) return;

    const entries = waypoints.map((wp) => {
      const marker = buildWaypointMarker(wp.lat, wp.lng, wp.name, wp.type);
      marker._rendered = false;
      marker._placeCardOpts = {
        name: wp.name,
        badge: WP_TYPE_LABELS[wp.type] || '📍 Waypoint',
        description: wp.description,
        lat: wp.lat,
        lng: wp.lng,
        imageUrls: wp.imageUrls,
        id: wp.id,
        type: wp.type,
        // Slice 8: rating badge data — see PlaceCard.jsx's RatingBadge.
        avgRating: wp.avgRating,
        reviewCount: wp.reviewCount,
      };
      marker.on('click', (e) => {
        // Leaflet bubbles marker clicks up to the map's own 'click' event
        // unless explicitly stopped here — matches legacy's
        // `_attachPlaceCardClick` exactly. Without this, MapPage's
        // map-click-closes-card listener would immediately close the card
        // that this same click just opened.
        L.DomEvent.stopPropagation(e);
        onSelect(marker._placeCardOpts);
      });
      return { marker, wp };
    });
    markersRef.current = entries;

    // ── Initial paint: only what's in view (+ 20% padding) AND type-visible,
    // same as legacy.
    const bounds = map.getBounds().pad(0.2);
    for (const { marker, wp } of entries) {
      if (bounds.contains(marker.getLatLng())) {
        marker._rendered = true;
        if (isTypeVisible(wp.type)) marker.addTo(map);
      }
    }

    // ── Lazily add newly-visible markers as the user pans/zooms.
    function renderViewportMarkers() {
      const b = map.getBounds().pad(0.3); // legacy uses a wider pad here than the initial paint
      const toAdd = [];
      for (const { marker, wp } of markersRef.current) {
        if (marker._rendered) continue;
        if (b.contains(marker.getLatLng())) {
          marker._rendered = true;
          if (isTypeVisible(wp.type)) toAdd.push(marker);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [map, waypoints, onSelect]);

  // ── Re-apply the place-type filter to already-rendered markers whenever
  // it changes, without touching markers that haven't entered the
  // viewport yet (those pick up the current filter state the first time
  // renderViewportMarkers reaches them, above).
  useEffect(() => {
    if (!map) return;
    for (const { marker, wp } of markersRef.current) {
      if (!marker._rendered) continue;
      const visible = isTypeVisible(wp.type);
      if (visible && !map.hasLayer(marker)) marker.addTo(map);
      else if (!visible && map.hasLayer(marker)) map.removeLayer(marker);
    }
  }, [map, isTypeVisible, waypoints]);

  // ── Slice 6: apply OSM dedup snap/badge merges to already-built markers,
  // whenever they change — see the header comment above for why this is a
  // separate effect instead of folding into the build effect.
  useEffect(() => {
    for (const { marker, wp } of markersRef.current) {
      const key = `waypoint:${wp.id}`;
      const snap = snaps && snaps[key];
      if (snap) {
        marker.setLatLng([snap.lat, snap.lng]);
        marker._placeCardOpts.lat = snap.lat;
        marker._placeCardOpts.lng = snap.lng;
      }
      const merge = badgeMerges && badgeMerges[key];
      if (merge && !marker._osmMerged) {
        marker._osmMerged = true;
        marker._placeCardOpts.osmBadge = merge.osmBadge;
        if (!marker._placeCardOpts.description && merge.desc) {
          marker._placeCardOpts.description = merge.desc;
        }
      }
    }
  }, [snaps, badgeMerges, waypoints]);

  return null; // this feature only manipulates the Leaflet map imperatively
}
