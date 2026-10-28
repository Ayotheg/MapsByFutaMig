// ── Copy a local backup of `place-images` into Cloudflare R2 ─────────────
//
// Run scripts/backupPlaceImages.mjs first. This reads that folder, so it
// never touches Supabase. Same paths in R2 as in Supabase, so no database
// row changes. Safe to re-run: a key already in R2 with the same size is
// skipped.
//
//   R2_ACCOUNT_ID=… R2_ACCESS_KEY_ID=… R2_SECRET_ACCESS_KEY=… R2_BUCKET=… \
//   node scripts/migrateImagesToR2.mjs [--dir=./place-images-backup] [--dry-run] [--no-recompress]
//
// Photos over ~900 KB (uploaded before the app compressed on upload) are
// shrunk to the same budget as lib/imageCompression.js — 1600 px, JPEG,
// under ~800 KB — with EXIF orientation baked into the pixels. Pass
// --no-recompress to copy every file byte-for-byte instead. GIFs are never
// re-encoded (it would flatten animation).
//
// Every object is stored with a one-year immutable Cache-Control, which is
// what keeps Cloudflare's edge and each phone from re-downloading it.

import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';
import { readdir, readFile, stat } from 'node:fs/promises';
import path from 'node:path';

const MAX_DIMENSION = 1600;
const TARGET_BYTES = 800 * 1024;
const RECOMPRESS_ABOVE = 900 * 1024;
const MIN_QUALITY = 50;
const CACHE_CONTROL = 'public, max-age=31536000, immutable';
const TYPES = { '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp', '.gif': 'image/gif' };

const args = process.argv.slice(2);
const flag = (n) => args.includes(`--${n}`);
const opt = (n) => args.find((a) => a.startsWith(`--${n}=`))?.split('=').slice(1).join('=') ?? null;
const DRY_RUN = flag('dry-run');
const RECOMPRESS = !flag('no-recompress');
const DIR = path.resolve(opt('dir') ?? './place-images-backup');

const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = process.env;
if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) {
  console.error('Set R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY and R2_BUCKET first.');
  process.exit(1);
}
const r2 = new AwsClient({ accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY, service: 's3', region: 'auto' });
// R2_ENDPOINT is only for testing against a local stand-in server.
const ENDPOINT = process.env.R2_ENDPOINT || `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`;
const objectUrl = (key) => `${ENDPOINT}/${R2_BUCKET}/${key.split('/').map(encodeURIComponent).join('/')}`;

async function walk(dir, prefix = '') {
  const out = [];
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const rel = prefix ? `${prefix}/${e.name}` : e.name;
    if (e.isDirectory()) out.push(...(await walk(path.join(dir, e.name), rel)));
    else if (e.name !== '_manifest.json') out.push(rel);
  }
  return out;
}

async function shrink(buffer) {
  const pipeline = sharp(buffer).rotate().resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });
  let quality = 82;
  let out = await pipeline.clone().jpeg({ quality }).toBuffer();
  while (out.length > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 10;
    out = await pipeline.clone().jpeg({ quality }).toBuffer();
  }
  return out;
}

async function remoteSize(key) {
  const res = await r2.fetch(objectUrl(key), { method: 'HEAD' });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`HEAD ${key}: ${res.status}`);
  return Number(res.headers.get('content-length'));
}

const keys = await walk(DIR);
console.log(`${keys.length} files in ${DIR}${DRY_RUN ? ' [DRY RUN — nothing uploaded]' : ''}`);

let uploaded = 0, skipped = 0, failed = 0, before = 0, after = 0;
for (const key of keys) {
  const ext = path.extname(key).toLowerCase();
  const type = TYPES[ext];
  if (!type) {
    console.warn(`  – ${key}: unsupported type, skipped`);
    skipped++;
    continue;
  }
  try {
    let body = await readFile(path.join(DIR, key));
    let contentType = type;
    before += body.length;
    if (RECOMPRESS && type !== 'image/gif' && body.length > RECOMPRESS_ABOVE) {
      const small = await shrink(body);
      if (small.length < body.length) {
        console.log(`  ${key}: ${(body.length / 1024).toFixed(0)} KB → ${(small.length / 1024).toFixed(0)} KB`);
        body = small;
        contentType = 'image/jpeg'; // bytes are JPEG whatever the extension says
      }
    }
    after += body.length;
    const have = await remoteSize(key);
    if (have === body.length) {
      skipped++;
      continue;
    }
    if (DRY_RUN) continue;
    const res = await r2.fetch(objectUrl(key), {
      method: 'PUT',
      headers: { 'Content-Type': contentType, 'Cache-Control': CACHE_CONTROL },
      body,
    });
    if (!res.ok) throw new Error(`PUT ${res.status} ${await res.text()}`);
    uploaded++;
    if (uploaded % 25 === 0) console.log(`  …${uploaded} uploaded`);
  } catch (e) {
    console.error(`✗ ${key}: ${e.message}`);
    failed++;
  }
}

console.log(`Done: ${uploaded} uploaded, ${skipped} skipped, ${failed} failed. Size ${(before / 1048576).toFixed(1)} MB → ${(after / 1048576).toFixed(1)} MB.`);

// Verify: every local file must now exist in R2.
if (!DRY_RUN) {
  let missing = 0;
  for (const key of keys) {
    if (!TYPES[path.extname(key).toLowerCase()]) continue;
    if ((await remoteSize(key)) === null) {
      console.error(`MISSING in R2: ${key}`);
      missing++;
    }
  }
  console.log(missing ? `⚠ ${missing} file(s) missing — re-run before switching the app over.` : '✓ Verified: every file is in R2. Safe to switch the app over.');
  if (missing || failed) process.exit(2);
}
