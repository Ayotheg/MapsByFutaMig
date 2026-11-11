import { useState, useCallback } from 'react';
import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import { haversine, simplifyPath } from '../../lib/geoUtils';
import { parseKMLText, parseGPXText } from './parsers';

/**
 * useImportPipeline — parses an uploaded .kml/.gpx file and runs legacy's
 * dedup/snap pipeline against already-known waypoints/segments, producing
 * a draft segment ready for the save modal.
 *
 * Ported from legacy `app.js`:
 *   - `processImportPipeline` (~1696–1814)
 *   - the `adminImportInput` change handler (~1846–1910), minus the DOM
 *     bits (`#adminOverlay` hide, `#segName`/`#segDesc` field writes —
 *     those become the save modal's own initial state instead)
 *
 * ── Deliberate deviation from legacy ──────────────────────────────────
 * Legacy matched/snapped against `_adminData.waypoints`/`_adminData.segments`
 * — a cache populated by the not-yet-built admin panel (Slice 11). That
 * cache doesn't exist in this port yet, so this hook takes `waypoints`
 * (from `useWaypoints()`) and `segments` (from `useSegments()`) as
 * parameters instead — the same live "what do we already know about"
 * data, just sourced from this slice's own hooks rather than an admin
 * cache. Functionally equivalent for dedup/snap purposes; flag if the
 * real admin cache (once Slice 11 lands) should take priority instead.
 *
 * `alert(message)` (app.js ~1806–1811, summarising what the pipeline did)
 * becomes a returned `pipelineMessage` string instead of a blocking
 * browser alert — the caller (ImportTrigger.jsx) decides how to surface
 * it (a toast/status line lives more naturally in the save modal that
 * opens immediately after).
 */
