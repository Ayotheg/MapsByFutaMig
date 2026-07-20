import { useCallback, useState } from 'react';
import styles from './LayersPanel.module.css';
import PlaceTypeFilter from './PlaceTypeFilter';
import { BASEMAP_STYLES, DEFAULT_BASEMAP_ID } from '../map/basemaps';

/**
 * Body content of the Layers panel — composed once, rendered by both the
 * desktop Sidebar and the mobile bottom sheet.
 *
 * Ported from legacy `index.html` lines ~443–521 (Live Data / Reference /
 * Base Map Style / Opacity markup — the waypoints/KML toggle rows above
 * that are `display:none` "kept for JS compat" are NOT ported, they're
 * dead legacy DOM) and `app.js`'s `initLayerPanel` IIFE (~5320–5536).
 *
 * Not ported (see app.js ~5324–5372, ~5374–5388): `legendActiveDot`,
 * `legendAllBtn`, and the stats-strip (`statWpTotal`/`statKmlTotal`/
 * `statLayersOn`) — none of those element IDs exist anywhere in the
 * current `index.html`, so that JS is dead/vestigial (always null-
 * guarded no-ops). Not invented here either, per CLAUDE.md.
 *
 * Base Map Style: CLAUDE.md flagged that legacy's JS referenced a
 * second "Dark" CartoDB style with no matching `.basemap-thumb` in the
 * HTML to select it — this grid is a real implementation of that
 * picker rather than the single always-active swatch the port
 * previously matched, backed by `features/map/basemaps.js` and
 * `map.setBaseMapStyle(id)` (imperative, same pattern as
 * `map._campusBoundaryLayer`).
 */
