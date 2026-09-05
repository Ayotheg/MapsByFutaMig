#!/usr/bin/env node
// Expand OpenStreetMap annotations — Lagos State + Ogun State, full extent.
//
// WHAT THIS IS
// A standalone, offline data-extraction script. It queries the Overpass
// API (the standard read API for OpenStreetMap data) for every named,
// taggable "place" feature across the ENTIRE administrative extent of
// Lagos State and Ogun State, Nigeria — not just the FUTA campus bounding
// box the live app currently uses.
//
// This is intentionally separate from, and does NOT modify or replace,
// `src/features/osm-annotations/useOSMAnnotations.js` (the in-app hook
// that fetches OSM POIs live, scoped to CAMPUS_BOUNDS, for the map to
// render as markers). That hook is untouched. This script is a data
// pipeline: run it out-of-band, it writes a JSON dataset to disk, and
// *that dataset* is what a future map/nav feature can consume — nothing
// here wires it into the running app.
//
// WHY A SEPARATE SCRIPT INSTEAD OF WIDENING THE LIVE HOOK
// Lagos + Ogun together are two of Nigeria's most densely-mapped states.
// A single unbounded Overpass query over that whole area would time out
// or get rejected by the public Overpass instances, and running it from
// the browser on every page load (like the campus hook does) isn't
// practical at this scale. So: fetch once, offline, in batches; cache the
// raw responses; write a static dataset the app can load instead of
// hitting Overpass live.
//
// USAGE
//   node scripts/osm-annotations/fetch-osm-annotations.mjs
//   node scripts/osm-annotations/fetch-osm-annotations.mjs --state=lagos
//   node scripts/osm-annotations/fetch-osm-annotations.mjs --categories=amenity,shop
//   node scripts/osm-annotations/fetch-osm-annotations.mjs --dry-run
//   node scripts/osm-annotations/fetch-osm-annotations.mjs --no-resume
//
// See README.md in this folder for the full flag list and output format.
//
// REQUIREMENTS
// Node 18+ (uses the built-in global `fetch`). No new npm dependencies —
// nothing added to package.json.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CATEGORIES } from './categories.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');

// ---------------------------------------------------------------------------
// CLI args
// ---------------------------------------------------------------------------

function parseArgs(argv) {
  const args = {
    state: 'all', // 'all' | 'lagos' | 'ogun'
    categories: null, // null = all, else array of group names
    outDir: path.join(REPO_ROOT, 'data', 'osm-annotations'),
    endpoint: null, // override the mirror list with a single endpoint
    delayMs: 2000, // pause between Overpass requests — be a good API citizen
    timeoutSec: 300,
    dryRun: false,
    resume: true, // reuse cached raw responses on disk instead of re-fetching
    lagosRelationId: null, // optional explicit OSM relation id override
    ogunRelationId: null,
  };
  for (const raw of argv) {
    const [flag, value] = raw.split(/=(.*)/s);
    switch (flag) {
      case '--state':
        args.state = value;
        break;
      case '--categories':
        args.categories = value.split(',').map((s) => s.trim()).filter(Boolean);
        break;
      case '--out':
        args.outDir = path.isAbsolute(value) ? value : path.join(REPO_ROOT, value);
        break;
      case '--endpoint':
        args.endpoint = value;
        break;
      case '--delay-ms':
        args.delayMs = Number(value);
        break;
      case '--timeout-sec':
        args.timeoutSec = Number(value);
        break;
      case '--dry-run':
        args.dryRun = true;
        break;
      case '--no-resume':
        args.resume = false;
        break;
      case '--lagos-relation':
        args.lagosRelationId = value;
        break;
      case '--ogun-relation':
        args.ogunRelationId = value;
        break;
      case '--help':
      case '-h':
        printHelp();
        process.exit(0);
        break;
      default:
        if (raw.trim()) console.warn(`[osm-annotations] Ignoring unrecognized flag: ${raw}`);
    }
  }
  return args;
}

