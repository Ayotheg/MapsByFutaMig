import { useCallback, useRef } from 'react';
import L from 'leaflet';
import { track } from '../../lib/analytics';
import './searchResultMarker.css';

const SVG_SEARCH = `<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m21 21-4.34-4.34"/><circle cx="11" cy="11" r="8"/></svg>`;

export function useSelectResult({ map, searchIndex, onSelect }) {
  const markerRef = useRef(null);

  const selectResult = useCallback(
    (entry, query = null) => {
      if (!map || !entry) return;
      const trackedQuery = query || entry.query || null;

      if (entry.source === 'business' || entry.isBusiness) {
        if (markerRef.current) {
          map.removeLayer(markerRef.current);
          markerRef.current = null;
        }
        track('search_result_selected', { query: trackedQuery, place_name: entry.name });
        onSelect?.({
          name: entry.name,
          badge: 'ONLINE STORE',
          description: entry.desc || '',
          area: entry.area || '',
          lat: null,
          lng: null,
          imageUrls: entry.imageUrls || [],
          id: entry.id,
          type: entry.subtype || entry.type,
          avgRating: entry.avgRating,
          reviewCount: entry.reviewCount,
          isBusiness: true,
          businessLink: entry.businessLink || '',
          businessPlatform: entry.businessPlatform || '',
        });
        return;
      }

      const lat = parseFloat(entry.lat);
      const lng = parseFloat(entry.lng);
      if (!Number.isFinite(lat) || !Number.isFinite(lng)) return;
      const ll = [lat, lng];
      const isCoord = entry.source === 'coord' || entry.type === 'coord';

      track('search_result_selected', { query: trackedQuery, place_name: entry.name });

      if (markerRef.current) map.removeLayer(markerRef.current);
      markerRef.current = L.marker(ll, {
        icon: L.divIcon({
          className: '',
          html: `<div class="search-hit-pin-wrap"><span class="search-hit-pin-icon">${SVG_SEARCH}</span></div>`,
          iconSize: [34, 34],
          iconAnchor: [17, 34],
        }),
        zIndexOffset: 1100,
      }).addTo(map);

      const cardOpts = {
        name: entry.name,
        badge: isCoord ? 'COORDINATES' : (entry.subtype || entry.type || 'result').replace(/_/g, ' ').toUpperCase(),
        description: entry.desc || '',
        area: entry.area || '',
        lat,
        lng,
        imageUrls: entry.imageUrls || [],
        id: entry.id,
        type: entry.subtype || entry.type,
        avgRating: entry.avgRating,
        reviewCount: entry.reviewCount,
      };
      const marker = markerRef.current;
      marker.on('click', (ev) => {
        L.DomEvent.stopPropagation(ev);
        onSelect?.(cardOpts, { fromMarker: true });
      });
      setTimeout(() => onSelect?.(cardOpts), 400);

      map.flyTo(ll, 18, { duration: 1.2 });

      if (!isCoord) {
        searchIndex.register({
          lat,
          lng,
          name: entry.name,
          desc: entry.desc || '',
          area: entry.area || '',
          type: entry.type || 'poi',
          subtype: entry.subtype || 'poi',
          source: entry.source || 'osm',
        });
      }
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