export default function LayersPanel({
  map,
  typeVisibilityProps,
}) {
  // ── GPS Trail toggle — UI-only for now. Legacy guards every trail-layer
  // touch with `if (window.trailLine)`; that layer doesn't exist until
  // Slice 9 (GPS & Navigation), so this just tracks the on/off state and
  // dims the row, same visible effect legacy has before a trail exists.
  const [trailOn, setTrailOn] = useState(true);

  // ── Campus Boundary toggle — the boundary rectangle DOES exist already
  // (MapShell draws it, Slice 1). MapShell exposes it as
  // `map._campusBoundaryLayer` for exactly this purpose.
  const [boundaryOn, setBoundaryOn] = useState(true);
  const toggleBoundary = useCallback(
    (checked) => {
      setBoundaryOn(checked);
      const layer = map?._campusBoundaryLayer;
      if (!layer) return;
      if (checked && !map.hasLayer(layer)) layer.addTo(map);
      else if (!checked && map.hasLayer(layer)) map.removeLayer(layer);
    },
    [map]
  );

  const zoomToBoundary = useCallback(() => {
    if (!map) return;
    const layer = map._campusBoundaryLayer;
    if (layer) map.fitBounds(layer.getBounds(), { padding: [40, 40] });
  }, [map]);

  // ── Base Map Style — reads the map's current style off
  // `map._baseMapStyleId` (set by MapShell on init) so this stays in
  // sync even if something else ever changes it; switching just calls
  // the imperative `map.setBaseMapStyle(id)` MapShell exposes and
  // mirrors the id into local state to redraw the "active" swatch.
  const [basemapId, setBasemapId] = useState(map?._baseMapStyleId || DEFAULT_BASEMAP_ID);
  const selectBasemap = useCallback(
    (id) => {
      setBasemapId(id);
      map?.setBaseMapStyle?.(id);
    },
    [map]
  );

  // ── Map opacity slider — dims Leaflet's tile + overlay panes together,
  // same target elements as legacy (app.js ~5519–5525).
  const [opacity, setOpacity] = useState(100);
  const handleOpacity = useCallback((e) => {
    const pct = parseInt(e.target.value, 10);
    setOpacity(pct);
    const panes = document.querySelectorAll('.leaflet-tile-pane, .leaflet-overlay-pane');
    panes.forEach((p) => {
      p.style.opacity = pct / 100;
    });
  }, []);

  return (
    <>
      <PlaceTypeFilter {...typeVisibilityProps} />

      <div className={styles.sectionLabel}>Live Data</div>
      <div className={`${styles.layerRow} ${!trailOn ? styles.layerOff : ''}`}>
        <div className={styles.layerRowMain}>
          <span className={styles.layerIconWrap} style={{ '--layer-color': '#ddb7ff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#ddb7ff" strokeWidth="2" strokeLinecap="round" strokeDasharray="3 2">
              <path d="M3 12h18" />
            </svg>
          </span>
          <span className={styles.layerName}>GPS Trail</span>
          <span className={styles.layerBadgeLive}>●</span>
          <label className={styles.lswitch}>
            <input
              type="checkbox"
              checked={trailOn}
              onChange={(e) => setTrailOn(e.target.checked)}
            />
            <span className={styles.lswitchTrack}>
              <span className={styles.lswitchKnob} />
            </span>
          </label>
        </div>
        <div className={styles.layerSub}>
          <span className={styles.layerSubDesc}>Your breadcrumb path</span>
          <span className={`${styles.statusPill} ${styles.statusGps}`}>GPS</span>
        </div>
      </div>

      <div className={styles.sectionLabel}>Reference</div>
      <div className={`${styles.layerRow} ${!boundaryOn ? styles.layerOff : ''}`}>
        <div className={styles.layerRowMain}>
          <span className={styles.layerIconWrap} style={{ '--layer-color': '#4d9fff' }}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#4d9fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" strokeDasharray="4 2">
              <rect x="3" y="3" width="18" height="18" rx="2" />
            </svg>
          </span>
          <span className={styles.layerName}>Campus Bounds</span>
          <label className={styles.lswitch}>
            <input
              type="checkbox"
              checked={boundaryOn}
              onChange={(e) => toggleBoundary(e.target.checked)}
            />
            <span className={styles.lswitchTrack}>
              <span className={styles.lswitchKnob} />
            </span>
          </label>
        </div>
        <div className={styles.layerSub}>
          <button type="button" className={styles.layerAction} onClick={zoomToBoundary}>
            <svg width="10" height="10" viewBox="0 0 12 12">
              <circle cx="5" cy="5" r="4" stroke="currentColor" strokeWidth="1.4" fill="none" />
              <line x1="8.5" y1="8.5" x2="11" y2="11" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
              <line x1="5" y1="3" x2="5" y2="7" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
              <line x1="3" y1="5" x2="7" y2="5" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" />
            </svg>
            Zoom to
          </button>
          <span className={styles.layerSubDesc}>FUTA perimeter outline</span>
          <span className={`${styles.statusPill} ${styles.statusStatic}`}>STATIC</span>
        </div>
      </div>

      <div className={styles.sectionLabel}>Base Map Style</div>
      <div className={styles.basemapGrid}>
        {BASEMAP_STYLES.map((style) => {
          const active = basemapId === style.id;
          return (
            <button
              key={style.id}
              type="button"
              className={`${styles.basemapThumb} ${active ? styles.active : ''}`}
              aria-pressed={active}
              onClick={() => selectBasemap(style.id)}
            >
              <div className={`${styles.basemapPreview} ${styles[`preview${style.label}`] || ''}`} />
              <span>{style.label}</span>
            </button>
          );
        })}
      </div>

      <div className={styles.opacitySection}>
        <div className={styles.opacityHeader}>
          <span className={styles.opacityLabel}>Map Opacity</span>
          <span className={styles.opacityVal}>{opacity}%</span>
        </div>
        <div className={styles.opacityTrackWrap}>
          <input
            type="range"
            min="20"
            max="100"
            value={opacity}
            onChange={handleOpacity}
            className={styles.opacitySlider}
            style={{ '--pct': `${opacity}%` }}
          />
        </div>
      </div>
    </>
  );
}