function printHelp() {
  console.log(`
Expand OpenStreetMap annotations — Lagos + Ogun states

Usage:
  node scripts/osm-annotations/fetch-osm-annotations.mjs [flags]

Flags:
  --state=all|lagos|ogun        Which state(s) to pull (default: all)
  --categories=amenity,shop     Comma list of category groups (default: all — see categories.mjs)
  --out=data/osm-annotations    Output directory, relative to repo root (default shown)
  --endpoint=<url>              Force a single Overpass endpoint instead of the mirror list
  --delay-ms=2000               Pause between Overpass requests (default: 2000)
  --timeout-sec=300             Overpass server-side [timeout:] value per query (default: 300)
  --dry-run                     Print the Overpass QL for every batch, fetch nothing
  --no-resume                   Ignore cached raw responses and re-fetch everything
  --lagos-relation=<id>         Skip name-based area lookup; use this OSM relation id for Lagos
  --ogun-relation=<id>          Skip name-based area lookup; use this OSM relation id for Ogun
  --help                        Show this message
`);
}

// ---------------------------------------------------------------------------
// Overpass endpoints — same mirror-fallback idea as the live app's hook
// (src/features/osm-annotations/useOSMAnnotations.js), duplicated here on
// purpose rather than imported: this script runs under plain Node outside
// the Vite/browser build, and keeping it dependency-free/standalone means
// it can't accidentally break if that hook's file ever moves.
// ---------------------------------------------------------------------------

const DEFAULT_OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
];

const STATES = {
  lagos: { label: 'Lagos', osmName: 'Lagos' },
  ogun: { label: 'Ogun', osmName: 'Ogun' },
};

// ---------------------------------------------------------------------------
// Overpass query builders
// ---------------------------------------------------------------------------

/**
 * Resolves a Nigerian state's boundary as an Overpass "area" set, nested
 * inside the Nigeria country boundary so a same-named LGA/town elsewhere
 * in the country can't be matched by accident. If an explicit relation id
 * is supplied, that's used directly instead (more robust, since state
 * boundary names/admin_level tagging can occasionally be inconsistent).
 */
function buildAreaClause(stateKey, explicitRelationId) {
  if (explicitRelationId) {
    // Overpass area ids for a relation are the relation id + 3600000000.
    const areaId = 3600000000 + Number(explicitRelationId);
    return `area(${areaId})->.searchArea;`;
  }
  const { osmName } = STATES[stateKey];
  return (
    `area["ISO3166-1"="NG"]["admin_level"="2"]->.country;\n` +
    `area["name"="${osmName}"]["admin_level"="4"](area.country)->.searchArea;`
  );
}

function buildCategoryQuery({ stateKey, explicitRelationId, category, timeoutSec }) {
  const { key, values } = category;
  const tagFilter = values && values.length
    ? `["${key}"~"^(${values.join('|')})$"]`
    : `["${key}"]`;
  const nameFilter = '["name"]';
  const area = buildAreaClause(stateKey, explicitRelationId);
  return (
    `[out:json][timeout:${timeoutSec}];\n` +
    `${area}\n` +
    `(\n` +
    `  node${tagFilter}${nameFilter}(area.searchArea);\n` +
    `  way${tagFilter}${nameFilter}(area.searchArea);\n` +
    `  relation${tagFilter}${nameFilter}(area.searchArea);\n` +
    `);\n` +
    `out center meta;`
  );
}

// ---------------------------------------------------------------------------
// Fetch with mirror fallback + on-disk raw cache (so a long, multi-hour,
// multi-batch job can be safely interrupted and resumed with --resume,
// the default, instead of re-downloading everything from scratch).
// ---------------------------------------------------------------------------

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runOverpassQuery(query, { endpoints, timeoutSec }) {
  let lastErr = null;
  for (const endpoint of endpoints) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), (timeoutSec + 30) * 1000);
      const res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
          'User-Agent': 'MapsByFutaMig-OSM-annotations-script/1.0 (contact: kemmiebabk@gmail.com)',
        },
        body: 'data=' + encodeURIComponent(query),
        signal: controller.signal,
      });
      clearTimeout(timer);
      if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`${endpoint} responded ${res.status}${text ? `: ${text.slice(0, 300)}` : ''}`);
      }
      return await res.json();
    } catch (err) {
      lastErr = err;
      console.warn(`[osm-annotations]   endpoint failed (${endpoint.split('/')[2]}): ${err.message}`);
    }
  }
  throw lastErr || new Error('all Overpass endpoints failed');
}

