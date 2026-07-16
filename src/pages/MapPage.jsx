import { lazy, Suspense, useEffect, useState } from 'react';
import MapShell from '../features/map/MapShell';
import WaypointLayer from '../features/waypoints/WaypointLayer';
import PlaceCard from '../features/waypoints/PlaceCard';
import { useWaypoints } from '../features/waypoints/useWaypoints';
import { useTypeVisibility } from '../features/legend/useTypeVisibility';
import Sidebar from '../features/legend/Sidebar';
import MobileSheet from '../features/legend/MobileSheet';
import SegmentsLayer from '../features/segments/SegmentsLayer';
import { useSegments } from '../features/segments/useSegments';
import StaticKmlLayer from '../features/kml/StaticKmlLayer';
import ImportTrigger from '../features/kml/ImportTrigger';

// Slice 4: bundle-size policy (CLAUDE.md, effective starting this slice) —
// DetailModal isn't needed for first paint, only mounts on a click, so it's
// lazy-loaded per the exact pattern the policy specifies.
const DetailModal = lazy(() => import('../features/segments/DetailModal'));

/**
 * First page-level composition of the map with feature chrome around it.
 * Per CLAUDE.md's own note on MapShell being mounted directly at `/`
 * "until a future slice adds chrome around the map" — Slice 2's place
 * card was that chrome; Slice 3 adds the sidebar/legend on top.
 *
 * `useWaypoints()` now lives here instead of inside WaypointLayer — the
 * legend's place-type filter needs the same list (for counts), so this
 * page fetches once and passes it down to both, instead of doubling the
 * Supabase read.
 *
 * Desktop vs mobile chrome is decided once on mount via
 * `window.innerWidth`, matching legacy's own `initMobileLayout`'s
 * `isMobile()` check (app.js ~5546) — that check also only runs once at
 * script load, not on every resize. Kept as an intentional 1:1 match
 * rather than "improving" it into a resize listener.
 */
export default function MapPage() {
  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState(null);
  const [isMobile] = useState(() => window.innerWidth <= 768);
  const [selectedSegmentId, setSelectedSegmentId] = useState(null);

  const { waypoints, refetch: refetchWaypoints } = useWaypoints();
  const typeVisibilityProps = useTypeVisibility(waypoints);
  const { segments, refetch: refetchSegments } = useSegments();
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null;

  // Legacy: `map.on('click', function() { if (_isOpen) closeCard(); })` —
  // a click on the map background (not a marker, which already stops
  // propagation in WaypointLayer) dismisses the open place card.
  useEffect(() => {
    if (!map) return;
    const handler = () => setSelected(null);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map]);

  return (
    <>
      <MapShell onMapReady={setMap} />
      {map && (
        <WaypointLayer
          map={map}
          waypoints={waypoints}
          isTypeVisible={typeVisibilityProps.isVisible}
          onSelect={setSelected}
        />
      )}
      {map && (
        <SegmentsLayer map={map} segments={segments} onViewDetails={setSelectedSegmentId} />
      )}
      {map && <StaticKmlLayer map={map} onSelect={setSelected} />}
      <ImportTrigger
        waypoints={waypoints}
        segments={segments}
        onSaved={async () => {
          await Promise.all([refetchWaypoints(), refetchSegments()]);
        }}
      />
      <PlaceCard data={selected} onClose={() => setSelected(null)} />
      {selectedSegment && (
        <Suspense fallback={null}>
          <DetailModal segment={selectedSegment} onClose={() => setSelectedSegmentId(null)} />
        </Suspense>
      )}
      {isMobile ? (
        <MobileSheet map={map} typeVisibilityProps={typeVisibilityProps} />
      ) : (
        <Sidebar map={map} typeVisibilityProps={typeVisibilityProps} />
      )}
    </>
  );
}