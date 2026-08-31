import { useEffect, useState } from 'react';

/**
 * A single, cheap `getCurrentPosition()` call for the Explore panel's
 * "X mins away" labels — deliberately NOT the same machinery as
 * `useGpsTracking.js` (Slice 9), which drives live turn-by-turn tracking,
 * position smoothing, and the map's own GPS dot. Explore only needs one
 * rough fix to sort/label cards by proximity, not a continuous watch —
 * reusing the heavier hook here would start sensor tracking just for a
 * closed panel to read, which is the wrong lifecycle for it.
 *
 * Fails silently (returns `null`) on denial/timeout/unsupported browsers
 * — cards fall back to showing their type instead of a distance, same
 * "never block the UI on a permission prompt" approach QuickChips/search
 * already take for `getUserLatLng()` (chipConfig.js).
 */
export function useOneShotLocation(enabled) {
  const [coords, setCoords] = useState(null);

  useEffect(() => {
    if (!enabled || coords || typeof navigator === 'undefined' || !navigator.geolocation) return;
    let cancelled = false;
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        if (cancelled) return;
        setCoords({ lat: pos.coords.latitude, lng: pos.coords.longitude });
      },
      () => {
        /* denied/unavailable — cards just won't show a distance */
      },
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
    );
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);

  return coords;
}
