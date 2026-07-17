import { useCallback, useRef } from 'react';
import L from 'leaflet';

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

      if (markerRef.current) map.removeLayer(markerRef.current);
      markerRef.current = L.marker(ll, {
        icon: L.divIcon({
          className: '',
          html: `<div style="background:#60a5fa;color:#000;font-family:'DM Mono',monospace;font-size:10px;
                             font-weight:bold;padding:5px 10px;border-radius:8px;white-space:nowrap;
                             box-shadow:0 3px 12px rgba(0,0,0,.5);border:2px solid rgba(255,255,255,.2)">
                   🔍 ${entry.name}
                 </div>`,
          iconAnchor: [0, 0],
        }),
      }).addTo(map);

      const cardOpts = {
        name: entry.name,
        badge: (entry.subtype || entry.type || 'result').toUpperCase(),
        description: entry.desc || '',
        lat: parseFloat(entry.lat),
        lng: parseFloat(entry.lng),
        imageUrls: [],
        id: entry.id,
        type: entry.subtype || entry.type,
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
