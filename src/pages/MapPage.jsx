import { useEffect, useState } from 'react';
import MapShell from '../features/map/MapShell';
import WaypointLayer from '../features/waypoints/WaypointLayer';
import PlaceCard from '../features/waypoints/PlaceCard';

/**
 * First page-level composition of the map with feature chrome around it.
 * Per CLAUDE.md's own note on MapShell being mounted directly at `/` "until
 * a future slice adds chrome around the map" — Slice 2's place card is that
 * chrome, so this file exists now instead of MapShell being the route
 * element directly. Update App.jsx's `/` route to point here.
 */
export default function MapPage() {
  const [map, setMap] = useState(null);
  const [selected, setSelected] = useState(null);

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
      {map && <WaypointLayer map={map} onSelect={setSelected} />}
      <PlaceCard data={selected} onClose={() => setSelected(null)} />
    </>
  );
}
