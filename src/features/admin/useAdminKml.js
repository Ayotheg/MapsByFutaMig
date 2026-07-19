import { useCallback, useRef, useState } from 'react';
import L from 'leaflet';
import { kml as toGeoJSONKml } from '@tmcw/togeojson';
import { buildWaypointMarker } from '../waypoints/waypointMarkers';
import {
  isUnknownAnnotationName,
  cleanKmlDescription,
  sanitiseAnnotationName,
  extractKmlLabel,
} from '../kml/kmlAnnotationUtils';
import { haversine } from '../../lib/geoUtils';
import { insertKmlPointAsWaypoint, insertKmlLineAsSegment, uploadImage, insertImageRows } from './adminSave';

/**
 * Admin "KML Upload" tab — ported from legacy's `_loadKMLFromGeoJSON`
 * (app.js ~3519–3561, admin file uploads) + `loadKML` (app.js ~146–322,
 * shared with the always-on static loader, reused here for admin's
 * "load by path" input) + `registerKmlAdmin`/`_kmlRegistry` (app.js
 * ~3802–3807) + the KML edit-modal's rename-swap logic (app.js
 * ~4227–4268) + its "IMPORT TO FIREBASE" button (~4017–4096).
 *
 * **Consolidation, flagged (behavior unchanged):** legacy keeps two
 * near-identical GeoJSON-to-markers builders — `loadKML` (fetch-by-path,
 * shared with the static startup loader) and `_loadKMLFromGeoJSON`
 * (parse-from-uploaded-file-text) — that differ only in how they obtain
 * the GeoJSON, not in what they do with it. Same class of internal
 * duplication Slice 6/9 already found and merged elsewhere (`_findDuplicate`
 * direction, `.mob-fab-cluster`'s triple CSS definition); this hook uses
 * one shared `buildLayerFromGeo` for both entry points.
 *
 * Unlike legacy, clicking a marker here opens the same React place-card
 * (`onSelect`) StaticKmlLayer.jsx already uses, instead of a raw Leaflet
 * `bindKmlPopup` HTML popup — editing happens through this panel's list
 * (`openEditKml` equivalent), never through the map marker, so there's no
 * popup-level edit affordance to reproduce.
 *
 * Session-only, matches legacy exactly: nothing here persists across a
 * reload except via the explicit "Import to Supabase" action per feature.
 */
