import { useCallback, useEffect, useMemo, useRef } from 'react';
import { TYPE_ICON_KEYS } from '../../lib/typeIcons';
import { highlight } from './highlight';
import { compactText, parseSearchCoord, prepareEntry, searchEntries } from './searchEngine';

const TYPE_ICONS = {
  waypoint: 'geo-alt-fill',
  segment: 'route',
  osm: 'globe',
  osm_annotation: 'globe',
  kml: 'folder',
  coord: 'geo-alt-fill',
};

function icon(entry) {
  if (!entry) return 'geo-alt-fill';
  if (entry.type === 'coord' || entry.source === 'coord') return 'geo-alt-fill';
  const sub = entry.subtype || '';
  const subLow = String(sub).toLowerCase().replace(/\s+/g, '_');
  return (
    TYPE_ICON_KEYS[sub] ||
    TYPE_ICON_KEYS[subLow] ||
    TYPE_ICON_KEYS[entry.type] ||
    TYPE_ICONS[sub] ||
    TYPE_ICONS[entry.type] ||
    TYPE_ICONS[entry.source] ||
    'geo-alt-fill'
  );
}

/**
 * In-memory search index fed by waypoints, businesses, segments, KML, live
 * Overpass POIs (`osmItems`), and ephemeral Nominatim results.
 */
export function useSearchIndex({ waypoints, segments, kmlAnnotations, osmItems = [] }) {
  const indexRef = useRef([]);
  const idSetRef = useRef(new Set());
  const nameCoordSetRef = useRef(new Set());

  const register = useCallback((entry) => {
    const idKey = entry.id || '';
    const normName = compactText(entry.name);
    const ncKey = normName + '|' + (Number(entry.lat) || 0).toFixed(5) + '|' + (Number(entry.lng) || 0).toFixed(5);

    if (idKey && idSetRef.current.has(idKey)) return;
    if (nameCoordSetRef.current.has(ncKey)) return;
    if (
      normName &&
      !entry.lat &&
      !entry.lng &&
      indexRef.current.some((e) => compactText(e.name) === normName)
    ) {
      return;
    }

    if (idKey) idSetRef.current.add(idKey);
    nameCoordSetRef.current.add(ncKey);
    indexRef.current.push(prepareEntry(entry));
  }, []);

  // ── Resync the static (waypoint/business/segment/kml/osm_annotation) portion on data change ──
  useEffect(() => {
    indexRef.current = indexRef.current.filter(
      (e) =>
        e.source !== 'waypoint' &&
        e.source !== 'business' &&
        e.source !== 'segment' &&
        e.source !== 'kml' &&
        e.source !== 'osm_annotation'
    );
    idSetRef.current.clear();
    nameCoordSetRef.current.clear();
    indexRef.current.forEach((e) => {
      if (e.id) idSetRef.current.add(e.id);
      const normName = compactText(e.name);
      nameCoordSetRef.current.add(normName + '|' + (Number(e.lat) || 0).toFixed(5) + '|' + (Number(e.lng) || 0).toFixed(5));
    });

    (waypoints || []).forEach((wp) => {
      if (wp.isPerson || wp.isChannel) return;
      if (wp.isBusiness && wp.promoPaidAt) return;
      register({
        id: wp.id,
        lat: wp.lat,
        lng: wp.lng,
        name: wp.name,
        desc: wp.description || '',
        area: wp.area || '',
        type: wp.type,
        subtype: wp.isBusiness ? 'shop' : wp.type,
        exploreTags: wp.exploreTags || [],
        sourceType: wp.sourceType || '',
        imageUrls: wp.imageUrls || [],
        avgRating: wp.avgRating,
        reviewCount: wp.reviewCount,
        source: wp.isBusiness ? 'business' : 'waypoint',
        isBusiness: !!wp.isBusiness,
        businessLink: wp.businessLink || '',
        businessPlatform: wp.businessPlatform || '',
      });
    });

    (segments || []).forEach((seg) => {
      if (!seg.points || seg.points.length === 0) return;
      const mid = seg.points[Math.floor(seg.points.length / 2)];
      register({
        id: seg.id,
        lat: mid.lat,
        lng: mid.lng,
        name: seg.name,
        desc: seg.description || seg.category || '',
        area: '',
        type: 'segment',
        subtype: 'segment',
        source: 'segment',
      });
    });

    (kmlAnnotations || []).forEach((a) => {
      register({
        id: a.id,
        lat: a.lat,
        lng: a.lng,
        name: a.name,
        desc: '',
        area: '',
        type: 'waypoint',
        subtype: 'kml',
        source: 'kml',
      });
    });

    (osmItems || []).forEach((item) => {
      register({
        id: item.id,
        lat: item.lat,
        lng: item.lng,
        name: item.name,
        desc: item.desc || '',
        area: '',
        type: 'poi',
        subtype: item.badge || 'osm',
        source: 'osm_annotation',
      });
    });
  }, [waypoints, segments, kmlAnnotations, osmItems, register]);

  const query = useCallback((q, limit = 8, options = {}) => {
    if (!q || !q.trim()) return [];
    return searchEntries(indexRef.current, q, { limit, user: options?.user || null });
  }, []);

  const resolve = useCallback(
    (input, options = {}) => {
      if (!input) return null;
      const coord = parseSearchCoord(input);
      if (coord) return coord;
      const results = query(input, 1, options);
      return results.length ? results[0] : null;
    },
    [query]
  );

  return useMemo(
    () => ({ register, query, resolve, highlight, icon, indexRef }),
    [register, query, resolve]
  );
}
