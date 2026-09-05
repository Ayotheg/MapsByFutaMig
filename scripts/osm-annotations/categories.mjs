// Tag groups queried against Overpass for the Lagos/Ogun state-wide pull.
//
// This is deliberately separate from `src/features/osm-annotations/`
// (the live in-app FUTA-campus-only Overpass hook) — that feature is
// untouched by this addition. This file only feeds the standalone
// `fetch-osm-annotations.mjs` data-extraction script.
//
// Each entry becomes its own Overpass query batch: `key` (required on the
// element) plus an optional `values` allowlist (when the bare key is too
// broad/high-volume to pull unfiltered across an entire state, e.g.
// `highway` or `landuse`). Every batch also requires `name` to be present,
// since an unnamed node/way isn't an "annotation" a search/nav UI can
// meaningfully surface — this mirrors the filtering the existing
// `useOSMAnnotations` hook already does for the campus-scoped fetch.
//
// `building` is included but restricted to named buildings only — every
// building footprint in two entire states (named or not) is a different,
// much larger dataset (pure geometry, not "places") and out of scope here.

export const CATEGORIES = [
  { group: 'amenity', key: 'amenity' },
  { group: 'shop', key: 'shop' },
  { group: 'tourism', key: 'tourism' },
  { group: 'leisure', key: 'leisure' },
  { group: 'office', key: 'office' },
  { group: 'craft', key: 'craft' },
  { group: 'healthcare', key: 'healthcare' },
  { group: 'historic', key: 'historic' },
  { group: 'emergency', key: 'emergency' },
  { group: 'man_made', key: 'man_made' },
  { group: 'natural', key: 'natural' },
  { group: 'waterway', key: 'waterway' },
  { group: 'railway', key: 'railway' },
  { group: 'aeroway', key: 'aeroway' },
  { group: 'public_transport', key: 'public_transport' },
  {
    group: 'highway',
    key: 'highway',
    // Unfiltered `highway` is every road segment in two states — restrict
    // to the values that represent an actual named *place* (a stop,
    // junction, rest area), not a stretch of road.
    values: ['bus_stop', 'services', 'rest_area', 'traffic_signals'],
  },
  {
    group: 'place',
    key: 'place',
    values: ['city', 'town', 'village', 'suburb', 'neighbourhood', 'hamlet', 'quarter', 'town_hall'],
  },
  {
    group: 'landuse',
    key: 'landuse',
    // Bare `landuse` covers every parcel of farmland/residential land in
    // the state; only named ones (e.g. a named industrial estate/market
    // layout) are useful as an "annotation".
    values: null, // null + requireName below is handled same as bare key; kept named-only via requireName
  },
  { group: 'building', key: 'building', requireName: true },
];

// Every batch requires the element to have a `name` tag regardless of the
// `requireName` flag above — that flag exists only for readability/intent
// at the `building`/`landuse` entries, since those two keys are the ones
// most likely to be huge if the name filter were ever accidentally dropped.
export const ALWAYS_REQUIRE_NAME = true;
