// ── Back up the whole `place-images` bucket to a local folder ────────────
//
// Read-only: nothing in Supabase is changed or deleted. Safe to re-run — a
// file already on disk with the same size is skipped, so an interrupted run
// resumes where it stopped.
//
//   node scripts/backupPlaceImages.mjs [--dry-run] [--out=./place-images-backup] [--prefix=waypoint/]
//
// --dry-run only lists files and prints the total size (listing costs no
// egress), so you can see how much a real run will download first.
// Downloads DO count toward Supabase egress, once.
//
// Run it from the project root. It reads VITE_SUPABASE_URL and
// VITE_SUPABASE_ANON_KEY from .env.local. (Optional: SUPABASE_SERVICE_ROLE_KEY
// in the terminal if listing is ever blocked. Never commit that key.)

import { createClient } from '@supabase/supabase-js';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import { readFileSync, existsSync } from 'node:fs';
import path from 'node:path';

// Read .env.local / .env from the folder you run this in (values already set
// in the terminal win). Nothing is printed.
for (const f of ['.env.local', '.env']) {
  if (!existsSync(f)) continue;
  for (const line of readFileSync(f, 'utf8').split(/\r?\n/)) {
    const m = /^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/.exec(line);
    if (!m || line.trim().startsWith('#')) continue;
    process.env[m[1]] ??= m[2].replace(/^(['"])(.*)\1$/, '$2');
  }
}

const BUCKET = 'place-images';
const PAGE = 1000;

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=') ?? null;
const DRY_RUN = flag('dry-run');
const OUT = path.resolve(opt('out') ?? './place-images-backup');
const PREFIX = (opt('prefix') ?? '').replace(/^\/+|\/+$/g, '');

// Uses the service role key if you have one. Otherwise falls back to the
// app's own VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY from .env.local: the
// bucket is public, so listing and downloading work with the anon key too.
const url = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL)?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
const key = serviceKey || process.env.VITE_SUPABASE_ANON_KEY?.trim();
if (!url || !key) {
  console.error('No Supabase URL/key found. Put VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local in this folder, or set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY.');
  process.exit(1);
}
console.log(`Using ${serviceKey ? 'service role key' : 'anon key from .env.local'} for ${new URL(url).host}`);
const supabase = createClient(url, key, { auth: { persistSession: false } });

// list() returns one folder level per call and caps each page, so walk
// folders recursively and page through each one.
async function listAll(prefix) {
  const files = [];
  for (let offset = 0; ; offset += PAGE) {
    const { data, error } = await supabase.storage.from(BUCKET).list(prefix, {
      limit: PAGE,
      offset,
      sortBy: { column: 'name', order: 'asc' },
    });
    if (error) throw new Error(`list "${prefix}": ${error.message}`);
    for (const e of data) {
      const p = prefix ? `${prefix}/${e.name}` : e.name;
      if (e.id === null) files.push(...(await listAll(p)));
      else files.push({ path: p, size: e.metadata?.size ?? 0, type: e.metadata?.mimetype ?? null });
    }
    if (data.length < PAGE) break;
  }
  return files;
}

const mb = (n) => (n / 1024 / 1024).toFixed(1);

async function sameSizeOnDisk(file, size) {
  try {
    return (await stat(file)).size === size;
  } catch {
    return false;
  }
}

const files = await listAll(PREFIX);
const total = files.reduce((s, f) => s + f.size, 0);
const big = files.filter((f) => f.size > 900 * 1024);
console.log(`${files.length} files, ${mb(total)} MB total. ${big.length} are over 900 KB (${mb(big.reduce((s, f) => s + f.size, 0))} MB) — those are the uncompressed ones.`);
const folders = {};
for (const f of files) folders[f.path.split('/')[0]] = (folders[f.path.split('/')[0]] ?? 0) + 1;
console.log('By folder:', folders);

if (DRY_RUN) {
  console.log('Dry run — nothing downloaded.');
  process.exit(0);
}

await mkdir(OUT, { recursive: true });
let done = 0, skipped = 0, failed = 0;
for (const f of files) {
  const dest = path.join(OUT, f.path);
  if (f.size && (await sameSizeOnDisk(dest, f.size))) {
    skipped++;
    continue;
  }
  let bytes;
  if (serviceKey) {
    const { data, error } = await supabase.storage.from(BUCKET).download(f.path);
    if (error) {
      console.error(`✗ ${f.path}: ${error.message}`);
      failed++;
      continue;
    }
    bytes = Buffer.from(await data.arrayBuffer());
  } else {
    // Public bucket: plain download from the public URL.
    const res = await fetch(supabase.storage.from(BUCKET).getPublicUrl(f.path).data.publicUrl);
    if (!res.ok) {
      console.error(`✗ ${f.path}: HTTP ${res.status}`);
      failed++;
      continue;
    }
    bytes = Buffer.from(await res.arrayBuffer());
  }
  await mkdir(path.dirname(dest), { recursive: true });
  await writeFile(dest, bytes);
  done++;
  if (done % 25 === 0) console.log(`  …${done} downloaded`);
}

await writeFile(path.join(OUT, '_manifest.json'), JSON.stringify({ takenAt: new Date().toISOString(), files }, null, 2));
console.log(`Done: ${done} downloaded, ${skipped} already on disk, ${failed} failed. Backup in ${OUT}`);
if (failed) process.exit(2);
