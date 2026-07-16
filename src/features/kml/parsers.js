import { kml as toGeoJSONKml } from '@tmcw/togeojson';
import { sanitiseAnnotationName, cleanKmlDescription, extractKmlLabel } from './kmlAnnotationUtils';

/**
 * parsers.js — turns an uploaded .kml/.gpx file's text into
 * `{ points, waypoints }`, ready for `processImportPipeline`.
 *
 * Ported from legacy `app.js` ~1913–2012 (`parseKMLText`, `parseGPXText`).
 *
 * Legacy loaded `toGeoJSON` as a global via a vendored `kml/lib/togeojson.js`
 * script tag (`window.toGeoJSON.kml(...)`). This port uses the maintained
 * npm package `@tmcw/togeojson` instead (same underlying conversion, real
 * module import) — added to package.json as part of this slice.
 *
 * NOT ported: a GeoJSON *import* parser. MIGRATION_PLAN.md's Slice 5
 * bullet says "parsers for KML/GPX/GeoJSON text", but tracing the actual
 * upload handler (`adminImportInput`'s change listener, app.js ~1846–1864)
 * shows it only ever branches on `.kml` -> parseKMLText or `.gpx` ->
 * parseGPXText; anything else hits the "Unsupported file format" alert.
 * GeoJSON only appears as an *export* format (`buildGeoJSON`, see
 * exportBuilders.js) — there's no matching import parser in legacy to
 * port. Flagging this rather than inventing one, per CLAUDE.md's "never
 * guess at legacy behavior" rule.
 */

export function parseKMLText(text) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');
  const geo = toGeoJSONKml(xml);
  const points = [];
  const waypoints = [];
  const kmlLabel = extractKmlLabel(geo);

  (geo.features || []).forEach((f) => {
    const geom = f.geometry;
    if (!geom) return;

    if (geom.type === 'LineString') {
      geom.coordinates.forEach((coord) => {
        points.push({ lat: coord[1], lng: coord[0], accuracy: 5, speed: 0, timestamp: Date.now() });
      });
    } else if (geom.type === 'MultiLineString') {
      geom.coordinates.forEach((line) => {
        line.forEach((coord) => {
          points.push({ lat: coord[1], lng: coord[0], accuracy: 5, speed: 0, timestamp: Date.now() });
        });
      });
    } else if (geom.type === 'Point') {
      const lat = geom.coordinates[1];
      const lng = geom.coordinates[0];
      const rawName = f.properties?.name || '';
      const rawDesc = f.properties?.description || '';

      const displayName = sanitiseAnnotationName(rawName, lat, lng, kmlLabel, rawDesc);

      waypoints.push({
        lat,
        lng,
        name: displayName,
        desc: cleanKmlDescription(rawDesc),
        type: 'landmark',
        timestamp: Date.now(),
      });
    }
  });

  return { points, waypoints };
}

export function parseGPXText(text) {
  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'text/xml');
  const points = [];
  const waypoints = [];

  const trkpts = xml.getElementsByTagName('trkpt');
  for (let i = 0; i < trkpts.length; i++) {
    const el = trkpts[i];
    const lat = parseFloat(el.getAttribute('lat'));
    const lng = parseFloat(el.getAttribute('lon'));
    let timestamp = Date.now();
    const timeEl = el.getElementsByTagName('time')[0];
    if (timeEl) timestamp = new Date(timeEl.textContent).getTime();

    let speed = 0;
    const speedEl = el.getElementsByTagName('speed')[0];
    if (speedEl) speed = parseFloat(speedEl.textContent) * 3.6;

    points.push({ lat, lng, accuracy: 5, speed, timestamp });
  }

  const wpts = xml.getElementsByTagName('wpt');
  for (let i = 0; i < wpts.length; i++) {
    const el = wpts[i];
    const lat = parseFloat(el.getAttribute('lat'));
    const lng = parseFloat(el.getAttribute('lon'));

    const nameEl = el.getElementsByTagName('name')[0];
    const rawName = nameEl ? nameEl.textContent.trim() : '';

    const descEl = el.getElementsByTagName('desc')[0];
    const rawDesc = descEl ? descEl.textContent.trim() : '';

    let timestamp = Date.now();
    const timeEl = el.getElementsByTagName('time')[0];
    if (timeEl) timestamp = new Date(timeEl.textContent).getTime();

    let type = 'landmark';
    const typeEl = el.getElementsByTagName('type')[0];
    if (typeEl) type = typeEl.textContent.trim();

    const displayName = sanitiseAnnotationName(rawName, lat, lng, null, rawDesc);

    waypoints.push({
      lat,
      lng,
      name: displayName,
      desc: cleanKmlDescription(rawDesc),
      type,
      timestamp,
    });
  }

  return { points, waypoints };
}
