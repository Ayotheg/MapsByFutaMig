import { haversine } from '../../lib/geoUtils.js';

// Reads the admin's typed or pasted "lat, lng" (Google Maps' "Copy
// coordinates" gives exactly that). Pure so scripts/coordInput.test.mjs
// can check it in Node.

/** { lat, lng }, or null unless there are exactly two numbers in range. */
export function parseLatLng(text) {
  const nums = String(text || '').match(/-?\d+(?:\.\d+)?/g);
  if (!nums || nums.length !== 2) return null;
  const [lat, lng] = nums.map(Number);
  if (Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  return { lat, lng };
}

export function formatLatLng(lat, lng) {
  return `${Number(lat).toFixed(6)}, ${Number(lng).toFixed(6)}`;
}

/** Metres along a [{ lat, lng }] line. */
export function lineLength(points) {
  let m = 0;
  for (let i = 1; i < points.length; i++) m += haversine(points[i - 1].lat, points[i - 1].lng, points[i].lat, points[i].lng);
  return m;
}