async function fetchBatch({ stateKey, category, args, cacheDir }) {
  const cacheFile = path.join(cacheDir, `${stateKey}.${category.group}.json`);

  if (args.resume && fs.existsSync(cacheFile)) {
    console.log(`[osm-annotations] (cached) ${stateKey}/${category.group}`);
    return JSON.parse(fs.readFileSync(cacheFile, 'utf-8'));
  }

  const query = buildCategoryQuery({
    stateKey,
    explicitRelationId: stateKey === 'lagos' ? args.lagosRelationId : args.ogunRelationId,
    category,
    timeoutSec: args.timeoutSec,
  });

  if (args.dryRun) {
    console.log(`\n--- ${stateKey}/${category.group} ---\n${query}\n`);
    return { elements: [] };
  }

  console.log(`[osm-annotations] fetching ${stateKey}/${category.group} ...`);
  const endpoints = args.endpoint ? [args.endpoint] : DEFAULT_OVERPASS_ENDPOINTS;
  const data = await runOverpassQuery(query, { endpoints, timeoutSec: args.timeoutSec });

  fs.mkdirSync(cacheDir, { recursive: true });
  fs.writeFileSync(cacheFile, JSON.stringify(data));
  console.log(`[osm-annotations]   -> ${data.elements?.length ?? 0} raw elements (cached to ${path.relative(REPO_ROOT, cacheFile)})`);

  await sleep(args.delayMs);
  return data;
}

// ---------------------------------------------------------------------------
// Parsing: raw Overpass elements -> normalized annotation records
// ---------------------------------------------------------------------------

function pickAddress(tags) {
  const addr = {};
  for (const [k, v] of Object.entries(tags)) {
    if (k.startsWith('addr:')) addr[k.slice(5)] = v;
  }
  return Object.keys(addr).length ? addr : undefined;
}

function pickAltNames(tags) {
  const alt = {};
  for (const [k, v] of Object.entries(tags)) {
    if (k === 'name') continue;
    if (k.startsWith('name:') || k === 'alt_name' || k === 'short_name' || k === 'old_name') {
      alt[k] = v;
    }
  }
  return Object.keys(alt).length ? alt : undefined;
}

/**
 * Picks the most relevant single (key, value) pair to describe *what kind
 * of place* this is, in priority order — a feature can legitimately carry
 * several of these keys at once (e.g. a hospital that is also a named
 * building); we want one clear primary category for search/nav UI, while
 * `tags` below still keeps everything OSM actually provided.
 */
const CATEGORY_PRIORITY = [
  'amenity', 'shop', 'tourism', 'leisure', 'office', 'craft', 'healthcare',
  'historic', 'emergency', 'man_made', 'natural', 'waterway', 'railway',
  'aeroway', 'public_transport', 'highway', 'place', 'landuse', 'building',
];

function primaryCategory(tags) {
  for (const key of CATEGORY_PRIORITY) {
    if (tags[key]) return { category: key, subtype: tags[key] };
  }
  return { category: 'unknown', subtype: undefined };
}

