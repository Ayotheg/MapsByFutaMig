/**
 * kmlAnnotationUtils.js — KML/GPX annotation-name sanitizing.
 *
 * Ported from legacy `app.js` ~108–144 (`_isUnknownAnnotationName`,
 * `_cleanKmlDescription`, `_sanitiseAnnotationName`, `_extractKmlLabel`).
 * Leading underscores dropped on export, matching the convention already
 * used elsewhere in this repo (e.g. `_wpColor` -> `wpColor` in
 * wpTypeMeta.js).
 *
 * NOT ported: `escapeHtmlJsString` (app.js ~99–106). It only had one call
 * site in legacy (an inline `onclick="..."` HTML string built for the
 * navigate button, app.js ~2336) and Slice 2 already replaced that pattern
 * with a normal React callback prop — there's no more HTML-string
 * injection anywhere in the port for it to guard, so it'd be dead code if
 * ported.
 */

/** True if `name` looks like an auto-generated/meaningless KML/GPX label
 * (bare numbers, GPS-track-recorder timestamps, "Waypoint 3", etc.) rather
 * than a real place name. */
export function isUnknownAnnotationName(name) {
  if (!name) return true;
  const t = name.trim();
  if (/^\d+$/.test(t)) return true;
  if (/^(Track\s+)?\d{8}-\d{6}/.test(t)) return true;
  if (/^track$/i.test(t)) return true;
  if (/^(waypoint|placemark|point|wpt)\s*\d*$/i.test(t)) return true;
  // Catch the coordinate-fallback strings sanitiseAnnotationName generates
  // below when a KML point has no usable name, so re-processing an
  // already-sanitised name doesn't treat it as "known".
  if (/annotation\s*@\s*-?[\d.]+/i.test(t)) return true;
  return false;
}

/** Normalises a togeojson `description` property to a plain string.
 *
 * @tmcw/togeojson v7+ no longer always returns `description` as a raw
 * string: when a KML `<description>` contains HTML/CDATA (as BasicAirData
 * GPS Logger's track descriptions do — see test1-12.kml), it's returned as
 * `{ '@type': 'html', value: '<b>...</b>' }` instead. Every caller here
 * used to call `.replace()`/`.match()` directly on `desc`, which threw
 * "(intermediate value).match is not a function" for exactly those files.
 * This unwraps that shape; plain strings (and anything else) pass through
 * unchanged (falling back to '' for non-string, non-html-object values). */
function kmlDescriptionToString(desc) {
  if (typeof desc === 'string') return desc;
  if (desc && typeof desc === 'object' && typeof desc.value === 'string') return desc.value;
  return '';
}

/** Strips HTML tags and collapses whitespace in a KML `<description>`. */
export function cleanKmlDescription(desc) {
  const str = kmlDescriptionToString(desc);
  if (!str) return '';
  return str.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
}

/** Resolves a display name for a KML/GPX point: the raw name if it's
 * meaningful, else a short cleaned description, else a coordinate-based
 * fallback like "Annotation @ 7.29810, 5.13820". */
export function sanitiseAnnotationName(rawName, lat, lng, kmlLabel, rawDesc) {
  if (!isUnknownAnnotationName(rawName)) return rawName.trim();
  const cleanDesc = cleanKmlDescription(rawDesc);
  if (cleanDesc && cleanDesc.length > 0 && cleanDesc.length < 80 && !cleanDesc.includes('http')) {
    return cleanDesc;
  }
  const prefix = kmlLabel ? `${kmlLabel} Annotation` : 'Annotation';
  return `${prefix} @ ${lat.toFixed(5)}, ${lng.toFixed(5)}`;
}

/** Pulls a human label for a whole KML file out of its first bolded
 * placemark description, e.g. `<b>Block A</b>` -> "Block A". Used as a
 * fallback prefix for unnamed points from that file. */
export function extractKmlLabel(geo) {
  for (const f of geo.features || []) {
    const desc = kmlDescriptionToString(f.properties?.description);
    const m = desc.match(/<b>([^<]+)<\/b>/i);
    if (m && m[1]) return m[1].trim();
  }
  return null;
}
