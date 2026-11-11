import { useEffect, useRef } from 'react';
import L from 'leaflet';
import { Footprints, MapPin, Move, Target, Undo2, X } from 'lucide-react';
import styles from './AdminMapStage.module.css';
import { CAMPUS_BOUNDS } from '../../lib/campusBounds';
import { getBasemapStyle, DEFAULT_BASEMAP_ID } from '../map/basemaps';
import { lineLength } from './coordInput';

const CAMPUS_CENTER = [7.298, 5.138];

/**
 * A full-screen map the dashboard brings up for jobs that need one: pick a
 * spot, drag a pin, draw a footpath, or look at loaded KML. It stays
 * mounted (hidden) so KML overlays survive going back to the tables.
 */
export default function AdminMapStage({ modes, waypoints, onReady }) {
  const { mode } = modes;
  const active = mode !== null;
  const containerRef = useRef(null);
  const mapRef = useRef(null);
  const contextRef = useRef(null);
  const onReadyRef = useRef(onReady);
  onReadyRef.current = onReady;

  useEffect(() => {
    if (mapRef.current) return undefined;
    const map = L.map(containerRef.current, {
      center: CAMPUS_CENTER,
      zoom: 16,
      minZoom: 5,
      maxZoom: 19,
      preferCanvas: true,
    });
    mapRef.current = map;
    const style = getBasemapStyle(DEFAULT_BASEMAP_ID);
    L.tileLayer(style.url, {
      attribution: style.attribution,
      maxZoom: style.maxZoom,
      maxNativeZoom: style.maxNativeZoom,
      ...(style.subdomains ? { subdomains: style.subdomains } : {}),
    }).addTo(map);
    L.rectangle(CAMPUS_BOUNDS, { color: '#7c3aed', weight: 1, fill: false, dashArray: '4 6', interactive: false }).addTo(map);
    contextRef.current = L.layerGroup().addTo(map);
    onReadyRef.current?.(map);
    return () => {
      map.remove();
      mapRef.current = null;
      onReadyRef.current?.(null);
    };
  }, []);

  // Existing places as quiet dots, so a new spot is placed relative to them.
  useEffect(() => {
    const group = contextRef.current;
    if (!group) return;
    group.clearLayers();
    waypoints.forEach((wp) => {
      if (wp.isPerson || wp.isChannel || wp.isBusiness || wp.lat == null || wp.lng == null) return;
      L.circleMarker([Number(wp.lat), Number(wp.lng)], {
        radius: 4,
        color: '#ffffff',
        weight: 1.5,
        fillColor: '#6b6478',
        fillOpacity: 0.85,
        interactive: false,
      }).addTo(group);
    });
  }, [waypoints]);

  // The container is display:none while hidden, so Leaflet needs a nudge.
  useEffect(() => {
    if (!active || !mapRef.current) return undefined;
    const id = requestAnimationFrame(() => mapRef.current?.invalidateSize());
    return () => cancelAnimationFrame(id);
  }, [active]);

  const { drawDetails, drawPoints } = modes;

  return (
    <div className={styles.stage} hidden={!active}>
      <div ref={containerRef} className={styles.map} />

      {mode === 'pick' && (
        <Bar icon={<Target size={18} />} text="Tap the map where the place is.">
          <button type="button" className={styles.btnGhost} onClick={modes.cancelPick}>
            Cancel
          </button>
        </Bar>
      )}

      {mode === 'move' && (
        <Bar icon={<Move size={18} />} text="Drag the pin to the right spot, or tap where it should go.">
          <button type="button" className={styles.btnGhost} onClick={() => modes.endMove(false)}>
            Cancel
          </button>
          <button type="button" className={styles.btnPrimary} onClick={() => modes.endMove(true)}>
            Use this spot
          </button>
        </Bar>
      )}

      {mode === 'draw' && !drawDetails && (
        <Bar
          icon={<Footprints size={18} />}
          text={
            drawPoints.length === 0
              ? 'Tap along the path, from the road it leaves to the road it joins.'
              : `${drawPoints.length} point${drawPoints.length === 1 ? '' : 's'} · ${Math.round(lineLength(drawPoints))} m. Drag a point to adjust it.`
          }
        >
          <button type="button" className={styles.btnGhost} onClick={modes.undoDrawPoint} disabled={!drawPoints.length}>
            <Undo2 size={15} /> Undo
          </button>
          <button type="button" className={styles.btnGhost} onClick={modes.endDraw}>
            Cancel
          </button>
          <button
            type="button"
            className={styles.btnPrimary}
            disabled={drawPoints.length < 2}
            onClick={() => modes.setDrawDetails({ name: '', category: 'footpath', saving: false, error: null })}
          >
            Next
          </button>
        </Bar>
      )}

      {mode === 'draw' && drawDetails && (
        <div className={styles.bar}>
          <div className={styles.barForm}>
            <label className={styles.field}>
              <span>Name</span>
              <input
                type="text"
                value={drawDetails.name}
                placeholder="e.g. Behind SOC shortcut"
                autoFocus
                onChange={(e) => modes.setDrawDetails((d) => ({ ...d, name: e.target.value, error: null }))}
              />
            </label>
            <label className={styles.field}>
              <span>Type</span>
              <select
                value={drawDetails.category}
                onChange={(e) => modes.setDrawDetails((d) => ({ ...d, category: e.target.value }))}
              >
                <option value="footpath">Footpath</option>
                <option value="shortcut">Shortcut</option>
              </select>
            </label>
          </div>
          {drawDetails.error && <p className={styles.error}>{drawDetails.error}</p>}
          <div className={styles.barActions}>
            <button type="button" className={styles.btnGhost} disabled={drawDetails.saving} onClick={() => modes.setDrawDetails(null)}>
              Back
            </button>
            <button type="button" className={styles.btnPrimary} disabled={drawDetails.saving} onClick={modes.saveDrawnPath}>
              {drawDetails.saving ? 'Saving…' : 'Save path'}
            </button>
          </div>
        </div>
      )}

      {mode === 'view' && (
        <button type="button" className={styles.closeView} onClick={modes.closeView}>
          <X size={16} /> Back to dashboard
        </button>
      )}
    </div>
  );
}

function Bar({ icon, text, children }) {
  return (
    <div className={styles.bar}>
      <p className={styles.barText}>
        <span className={styles.barIcon}>{icon || <MapPin size={18} />}</span>
        {text}
      </p>
      <div className={styles.barActions}>{children}</div>
    </div>
  );
}
