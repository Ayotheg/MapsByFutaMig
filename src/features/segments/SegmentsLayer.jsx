import { useEffect, useRef } from 'react';
import L from 'leaflet';
import './segmentPopup.css';

// ── Ported from legacy app.js `drawSavedSegment` (~2548–2590) ────────────
// Raw Leaflet, not react-leaflet, per CLAUDE.md — same imperative pattern
// as WaypointLayer.jsx. Segments aren't viewport-batched or gated behind
// `_infoMode` in legacy (unlike waypoints), so this stays simple: every
// segment with ≥2 points gets a polyline added directly.
//
// NOT ported: `FUTA_SEARCH.register(...)` (app.js ~2579–2588) — that's
// Slice 7 (Search). No search index exists yet to register into; revisit
// once Slice 7 lands, same "don't build ahead of your slice" rule that
// kept GPS/Nav rail buttons inert through Slice 3.

const SEGMENT_COLORS = ['#00c896', '#a78bfa', '#60a5fa', '#f472b6', '#34d399', '#fb923c'];

/**
 * SegmentsLayer — draws saved segment polylines on `map` and wires up the
 * click → popup → "View Details" flow.
 *
 * `onViewDetails(segmentId)` fires when the popup's button is clicked.
 * Legacy wired this via a global `window.openDetailModal(segId)` referenced
 * from an inline `onclick=""` string (app.js ~2567) — same visual/behavioral
 * result here, but the button's listener is attached to the popup's real
 * DOM node after `openOn()` inserts it, and calls a normal React callback
 * prop instead of reaching for `window`.
 */
export default function SegmentsLayer({ map, segments, onViewDetails }) {
  const linesRef = useRef({}); // segmentId -> L.Polyline
  const onViewDetailsRef = useRef(onViewDetails);
  onViewDetailsRef.current = onViewDetails;

  useEffect(() => {
    if (!map) return;

    const lines = linesRef.current;

    segments.forEach((seg, i) => {
      if (!seg.points || seg.points.length < 2) return;
      if (lines[seg.id]) return; // already drawn — segments don't change shape after load

      const color = SEGMENT_COLORS[i % SEGMENT_COLORS.length];
      const latlngs = seg.points.map((p) => [p.lat, p.lng]);
      const line = L.polyline(latlngs, { color, weight: 4, opacity: 0.85 }).addTo(map);
      lines[seg.id] = line;

      line.on('click', () => {
        const popup = L.popup()
          .setLatLng(line.getBounds().getCenter())
          .setContent(
            `<div class="seg-popup">
              <div class="seg-popup-name">${seg.name}</div>
              <div class="seg-popup-meta">${seg.category} · ${((seg.distance || 0) / 1000).toFixed(2)} km</div>
              <button type="button" class="seg-popup-btn">▶ VIEW DETAILS</button>
            </div>`
          )
          .openOn(map);

        // Popup content is inserted synchronously by openOn(), so the button
        // exists in the DOM immediately — no need to wait for a 'popupopen'
        // event.
        popup
          .getElement()
          ?.querySelector('.seg-popup-btn')
          ?.addEventListener('click', () => onViewDetailsRef.current?.(seg.id));
      });
    });

    // Remove lines for segments no longer in the list (e.g. after a refetch).
    const currentIds = new Set(segments.map((s) => s.id));
    Object.keys(lines).forEach((id) => {
      if (!currentIds.has(id)) {
        map.removeLayer(lines[id]);
        delete lines[id];
      }
    });

    return () => {
      // Full teardown only on unmount (map going away) — handled by the
      // separate cleanup effect below, so a segments-array change alone
      // doesn't flicker every line off and back on.
    };
  }, [map, segments]);

  // Full cleanup when the layer itself unmounts (map instance torn down).
  useEffect(() => {
    return () => {
      const lines = linesRef.current;
      Object.values(lines).forEach((line) => {
        if (map?.hasLayer(line)) map.removeLayer(line);
      });
      linesRef.current = {};
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}