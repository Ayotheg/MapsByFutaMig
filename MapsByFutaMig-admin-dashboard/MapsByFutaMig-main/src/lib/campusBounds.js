import L from 'leaflet';

/**
 * Shared campus bounding box. Originally a MapShell.jsx-local constant
 * (Slice 1); moved here in Slice 5 once `useImportPipeline` (features/kml)
 * needed the exact same bounds to filter imported GPS points/waypoints
 * outside campus — a real second usage, and `lib/` is where non-component,
 * cross-feature constants belong per CLAUDE.md's folder structure.
 */
export const CAMPUS_BOUNDS = L.latLngBounds([7.2820, 5.1080], [7.3120, 5.1680]);
