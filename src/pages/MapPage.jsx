import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
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
import { useOSMAnnotations } from '../features/osm-annotations/useOSMAnnotations';
import { useViewMode } from '../features/osm-annotations/useViewMode';
import OSMAnnotationLayer from '../features/osm-annotations/OSMAnnotationLayer';
import ViewModeToggle from '../features/osm-annotations/ViewModeToggle';
import { useSearchIndex } from '../features/search/useSearchIndex';
import DesktopSearchBar from '../features/search/DesktopSearchBar';
import MobileSearchBar from '../features/search/MobileSearchBar';
import MobileSearchOverlay from '../features/search/MobileSearchOverlay';
import QuickChips from '../features/search/QuickChips';
import ChipResultsPanel from '../features/search/ChipResultsPanel';

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

  const { waypoints, loading: waypointsLoading, refetch: refetchWaypoints } = useWaypoints();
  const typeVisibilityProps = useTypeVisibility(waypoints);
  const { segments, refetch: refetchSegments } = useSegments();
  const selectedSegment = segments.find((s) => s.id === selectedSegmentId) || null;

  // ── Slice 7: search ─────────────────────────────────────────────────
  // `collapsed`/`sheetState` were promoted out of Sidebar/MobileSheet
  // (see their own header comments) so the floating search chrome can
  // shift/collapse in step with them, matching legacy's body-class-driven
  // CSS coupling without reaching for globals.
  const [collapsed, setCollapsed] = useState(false);
  const [sheetState, setSheetState] = useState('peek');
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [activeChip, setActiveChip] = useState(null);

  // ── Slice 6: OSM annotations + dedup ──────────────────────────────────
  // `kmlAnnotations` is reported up by StaticKmlLayer as it loads (named
  // points only); combined with `waypoints` into the live dedup index
  // `useOSMAnnotations` checks each fetched OSM POI against. See
  // useOSMAnnotations.js's header comment for why this is reactive rather
  // than a one-shot check like legacy's.
  const [kmlAnnotations, setKmlAnnotations] = useState([]);
  const dedupIndex = useMemo(
    () => [
      ...waypoints.map((wp) => ({ id: wp.id, lat: wp.lat, lng: wp.lng, name: wp.name, source: 'waypoint' })),
      ...kmlAnnotations.map((a) => ({ ...a, source: 'kml' })),
    ],
    [waypoints, kmlAnnotations]
  );
  const { items: osmItems, snaps: osmSnaps, badgeMerges: osmBadgeMerges } = useOSMAnnotations(dedupIndex);
  const { viewMode, toggle: toggleViewMode } = useViewMode();

  const searchIndex = useSearchIndex({ waypoints, segments, kmlAnnotations });

  // Legacy: `map.on('click', function() { if (_activeChip) closeResultsPanel(); })`
  // (app.js ~6857–6859) — a map click also dismisses the place card
  // (handled by the effect just below); both listen independently, same
  // as legacy's two separate `map.on('click', ...)` registrations.
  useEffect(() => {
    if (!map) return;
    const handler = () => setActiveChip(null);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map]);

  // Legacy: `map.on('click', function() { if (_isOpen) closeCard(); })` —
  // a click on the map background (not a marker, which already stops
  // propagation in WaypointLayer) dismisses the open place card.
  useEffect(() => {
    if (!map) return;
    const handler = () => setSelected(null);
    map.on('click', handler);
    return () => map.off('click', handler);
  }, [map]);

  function handleChipClick(chip) {
    setActiveChip((prev) => (prev?.label === chip.label ? null : chip));
  }

  return (
    <>
      <MapShell onMapReady={setMap} />
      {map && (
        <WaypointLayer
          map={map}
          waypoints={waypoints}
          isTypeVisible={typeVisibilityProps.isVisible}
          onSelect={setSelected}
          snaps={osmSnaps}
          badgeMerges={osmBadgeMerges}
        />
      )}
      {map && (
        <SegmentsLayer map={map} segments={segments} onViewDetails={setSelectedSegmentId} />
      )}
      {map && (
        <StaticKmlLayer
          map={map}
          onSelect={setSelected}
          onAnnotationsChange={setKmlAnnotations}
          dedupSnaps={osmSnaps}
          dedupBadges={osmBadgeMerges}
        />
      )}
      {map && <OSMAnnotationLayer map={map} items={osmItems} onSelect={setSelected} />}
      {!isMobile && <ViewModeToggle viewMode={viewMode} onToggle={toggleViewMode} />}
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
        <MobileSheet
          map={map}
          typeVisibilityProps={typeVisibilityProps}
          sheetState={sheetState}
          onSheetStateChange={setSheetState}
        />
      ) : (
        <Sidebar map={map} typeVisibilityProps={typeVisibilityProps} collapsed={collapsed} onCollapsedChange={setCollapsed} />
      )}

      {/* ── Slice 7: search ─────────────────────────────────────────── */}
      {isMobile ? (
        <>
          <MobileSearchBar
            onOpenSearch={() => {
              setMobileSearchOpen(true);
              setSheetState('peek');
            }}
            onToggleSheet={() => setSheetState((s) => (s === 'peek' ? 'half' : 'peek'))}
            activeChipLabel={activeChip?.label}
          />
          <MobileSearchOverlay
            open={mobileSearchOpen}
            map={map}
            searchIndex={searchIndex}
            onSelect={setSelected}
            onClose={() => setMobileSearchOpen(false)}
          />
        </>
      ) : (
        <DesktopSearchBar
          map={map}
          searchIndex={searchIndex}
          onSelect={setSelected}
          collapsed={collapsed}
          onToggleCollapsed={setCollapsed}
          onManualType={() => setActiveChip(null)}
          activeChipLabel={activeChip?.label}
        />
      )}
      <QuickChips activeChip={activeChip} onChipClick={handleChipClick} collapsed={collapsed} isMobile={isMobile} />
      <ChipResultsPanel
        activeChip={activeChip}
        waypoints={waypoints}
        waypointsLoaded={!waypointsLoading}
        searchIndex={searchIndex}
        map={map}
        onSelect={setSelected}
        onClose={() => setActiveChip(null)}
        isMobile={isMobile}
        collapsed={collapsed}
      />
    </>
  );
}