/**
 * exportBuilders.js — GPX/KML/GeoJSON string builders + browser download.
 *
 * Ported verbatim from legacy `app.js` ~2124–2200 (`buildGPX`, `buildKML`,
 * `buildGeoJSON`, `downloadFile`). Re-targeted here (Slice 5) per
 * MIGRATION_PLAN.md's row-5 note: these were originally miscategorized
 * under Slice 4's line range, but their only caller (`processImportPipeline`
 * -> `openSaveModal` -> `doExport`) doesn't exist until this slice.
 */

export function buildGPX(name, desc, points, waypoints) {
  const pts = points
    .map(
      (p) => `    <trkpt lat="${p.lat}" lon="${p.lng}">
      <time>${new Date(p.timestamp).toISOString()}</time>
      <extensions><speed>${p.speed || 0}</speed><accuracy>${p.accuracy || 0}</accuracy></extensions>
    </trkpt>`
    )
    .join('\n');

  const wpts = waypoints
    .map(
      (w) => `  <wpt lat="${w.lat}" lon="${w.lng}">
    <name>${w.name}</name>
    <desc>${w.desc}</desc>
    <time>${new Date(w.timestamp).toISOString()}</time>
  </wpt>`
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="FUTA Smart Map" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${name}</name>
    <desc>${desc}</desc>
    <time>${new Date().toISOString()}</time>
  </metadata>
${wpts}
  <trk>
    <name>${name}</name>
    <trkseg>
${pts}
    </trkseg>
  </trk>
</gpx>`;
}

export function buildKML(name, desc, points, waypoints) {
  const coords = points.map((p) => `${p.lng},${p.lat},0`).join(' ');
  const wpts = waypoints
    .map(
      (w) => `    <Placemark>
      <name>${w.name}</name>
      <description>${w.desc}</description>
      <Point><coordinates>${w.lng},${w.lat},0</coordinates></Point>
    </Placemark>`
    )
    .join('\n');
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${name}</name>
    <description>${desc}</description>
    <Placemark>
      <name>${name}</name>
      <LineString><coordinates>${coords}</coordinates></LineString>
    </Placemark>
${wpts}
  </Document>
</kml>`;
}

export function buildGeoJSON(name, desc, category, points, waypoints) {
  const lineCoords = points.map((p) => [p.lng, p.lat]);
  const wpFeatures = waypoints.map((w) => ({
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [w.lng, w.lat] },
    properties: { name: w.name, desc: w.desc, type: w.type, timestamp: w.timestamp },
  }));
  return JSON.stringify(
    {
      type: 'FeatureCollection',
      features: [
        {
          type: 'Feature',
          geometry: { type: 'LineString', coordinates: lineCoords },
          properties: { name, desc, category, recordedAt: new Date().toISOString() },
        },
        ...wpFeatures,
      ],
    },
    null,
    2
  );
}

export function downloadFile(content, filename, mime) {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