function normalizeElement(el, stateLabel) {
  const tags = el.tags || {};
  const name = (tags.name || '').trim();
  if (!name) return null;

  const lat = el.lat ?? el.center?.lat;
  const lon = el.lon ?? el.center?.lon;
  if (lat == null || lon == null) return null;

  const { category, subtype } = primaryCategory(tags);

  return {
    id: `${el.type}/${el.id}`,
    osmType: el.type, // 'node' | 'way' | 'relation'
    osmId: el.id,
    name,
    altNames: pickAltNames(tags),
    category,
    subtype,
    lat,
    lon,
    state: stateLabel,
    address: pickAddress(tags),
    website: tags.website || tags['contact:website'] || undefined,
    phone: tags.phone || tags['contact:phone'] || undefined,
    openingHours: tags.opening_hours || undefined,
    wikidata: tags.wikidata || undefined,
    wikipedia: tags.wikipedia || undefined,
    operator: tags.operator || undefined,
    // Full raw tag bag — nothing OSM provided is dropped, everything above
    // is just a convenience projection of what's already in here.
    tags,
    // Edit-history metadata, present when the query used `out ... meta;`
    // — useful for judging how fresh/trustworthy a given record is.
    meta: {
      version: el.version,
      timestamp: el.timestamp,
      changeset: el.changeset,
      user: el.user,
      uid: el.uid,
    },
  };
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const stateKeys = args.state === 'all' ? Object.keys(STATES) : [args.state];
  for (const s of stateKeys) {
    if (!STATES[s]) {
      console.error(`[osm-annotations] Unknown --state "${s}". Expected: all, lagos, ogun.`);
      process.exit(1);
    }
  }

  const categories = args.categories
    ? CATEGORIES.filter((c) => args.categories.includes(c.group))
    : CATEGORIES;
  if (!categories.length) {
    console.error('[osm-annotations] No matching categories — check --categories against categories.mjs group names.');
    process.exit(1);
  }

  const cacheDir = path.join(args.outDir, 'raw');
  const byId = new Map(); // dedup across category batches, keyed by "type/id"
  const countsByStateCategory = {};

  for (const stateKey of stateKeys) {
    const { label } = STATES[stateKey];
    countsByStateCategory[stateKey] = {};

    for (const category of categories) {
      const data = await fetchBatch({ stateKey, category, args, cacheDir });
      let added = 0;
      for (const el of data.elements || []) {
        const record = normalizeElement(el, label);
        if (!record) continue;
        if (!byId.has(record.id)) {
          added++;
        } else {
          // Already captured under another category batch — merge tags
          // instead of dropping, in case one batch's element had partial
          // tags (shouldn't happen with `out ... meta`, but cheap safety).
          const existing = byId.get(record.id);
          existing.tags = { ...record.tags, ...existing.tags };
        }
        byId.set(record.id, byId.get(record.id) ?? record);
      }
      countsByStateCategory[stateKey][category.group] = added;
    }
  }

  if (args.dryRun) {
    console.log('[osm-annotations] --dry-run: no data written.');
    return;
  }

  const all = Array.from(byId.values()).sort((a, b) => a.state.localeCompare(b.state) || a.name.localeCompare(b.name));
  fs.mkdirSync(args.outDir, { recursive: true });

  for (const stateKey of stateKeys) {
    const { label } = STATES[stateKey];
    const subset = all.filter((r) => r.state === label);
    const file = path.join(args.outDir, `${stateKey}.json`);
    fs.writeFileSync(file, JSON.stringify(subset, null, 2));
    console.log(`[osm-annotations] wrote ${subset.length} records -> ${path.relative(REPO_ROOT, file)}`);
  }

  if (stateKeys.length > 1) {
    const combinedFile = path.join(args.outDir, 'lagos-ogun.json');
    fs.writeFileSync(combinedFile, JSON.stringify(all, null, 2));
    console.log(`[osm-annotations] wrote ${all.length} combined records -> ${path.relative(REPO_ROOT, combinedFile)}`);
  }

  const summary = {
    generatedAt: new Date().toISOString(),
    totalRecords: all.length,
    byState: Object.fromEntries(
      stateKeys.map((k) => [STATES[k].label, all.filter((r) => r.state === STATES[k].label).length])
    ),
    byStateAndCategoryBatch: countsByStateCategory,
  };
  const summaryFile = path.join(args.outDir, 'summary.json');
  fs.writeFileSync(summaryFile, JSON.stringify(summary, null, 2));
  console.log(`[osm-annotations] wrote summary -> ${path.relative(REPO_ROOT, summaryFile)}`);
}

main().catch((err) => {
  console.error('[osm-annotations] Fatal error:', err);
  process.exit(1);
});
