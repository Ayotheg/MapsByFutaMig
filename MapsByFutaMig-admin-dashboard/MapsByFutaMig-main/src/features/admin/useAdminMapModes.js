import { useCallback, useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import styles from './AdminMapStage.module.css';
import { insertKmlLineAsSegment } from './adminSave';
import { lineLength } from './coordInput';

// Leaflet needs real colours, not CSS variables.
const brandColour = (name, fallback) =>
  getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;

/**
 * The things an admin does on the map: pick a spot, drag a pin, draw a
 * footpath, or just look. The dashboard stays mounted underneath (so a
 * half-filled form survives); `mode` decides what the map stage shows.
 *
 * mode: null | 'pick' | 'move' | 'draw' | 'view'
 */
export function useAdminMapModes({ map, onSegmentsChanged, onPathSaved }) {
  const [mode, setMode] = useState(null);
  const [pickedCoord, setPickedCoord] = useState(null);

  // ── Pick one spot ──────────────────────────────────────────────────────
  const pickHandlerRef = useRef(null);
  const cancelPick = useCallback(() => {
    if (pickHandlerRef.current && map) map.off('click', pickHandlerRef.current);
    pickHandlerRef.current = null;
    setMode((m) => (m === 'pick' ? null : m));
  }, [map]);
  const startPicking = useCallback(() => {
    if (!map) return;
    const handler = (e) => {
      pickHandlerRef.current = null;
      setPickedCoord({ lat: e.latlng.lat, lng: e.latlng.lng });
      setMode(null);
    };
    pickHandlerRef.current = handler;
    map.once('click', handler);
    setMode('pick');
  }, [map]);

  // ── Move a pin ─────────────────────────────────────────────────────────
  const moveRef = useRef(null); // { marker, onClick, resolve }
  const endMove = useCallback(
    (keep) => {
      const m = moveRef.current;
      if (!m || !map) return;
      moveRef.current = null;
      map.off('click', m.onClick);
      map.removeLayer(m.marker);
      const { lat, lng } = m.marker.getLatLng();
      m.resolve(keep ? { lat, lng } : null);
      setMode(null);
    },
    [map]
  );
  const movePin = useCallback(
    (start) =>
      new Promise((resolve) => {
        if (!map) return resolve(null);
        endMove(false);
        const marker = L.marker([start.lat, start.lng], {
          draggable: true,
          zIndexOffset: 1000,
          icon: L.divIcon({ className: styles.movePin, iconSize: [26, 26], iconAnchor: [13, 13] }),
        }).addTo(map);
        const onClick = (e) => marker.setLatLng(e.latlng);
        map.on('click', onClick);
        moveRef.current = { marker, onClick, resolve };
        setMode('move');
        map.setView([start.lat, start.lng], Math.max(map.getZoom(), 18));
      }),
    [map, endMove]
  );

  // ── Draw a footpath ────────────────────────────────────────────────────
  const [drawPoints, setDrawPoints] = useState([]);
  const [drawDetails, setDrawDetails] = useState(null); // { name, category, saving, error } after "Next"
  const drawRef = useRef(null); // { line, vertices: L.Marker[], onClick }

  const syncDraw = useCallback(() => {
    const d = drawRef.current;
    if (!d) return;
    const pts = d.vertices.map((v) => v.getLatLng());
    d.line.setLatLngs(pts);
    setDrawPoints(pts.map(({ lat, lng }) => ({ lat, lng })));
  }, []);
  const addDrawPoint = useCallback(
    (latlng) => {
      const d = drawRef.current;
      if (!d || !map) return;
      const v = L.marker(latlng, {
        draggable: true,
        icon: L.divIcon({ className: styles.drawVertex, iconSize: [20, 20], iconAnchor: [10, 10] }),
      }).addTo(map);
      v.on('drag', syncDraw);
      d.vertices.push(v);
      syncDraw();
    },
    [map, syncDraw]
  );
  const endDraw = useCallback(() => {
    const d = drawRef.current;
    if (!d || !map) return;
    drawRef.current = null;
    map.off('click', d.onClick);
    d.vertices.forEach((v) => map.removeLayer(v));
    map.removeLayer(d.line);
    setMode(null);
    setDrawPoints([]);
    setDrawDetails(null);
  }, [map]);
  const startDraw = useCallback(() => {
    if (!map) return;
    endDraw();
    const line = L.polyline([], { color: brandColour('--v2-secondary', '#0d9488'), weight: 5, opacity: 0.9 }).addTo(map);
    const onClick = (e) => addDrawPoint(e.latlng);
    map.on('click', onClick);
    drawRef.current = { line, vertices: [], onClick };
    setMode('draw');
  }, [map, endDraw, addDrawPoint]);
  const undoDrawPoint = useCallback(() => {
    const d = drawRef.current;
    const v = d?.vertices.pop();
    if (!v || !map) return;
    map.removeLayer(v);
    syncDraw();
  }, [map, syncDraw]);
  const saveDrawnPath = useCallback(async () => {
    const name = drawDetails?.name.trim();
    if (!name) {
      setDrawDetails((dd) => ({ ...dd, error: 'Give the path a name.' }));
      return;
    }
    setDrawDetails((dd) => ({ ...dd, saving: true, error: null }));
    try {
      await insertKmlLineAsSegment({
        name,
        description: '',
        category: drawDetails.category,
        points: drawPoints,
        distanceM: Math.round(lineLength(drawPoints)),
      });
      onSegmentsChanged?.();
      endDraw();
      onPathSaved?.();
    } catch (e) {
      setDrawDetails((dd) => ({ ...dd, saving: false, error: e.message || 'Could not save the path.' }));
    }
  }, [drawDetails, drawPoints, onSegmentsChanged, onPathSaved, endDraw]);

  // ── Just look (e.g. loaded KML overlays) ───────────────────────────────
  const viewMap = useCallback(() => setMode('view'), []);
  const closeView = useCallback(() => setMode((m) => (m === 'view' ? null : m)), []);

  useEffect(
    () => () => {
      endMove(false);
      endDraw();
    },
    [endMove, endDraw]
  );

  return {
    mode,
    pickedCoord,
    setPickedCoord,
    startPicking,
    cancelPick,
    movePin,
    endMove,
    startDraw,
    endDraw,
    undoDrawPoint,
    drawPoints,
    drawDetails,
    setDrawDetails,
    saveDrawnPath,
    viewMap,
    closeView,
  };
}