export function useImportPipeline({ waypoints = [], segments = [] } = {}) {
  const [recordedPoints, setRecordedPoints] = useState([]);
  const [recordedWaypoints, setRecordedWaypoints] = useState([]);
  const [totalDistance, setTotalDistance] = useState(0);
  const [recStartTime, setRecStartTime] = useState(null);
  const [pipelineMessage, setPipelineMessage] = useState(null);
  const [defaultName, setDefaultName] = useState('');
  const [defaultDesc, setDefaultDesc] = useState('');
  const [error, setError] = useState(null);

  const processImportPipeline = useCallback(
    (parsed) => {
      let pts = parsed.points || [];
      let wpts = parsed.waypoints || [];

      pts = pts.filter((p) => CAMPUS_BOUNDS.contains([p.lat, p.lng]));
      wpts = wpts.filter((wp) => CAMPUS_BOUNDS.contains([wp.lat, wp.lng]));

      pts = simplifyPath(pts, 2.5);

      const finalWpts = [];
      const mergedCount = { database: 0, internal: 0 };

      wpts.forEach((newWp) => {
        let matchedDb = null;
        let minDbDist = Infinity;
        waypoints.forEach((existingWp) => {
          const dist = haversine(newWp.lat, newWp.lng, existingWp.lat, existingWp.lng);
          if (dist < 10 && dist < minDbDist) {
            minDbDist = dist;
            matchedDb = existingWp;
          }
        });

        if (matchedDb) {
          newWp.lat = matchedDb.lat;
          newWp.lng = matchedDb.lng;
          mergedCount.database++;
          return;
        }

        let matchedInternal = null;
        let minInternalDist = Infinity;
        finalWpts.forEach((prevWp) => {
          const dist = haversine(newWp.lat, newWp.lng, prevWp.lat, prevWp.lng);
          if (dist < 10 && dist < minInternalDist) {
            minInternalDist = dist;
            matchedInternal = prevWp;
          }
        });

        if (matchedInternal) {
          newWp.lat = matchedInternal.lat;
          newWp.lng = matchedInternal.lng;
          mergedCount.internal++;
          return;
        }

        finalWpts.push(newWp);
      });

      const allReferenceWpts = [...waypoints, ...finalWpts];

      const _10mLat = 10 / 111320;
      const _10mLng = 10 / 110420;

      pts = pts.map((pt) => {
        let bestSnap = null;
        let minSnapDist = Infinity;
        for (const wp of allReferenceWpts) {
          if (Math.abs(wp.lat - pt.lat) > _10mLat) continue;
          if (Math.abs(wp.lng - pt.lng) > _10mLng) continue;
          const dist = haversine(pt.lat, pt.lng, wp.lat, wp.lng);
          if (dist < 10 && dist < minSnapDist) {
            minSnapDist = dist;
            bestSnap = wp;
          }
        }
        return bestSnap ? { ...pt, lat: bestSnap.lat, lng: bestSnap.lng } : pt;
      });

      const _6mLat = 6 / 111320;
      const _6mLng = 6 / 110420;
      const allSegPts = segments.flatMap((seg) => seg.points || []);

      pts = pts.map((pt) => {
        let bestTrackSnap = null;
        let minTrackSnapDist = Infinity;
        for (const segPt of allSegPts) {
          if (Math.abs(segPt.lat - pt.lat) > _6mLat) continue;
          if (Math.abs(segPt.lng - pt.lng) > _6mLng) continue;
          const dist = haversine(pt.lat, pt.lng, segPt.lat, segPt.lng);
          if (dist < 6 && dist < minTrackSnapDist) {
            minTrackSnapDist = dist;
            bestTrackSnap = segPt;
          }
        }
        return bestTrackSnap ? { ...pt, lat: bestTrackSnap.lat, lng: bestTrackSnap.lng } : pt;
      });

      let message = 'Import pipeline complete:\n- Path coordinates smoothed & simplified.\n- Filtered coordinates outside boundary.';
      const collapsedCount = mergedCount.database + mergedCount.internal;
      if (collapsedCount > 0) {
        message += `\n- Collapsed ${collapsedCount} overlapping waypoints to prevent map clutter.`;
      }

      return { points: pts, waypoints: finalWpts, message };
    },
    [waypoints, segments]
  );

  /** Reads + parses + processes an uploaded File. Mirrors the
   * `adminImportInput` change handler's try/catch + state assignment. */
  const importFile = useCallback(
    (file) =>
      new Promise((resolve, reject) => {
        setError(null);
        const reader = new FileReader();
        reader.onload = (evt) => {
          const text = evt.target.result;
          let parsed = null;

          try {
            if (file.name.toLowerCase().endsWith('.kml')) {
              parsed = parseKMLText(text);
            } else if (file.name.toLowerCase().endsWith('.gpx')) {
              parsed = parseGPXText(text);
            } else {
              const err = new Error('Unsupported file format. Please upload a .kml or .gpx file.');
              setError(err.message);
              reject(err);
              return;
            }

            if (!parsed || (parsed.points.length === 0 && parsed.waypoints.length === 0)) {
              const err = new Error('Could not parse any points or waypoints from this file.');
              setError(err.message);
              reject(err);
              return;
            }

            const processed = processImportPipeline(parsed);

            let distance = 0;
            for (let i = 1; i < processed.points.length; i++) {
              distance += haversine(
                processed.points[i - 1].lat,
                processed.points[i - 1].lng,
                processed.points[i].lat,
                processed.points[i].lng
              );
            }

            setRecordedPoints(processed.points);
            setRecordedWaypoints(processed.waypoints);
            setTotalDistance(distance);
            setRecStartTime(Date.now());
            setPipelineMessage(processed.message);
            setDefaultName(file.name.replace(/\.[^/.]+$/, '').replace(/[-_]/g, ' '));
            setDefaultDesc(`Imported from ${file.name} on ${new Date().toLocaleDateString()}`);

            resolve(processed);
          } catch (err) {
            setError(`Failed to parse file: ${err.message}`);
            reject(err);
          }
        };
        reader.onerror = () => {
          const err = new Error('Failed to read file.');
          setError(err.message);
          reject(err);
        };
        reader.readAsText(file);
      }),
    [processImportPipeline]
  );

  const updateRecordedWaypoint = useCallback((idx, field, value) => {
    setRecordedWaypoints((prev) => {
      const next = [...prev];
      next[idx] = { ...next[idx], [field]: value };
      return next;
    });
  }, []);

  return {
    recordedPoints,
    recordedWaypoints,
    totalDistance,
    recStartTime,
    pipelineMessage,
    defaultName,
    defaultDesc,
    error,
    importFile,
    updateRecordedWaypoint,
  };
}
