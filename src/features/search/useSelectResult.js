import { useCallback, useRef } from 'react';
import L from 'leaflet';
import { track } from '../../lib/analytics';
import './searchResultMarker.css';

// Raw Leaflet marker HTML can't hold a React icon — inline SVG matching
// Lucide's own Search glyph, same approach as NavigationController's
// SVG_FLAG for the same reason.
const SVG_SEARCH = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;

/**
 * Ports legacy's `selectResult()` (app.js ~729–777) — shared by the
 * (dead, unported) sidebar search, the desktop floating bar's
 * `deskSelect` (which just calls `selectResult` directly, app.js ~988),
 * and the mobile full-screen overlay's item click (~5872). Same here:
 * DesktopSearchBar.jsx and MobileSearchOverlay.jsx both call this one hook.
 *
 * Not ported: the two DOM writes at the end of legacy's `selectResult`
 * that sync the (dead, invisible) sidebar `#searchInput`/`#searchClear`
 * elements — those don't exist in this app. Each caller syncs its own
 * visible input instead.
 */
export function useSelectResult({ map, searchIndex, onSelect }) {
  const markerRef = useRef(null);

  const selectResult = useCallback(
    (entry) => {
      if (!map || !entry.lat || !entry.lng) return;
      const ll = [parseFloat(entry.lat), parseFloat(entry.lng)];

      // Slice 14 instrumentation (ANALYTICS_BUILD_PLAN.md §9) — this one
      // hook is the shared call site for every result-click surface
      // (desktop bar, mobile overlay), so this covers all of them.
      track('search_result_selected', { query: entry.query || null, place_name: entry.name });

      if (markerRef.current) map.removeLayer(markerRef.current);
      markerRef.current = L.marker(ll, {
        icon: L.divIcon({
          className: '',
          // On-brand "dot + label" pill (searchResultMarker.css), same
          // visual language as the waypoint pins' `.gm-pin-*` — replaces
          // the old inline flat-blue/black-text/DM-Mono box (bug fix,
          // reported directly: it didn't match the redesign's theme).
          html: `<div class="search-hit-wrap">
                   <span class="search-hit-dot">${SVG_SEARCH}</span>
                   <span class="search-hit-label">${entry.name}</span>
                 </div>`,
          iconAnchor: [11, 11],
        }),
      }).addTo(map);

      const cardOpts = {
        name: entry.name,
        badge: (entry.subtype || entry.type || 'result').toUpperCase(),
        description: entry.desc || '',
        lat: parseFloat(entry.lat),
        lng: parseFloat(entry.lng),
        imageUrls: entry.imageUrls || [],
        id: entry.id,
        type: entry.subtype || entry.type,
        avgRating: entry.avgRating,
        reviewCount: entry.reviewCount,
      };
      const marker = markerRef.current;
      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        onSelect?.(cardOpts);
      });
      // Auto-open after the fly-to animation settles, matching legacy's
      // 400ms setTimeout.
      setTimeout(() => onSelect?.(cardOpts), 400);

      map.flyTo(ll, 18, { duration: 1.2 });

      searchIndex.register({
        lat: parseFloat(entry.lat),
        lng: parseFloat(entry.lng),
        name: entry.name,
        desc: entry.desc || '',
        type: entry.type || 'poi',
        subtype: entry.subtype || 'poi',
        source: entry.source || 'osm',
      });
    },
    [map, searchIndex, onSelect]
  );

  const clearMarker = useCallback(() => {
    if (markerRef.current && map) {
      map.removeLayer(markerRef.current);
      markerRef.current = null;
    }
  }, [map]);

  return { selectResult, clearMarker };
}