export function useAdminKml({ map, onSelect, searchRegister }) {
  // { [path]: { color, label, features: [{ name, lat, lng, type, description, imageFiles }] } }
  const [registry, setRegistry] = useState({});
  const markersRef = useRef({}); // `${path}-${idx}` -> Leaflet layer
  const loadedPathsRef = useRef(new Set());

  const setFeature = useCallback((path, idx, patch) => {
    setRegistry((reg) => {
      const file = reg[path];
      if (!file) return reg;
      const features = file.features.slice();
      features[idx] = { ...features[idx], ...patch };
      return { ...reg, [path]: { ...file, features } };
    });
  }, []);

  function placeCardOptsFor(name, lat, lng, description) {
    return {
      name,
      badge: '📍 Annotation',
      description: cleanKmlDescription(description) || description || '',
      lat,
      lng,
      imageUrls: [],
      type: 'landmark',
    };
  }

  const buildLayerFromGeo = useCallback(
    (path, geo, color, kmlLabel) => {
      let idx = -1;
      const geoLayer = L.geoJSON(geo, {
        filter: (f) => f.geometry?.type === 'Point',
        pointToLayer(f, ll) {
          idx += 1;
          const localIdx = idx;
          const rawName = f.properties?.name || '';
          const rawDesc = f.properties?.description || '';
          const cleanDesc = cleanKmlDescription(rawDesc);
          const hasCustomDesc = cleanDesc && cleanDesc.length > 0 && cleanDesc.length < 80 && !cleanDesc.includes('http');
          const isNamed = !isUnknownAnnotationName(rawName) || hasCustomDesc;
          const displayName = sanitiseAnnotationName(rawName, ll.lat, ll.lng, kmlLabel, rawDesc);

          let marker;
          if (isNamed) {
            marker = buildWaypointMarker(ll.lat, ll.lng, displayName, 'landmark');
          } else {
            marker = L.circleMarker([ll.lat, ll.lng], {
              radius: 5,
              fillColor: color,
              color: '#fff',
              weight: 2,
              fillOpacity: 1,
            });
          }
          marker._placeCardOpts = placeCardOptsFor(displayName, ll.lat, ll.lng, rawDesc);
          marker.on('click', (e) => {
            L.DomEvent.stopPropagation(e);
            onSelect?.(marker._placeCardOpts);
          });
          marker.addTo(map);
          markersRef.current[`${path}-${localIdx}`] = marker;

          // Legacy: `FUTA_SEARCH.register(...)` gated on
          // `!_isUnknownAnnotationName(displayName)` (app.js ~3536–3538).
          if (!isUnknownAnnotationName(displayName)) {
            searchRegister?.({
              lat: ll.lat,
              lng: ll.lng,
              name: displayName,
              desc: '',
              type: 'waypoint',
              subtype: 'kml',
              source: 'kml',
              id: `admin-kml-${path}-${localIdx}`,
            });
          }

          setRegistry((reg) => {
            const file = reg[path] || { color, label: kmlLabel, features: [] };
            const features = file.features.slice();
            features[localIdx] = {
              name: displayName,
              lat: ll.lat,
              lng: ll.lng,
              type: 'Point',
              description: cleanDesc,
              imageFiles: [],
            };
            return { ...reg, [path]: { ...file, color, label: kmlLabel, features } };
          });

          return marker;
        },
      });
      return geoLayer;
    },
    [map, onSelect, searchRegister]
  );

  const loadFromText = useCallback(
    async (path, text, color, kmlLabel) => {
      if (loadedPathsRef.current.has(path)) {
        throw new Error('This file is already loaded.');
      }
      const geo = toGeoJSONKml(new DOMParser().parseFromString(text, 'text/xml'));
      const label = kmlLabel || extractKmlLabel(geo) || path.split('/').pop();
      buildLayerFromGeo(path, geo, color, label);
      loadedPathsRef.current.add(path);
    },
    [buildLayerFromGeo]
  );

  // Legacy: `adminKmlFileInput`'s change handler (app.js ~3466–3491).
  const loadFromFile = useCallback(
    async (file, color) => {
      const text = await file.text();
      const fakePath = 'uploaded/' + file.name;
      const kmlLabel = file.name.replace(/\.kml$/i, '');
      await loadFromText(fakePath, text, color, kmlLabel);
      return fakePath;
    },
    [loadFromText]
  );

  // Legacy: `adminKmlLoadBtn`'s click handler (app.js ~3497–3517), calling
  // shared `loadKML(path, color)`.
  const loadFromPath = useCallback(
    async (path, color) => {
      const res = await fetch(path);
      if (!res.ok) throw new Error(`Failed: ${res.status} ${res.statusText}`);
      const text = await res.text();
      await loadFromText(path, text, color, null);
      return path;
    },
    [loadFromText]
  );

  // Legacy: the rename-swap logic inside `adminSaveBtn`'s kml branch
  // (app.js ~4227–4268) — a point can flip between "named" (a proper
  // teardrop marker) and "unnamed" (a small dot) as its name changes;
  // legacy swaps the underlying Leaflet layer type to match. Simplified
  // here to always rebuild the marker on rename rather than reproducing
  // legacy's three-way isNamed/wasNamed branch verbatim — same visual
  // result (teardrop vs dot), fewer code paths to keep in sync.
  const renameFeature = useCallback(
    (path, idx, name, description) => {
      const key = `${path}-${idx}`;
      const marker = markersRef.current[key];
      const file = registry[path];
      const feature = file?.features?.[idx];
      if (!marker || !feature) return;

      const isNamed = !isUnknownAnnotationName(name);
      const latlng = marker.getLatLng ? marker.getLatLng() : { lat: feature.lat, lng: feature.lng };
      const color = file.color;

      if (isNamed) {
        map.removeLayer(marker);
        const newMarker = buildWaypointMarker(latlng.lat, latlng.lng, name, 'landmark');
        newMarker._placeCardOpts = placeCardOptsFor(name, latlng.lat, latlng.lng, description);
        newMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelect?.(newMarker._placeCardOpts);
        });
        newMarker.addTo(map);
        markersRef.current[key] = newMarker;
      } else {
        map.removeLayer(marker);
        const newMarker = L.circleMarker(latlng, { radius: 5, fillColor: color, color: '#fff', weight: 2, fillOpacity: 1 });
        newMarker._placeCardOpts = placeCardOptsFor(name, latlng.lat, latlng.lng, description);
        newMarker.on('click', (e) => {
          L.DomEvent.stopPropagation(e);
          onSelect?.(newMarker._placeCardOpts);
        });
        newMarker.addTo(map);
        markersRef.current[key] = newMarker;
      }

      // Legacy: rename also re-registers into FUTA_SEARCH if newly named
      // (app.js ~4209–4224) — this port's index doesn't need a "find
      // existing entry and patch it" step since `admin-kml-${path}-${idx}`
      // is a stable id; registering again just overwrites in place.
      if (isNamed) {
        searchRegister?.({
          lat: latlng.lat,
          lng: latlng.lng,
          name,
          desc: description || '',
          type: 'waypoint',
          subtype: 'kml',
          source: 'kml',
          id: `admin-kml-${path}-${idx}`,
        });
      }

      setFeature(path, idx, { name, description });
    },
    [map, onSelect, registry, setFeature, searchRegister]
  );

  const addImageFile = useCallback(
    (path, idx, file) => {
      setRegistry((reg) => {
        const f = reg[path];
        if (!f) return reg;
        const features = f.features.slice();
        const feature = features[idx];
        features[idx] = { ...feature, imageFiles: [...(feature.imageFiles || []), file] };
        return { ...reg, [path]: { ...f, features } };
      });
    },
    []
  );

  const removeImageFile = useCallback((path, idx, fileIdx) => {
    setRegistry((reg) => {
      const f = reg[path];
      if (!f) return reg;
      const features = f.features.slice();
      const feature = features[idx];
      const imageFiles = (feature.imageFiles || []).filter((_, i) => i !== fileIdx);
      features[idx] = { ...feature, imageFiles };
      return { ...reg, [path]: { ...f, features } };
    });
  }, []);

  // Legacy: `aeKmlImportBtn`'s click handler (app.js ~4017–4096). Point ->
  // a new waypoint; line -> a new segment + its recorded points (distance
  // via the shared `haversine`, same as legacy's own inline loop there).
  //
  // The line/segment branch below is faithfully ported but, like its
  // legacy counterpart, structurally unreachable through the real UI:
  // both `loadKML` and `_loadKMLFromGeoJSON` (app.js ~195–197/3524)
  // explicitly filter to `f.geometry?.type === 'Point'` before anything
  // ever reaches `registerKmlAdmin`/`_kmlRegistry` — confirmed by
  // `loadKML`'s own comment, "Only register Point annotations — tracks
  // are filtered out" (~226). So a LineString/MultiLineString feature can
  // never populate `registry[path].features` in the first place (see
  // `buildLayerFromGeo`'s `filter` above), meaning `feature.type` here is
  // always `'Point'` in practice. Legacy's import handler was clearly
  // written to handle both cases anyway (defensive completeness written
  // ahead of code that never fed it a line) — kept here rather than
  // trimmed, matching legacy's own unreachable-but-present branch rather
  // than silently dropping a piece of its structure.
  //
  // Any locally-attached admin photos upload to Storage and get inserted
  // as image rows once the new row exists (there's nothing to attach them
  // to beforehand) — legacy has no equivalent step since it just embeds
  // the same base64 array on the new doc directly.
  const importFeature = useCallback(
    async (path, idx, { onImported } = {}) => {
      const file = registry[path];
      const feature = file?.features?.[idx];
      if (!feature) return;

      const marker = markersRef.current[`${path}-${idx}`];
      let newId;
      let kind;
      if (feature.type === 'Point') {
        newId = await insertKmlPointAsWaypoint({
          name: feature.name,
          description: feature.description,
          lat: feature.lat,
          lng: feature.lng,
        });
        kind = 'waypoints';
      } else {
        let points = [{ lat: feature.lat, lng: feature.lng }];
        if (marker && typeof marker.getLatLngs === 'function') {
          points = marker.getLatLngs().flat(Infinity).map((ll) => ({ lat: ll.lat, lng: ll.lng }));
        }
        let dist = 0;
        for (let i = 1; i < points.length; i++) {
          dist += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
        }
        newId = await insertKmlLineAsSegment({
          name: feature.name,
          description: feature.description,
          points,
          distanceM: dist,
        });
        kind = 'segments';
      }

      const files = feature.imageFiles || [];
      if (files.length > 0) {
        const table = kind === 'waypoints' ? 'waypoint_images' : 'segment_images';
        const idColumn = kind === 'waypoints' ? 'waypoint_id' : 'segment_id';
        const paths = [];
        for (let i = 0; i < files.length; i++) {
          paths.push(await uploadImage(kind, newId, files[i], i));
        }
        await insertImageRows(table, idColumn, newId, paths, 0);
      }

      onImported?.();
      return newId;
    },
    [registry]
  );

  return {
    registry,
    loadFromFile,
    loadFromPath,
    renameFeature,
    addImageFile,
    removeImageFile,
    importFeature,
  };
}
