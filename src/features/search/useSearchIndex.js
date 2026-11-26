import { useCallback, useMemo, useRef } from 'react';
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

function entryKeys(entry) {
  const idKey = entry.id || '';
  const normName = compactText(entry.name);
  const ncKey = normName + '|' + (Number(entry.lat) || 0).toFixed(5) + '|' + (Number(entry.lng) || 0).toFixed(5);
  return { idKey, normName, ncKey };
}

/**
 * In-memory search index fed by waypoints, businesses, segments, KML, live
 * Overpass POIs (`osmItems`), and ephemeral Nominatim results.
 */
export function useSearchIndex({ waypoints, segments, kmlAnnotations, osmItems = [] }) {
  const osmEntriesRef = useRef([]);
  const indexRef = useRef([]);

  const { staticEntries, staticIds, staticNcKeys, staticNames } = useMemo(() => {
    const list = [];
    const ids = new Set();
    const ncKeys = new Set();
    const names = new Set();

    const pushStatic = (entry) => {
      const { idKey, normName, ncKey } = entryKeys(entry);
      if (idKey && ids.has(idKey)) return;
      if (ncKeys.has(ncKey)) return;
      if (normName && !entry.lat && !entry.lng && names.has(normName)) return;

      if (idKey) ids.add(idKey);
      ncKeys.add(ncKey);
      if (normName) names.add(normName);
      list.push(prepareEntry(entry));
    };

    (waypoints || []).forEach((wp) => {
      if (wp.isPerson || wp.isChannel) return;
      if (wp.isBusiness && wp.promoPaidAt) return;
      pushStatic({
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
      pushStatic({
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
      pushStatic({
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
      pushStatic({
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

    return { staticEntries: list, staticIds: ids, staticNcKeys: ncKeys, staticNames: names };
  }, [waypoints, segments, kmlAnnotations, osmItems]);

  // Keep indexRef synced synchronously so queries see late-arriving static data
  // (osmItems, phase-2 waypoints) on the very same render.
  indexRef.current = useMemo(() => {
    const liveOsm = osmEntriesRef.current.filter((e) => {
      const { idKey, normName, ncKey } = entryKeys(e);
      if (idKey && staticIds.has(idKey)) return false;
      if (staticNcKeys.has(ncKey)) return false;
      if (normName && !e.lat && !e.lng && staticNames.has(normName)) return false;
      return true;
    });
    return [...staticEntries, ...liveOsm];
  }, [staticEntries, staticIds, staticNcKeys, staticNames]);

  const register = useCallback(
    (entry) => {
      const { idKey, normName, ncKey } = entryKeys(entry);
      if (idKey && staticIds.has(idKey)) return;
      if (staticNcKeys.has(ncKey)) return;
      if (normName && !entry.lat && !entry.lng && staticNames.has(normName)) return;

      for (const e of osmEntriesRef.current) {
        const k = entryKeys(e);
        if (idKey && k.idKey === idKey) return;
        if (k.ncKey === ncKey) return;
        if (normName && !entry.lat && !entry.lng && k.normName === normName) return;
      }

      const prepared = prepareEntry(entry);
      osmEntriesRef.current.push(prepared);
      indexRef.current = [...indexRef.current, prepared];
    },
    [staticIds, staticNcKeys, staticNames]
  );

  const query = useCallback(
    (q, limit = 8, options = {}) => {
      if (!q || !q.trim()) return [];
      return searchEntries(indexRef.current, q, { limit, user: options?.user || null });
    },
    // Re-create when staticEntries changes so consumers re-evaluate open lists.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [staticEntries]
  );

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
