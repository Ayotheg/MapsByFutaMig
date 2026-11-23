# OSM annotations — Lagos & Ogun state-wide extraction

Standalone, offline data-extraction script. Pulls every named OSM "place"
feature (amenities, shops, tourism, leisure, offices, healthcare, historic
sites, transit stops, named buildings, settlements, etc.) across the
**entire administrative extent** of Lagos State and Ogun State, Nigeria —
not just the FUTA campus bounding box.

## This does NOT touch the existing app

`src/features/osm-annotations/useOSMAnnotations.js` is the live, in-app
Overpass hook. It still fetches only within `CAMPUS_BOUNDS` and renders
markers on the map exactly as before — **nothing about it changed.**

This script is a separate, one-off (or periodically re-run) data pipeline
that lives entirely under `scripts/osm-annotations/` and writes its output
to `data/osm-annotations/`. Nothing here is imported by the app, and no
existing file was modified to add it. Wiring the resulting dataset into
search/navigation is a future, deliberate step — not something this script
does on its own.

## Requirements

- Node 18+ (uses the built-in global `fetch` — no new npm dependencies,
  nothing added to `package.json`).
- Network access to a public Overpass API instance. **This could not be
  executed inside the sandbox this script was authored in** (its egress
  allowlist doesn't include any Overpass/Nominatim host), so it has not
  been run yet. Run it from a machine with normal internet access.

## Usage

```bash
# Everything: both states, every category (this is a big pull — see
# "Runtime & etiquette" below before running the full thing unattended)
node scripts/osm-annotations/fetch-osm-annotations.mjs

# Just one state
node scripts/osm-annotations/fetch-osm-annotations.mjs --state=lagos

# Just a couple of categories (see categories.mjs for the full group list)
node scripts/osm-annotations/fetch-osm-annotations.mjs --categories=amenity,shop,tourism

# See the exact Overpass QL that would run, without fetching anything
node scripts/osm-annotations/fetch-osm-annotations.mjs --dry-run

# Re-fetch everything, ignoring the on-disk raw cache
node scripts/osm-annotations/fetch-osm-annotations.mjs --no-resume
```

Full flag reference: `node scripts/osm-annotations/fetch-osm-annotations.mjs --help`.

### If state-name area resolution is ambiguous

The script resolves each state's boundary by querying Overpass for an
`admin_level=4` area named `"Lagos"` / `"Ogun"` nested inside Nigeria's
country boundary. This is the standard, robust pattern for this — but if a
particular Overpass instance's data ever makes that name lookup ambiguous,
you can bypass it entirely by passing the state's exact OSM **relation
id** directly:

```bash
node scripts/osm-annotations/fetch-osm-annotations.mjs --lagos-relation=1234567 --ogun-relation=7654321
```

(Look these up once via https://www.openstreetmap.org, search "Lagos
State, Nigeria" / "Ogun State, Nigeria", and take the relation id from the
URL — `relation/<id>`.)

## What gets fetched

Each "category" in `categories.mjs` is its own Overpass query batch (per
state), requiring the element to have both a `name` tag and the category's
key (e.g. `amenity`, `shop`, `tourism`, ...). Splitting by category — and
using `out center` instead of full geometry — keeps each batch's payload
small enough for the public Overpass instances to answer without timing
out, even though the combined area is two entire states.

Categories included: `amenity`, `shop`, `tourism`, `leisure`, `office`,
`craft`, `healthcare`, `historic`, `emergency`, `man_made`, `natural`,
`waterway`, `railway`, `aeroway`, `public_transport`, a curated subset of
`highway` (bus stops, rest areas, etc. — not every road segment),
settlement-type `place` values (city/town/village/suburb/...), and named
`building`s. See `categories.mjs` for the exact list and rationale, and
add/remove groups there if the dataset needs to cover more or less.

## Output format

Written to `data/osm-annotations/` (relative to the repo root):

- `lagos.json` / `ogun.json` — one array of records per state
- `lagos-ogun.json` — the combined, deduplicated array (only written when
  both states are fetched in the same run)
- `summary.json` — record counts by state and by category batch
- `raw/` — cached raw Overpass JSON responses, one file per
  state+category batch. This is what `--no-resume`/`--resume` (default:
  resume) checks against, so an interrupted multi-hour run can pick back
  up without re-downloading everything.

Each record in the state/combined JSON files:

```jsonc
{
  "id": "node/123456789",       // "<osmType>/<osmId>" — stable, globally unique
  "osmType": "node",             // "node" | "way" | "relation"
  "osmId": 123456789,
  "name": "Example Pharmacy",
  "altNames": { "name:yo": "...", "old_name": "..." },   // omitted if none
  "category": "amenity",         // primary tag key that identified this place
  "subtype": "pharmacy",         // that key's value
  "lat": 6.5244,
  "lon": 3.3792,
  "state": "Lagos",              // "Lagos" | "Ogun"
  "address": { "street": "...", "city": "...", "postcode": "..." }, // from addr:* tags, omitted if none
  "website": "https://...",      // omitted if absent
  "phone": "+234...",            // omitted if absent
  "openingHours": "Mo-Sa 08:00-20:00", // omitted if absent
  "wikidata": "Q...",            // omitted if absent
  "wikipedia": "en:...",         // omitted if absent
  "operator": "...",             // omitted if absent
  "tags": { /* the complete, unfiltered OSM tag set for this element */ },
  "meta": {                      // OSM edit-history metadata (from `out ... meta`)
    "version": 4,
    "timestamp": "2024-11-02T10:15:00Z",
    "changeset": 123456,
    "user": "someone",
    "uid": 987654
  }
}
```

`tags` always carries everything OSM provided, even fields not lifted into
a named field above — nothing is discarded. The named fields above are
just a convenience projection for the common cases the task called out
(name, type/category, lat/lon) plus the extra identifying info OSM tends
to carry (address, contact info, external identifiers like `wikidata`,
and edit metadata).

## Runtime & etiquette

Public Overpass instances are shared, rate-limited, volunteer-run
infrastructure. This script:

- Batches by category (18 batches × 2 states = 36 requests for the full
  run) rather than one giant per-state query, to stay within reasonable
  response sizes/timeouts.
- Waits `--delay-ms` (default 2000ms) between requests.
- Falls back across three known mirror instances per request if one
  errors.
- Caches every raw response to `data/osm-annotations/raw/` so a re-run
  (e.g. after a transient failure) doesn't re-fetch batches that already
  succeeded.

Expect the full two-state run to take a while (network + server queue
time, not local compute) — that's expected given the scope. Prefer
`--categories=` to fetch incrementally rather than raising `--delay-ms`
down or hammering retries.

## Regenerating the dataset later

OSM data changes continuously. Re-run with `--no-resume` periodically to
refresh, rather than assuming the first pull stays accurate indefinitely.
