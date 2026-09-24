#!/usr/bin/env node
// Loads the dataset produced by fetch-osm-annotations.mjs into the
// EXISTING `waypoints` table (no new table) — same table useWaypoints.js,
// search, admin, and navigation already read from. Reuses the existing
// `source_type = 'osm_import'` value the schema/app already defines for
// exactly this purpose (see FIREBASE_TO_SUPABASE_MIGRATION.md and
// useWaypoints.js).
//
// IMPORTANT — read before running:
// useWaypoints.js currently does `if (wp.source_type === 'osm_import')
// continue;`, which hides ALL osm_import rows from the map/search. Rows
// this script inserts will sit in the DB but stay invisible until that
// filter is adjusted (a separate, deliberate app-code change).
//
// USAGE
//   node --env-file=.env.local scripts/osm-annotations/load-to-supabase.mjs --state=lagos
//   node --env-file=.env.local scripts/osm-annotations/load-to-supabase.mjs --state=all --dry-run
//
// REQUIRED ENV VARS (put in a .env.local at the repo root — already
// gitignored by the Vite scaffold; Node 20+'s --env-file loads it):
//   SUPABASE_URL=https://ownzoiipqcblyjwfset.supabase.co
//   SUPABASE_SERVICE_ROLE_KEY=<service role key, NOT the anon key>
//
// The service-role key is required (not the anon/publishable key) because
// this bypasses RLS to bulk-insert — get it from Supabase Dashboard →
// Project Settings → API → service_role. NEVER put this key in a
// VITE_-prefixed env var or any client-side file.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';
import { classifyPlace } from '../../src/features/shared/placeCategories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..', '..');
const DATA_DIR = path.join(REPO_ROOT, 'data', 'osm-annotations');

function parseArgs(argv) {
  const args = { state: 'all', dryRun: false, batchSize: 500, limit: null, file: null };
  for (const raw of argv) {
    const [flag, value] = raw.split(/=(.*)/s);
    switch (flag) {
      case '--state': args.state = value; break;
      case '--file': args.file = value; break;
      case '--batch-size': args.batchSize = Number(value); break;
      case '--limit': args.limit = Number(value); break;
      case '--dry-run': args.dryRun = true; break;
      default:
        if (raw.trim()) console.warn(`[load-to-supabase] Ignoring unrecognized flag: ${raw}`);
    }
  }
  return args;
}

function inputFileFor(state, explicitFile) {
  if (explicitFile) return path.isAbsolute(explicitFile) ? explicitFile : path.join(REPO_ROOT, explicitFile);
  if (state === 'all') return path.join(DATA_DIR, 'lagos-ogun.json');
  return path.join(DATA_DIR, `${state}.json`);
}

function toWaypointRow(record) {
  const type = classifyPlace(record.name, record.subtype) || 'landmark';
  const description =
    record.tags?.description ||
    [record.address?.street, record.address?.city].filter(Boolean).join(', ') ||
    null;

  return {
    id: `osm-${record.osmType}-${record.osmId}`,
    name: record.name,
    description,
    type,
    lat: record.lat,
    lng: record.lon,
    source_type: 'osm_import',
    status: 'approved',
  };
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!args.dryRun && (!supabaseUrl || !serviceRoleKey)) {
    console.error(
      '[load-to-supabase] Missing SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY.\n' +
      'Add them to .env.local at the repo root and run with:\n' +
      '  node --env-file=.env.local scripts/osm-annotations/load-to-supabase.mjs'
    );
    process.exit(1);
  }

  const inputFile = inputFileFor(args.state, args.file);
  if (!fs.existsSync(inputFile)) {
    console.error(`[load-to-supabase] Input file not found: ${path.relative(REPO_ROOT, inputFile)}`);
    console.error('Run fetch-osm-annotations.mjs first, or pass --file=<path> explicitly.');
    process.exit(1);
  }

  let records = JSON.parse(fs.readFileSync(inputFile, 'utf-8'));
  if (args.limit) records = records.slice(0, args.limit);

  const rows = records.map(toWaypointRow);
  console.log(`[load-to-supabase] ${rows.length} rows to upsert from ${path.relative(REPO_ROOT, inputFile)}`);

  if (args.dryRun) {
    console.log('[load-to-supabase] --dry-run: sample of first 3 rows:');
    console.log(JSON.stringify(rows.slice(0, 3), null, 2));
    console.log('[load-to-supabase] --dry-run: nothing written to Supabase.');
    return;
  }

  const supabase = createClient(supabaseUrl, serviceRoleKey);

  let inserted = 0;
  for (let i = 0; i < rows.length; i += args.batchSize) {
    const batch = rows.slice(i, i + args.batchSize);
    const { error, count } = await supabase
      .from('waypoints')
      .upsert(batch, { onConflict: 'id', count: 'exact' });

    if (error) {
      console.error(`[load-to-supabase] Batch ${i}-${i + batch.length} failed:`, error.message);
      console.error('Stopping — fix the error above and re-run; already-upserted rows are unaffected (upsert is idempotent).');
      process.exit(1);
    }
    inserted += count ?? batch.length;
    console.log(`[load-to-supabase]   upserted ${Math.min(i + batch.length, rows.length)}/${rows.length}`);
  }

  console.log(`[load-to-supabase] Done — ${inserted} rows upserted into waypoints (source_type='osm_import').`);
  console.log(
    '[load-to-supabase] Reminder: these rows are currently hidden from the map/search by ' +
    "useWaypoints.js's `source_type === 'osm_import'` filter — that's the next step, not done by this script."
  );
}

main().catch((err) => {
  console.error('[load-to-supabase] Fatal error:', err);
  process.exit(1);
});