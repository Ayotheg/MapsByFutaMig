// ── One-off: fix already-uploaded photos in Supabase Storage ────────────
//
// This does NOT run as part of the app. It's a maintenance script for you
// to run once, locally, against the live `place-images` bucket — Claude's
// sandbox can't reach *.supabase.co directly, so this couldn't be verified
// against your real project or run for you.
//
// What it does, per file in the bucket:
//   1. Downloads it.
//   2. sharp's `.rotate()` with no argument reads any remaining EXIF
//      `Orientation` tag and bakes it into the pixels, then drops the tag
//      — same idea as imageCompression.js's `createImageBitmap(file,
//      { imageOrientation: 'from-image' })` on the client. This ONLY helps
//      if the file still has its EXIF tag. If whatever compressed these
//      already stripped EXIF without applying it, the tag is gone and
//      there's no metadata left to auto-correct from — see --rotate/--flip
//      below for that case.
//   3. Resizes to fit within 1600px on the long side and re-encodes as
//      JPEG, stepping quality down until it's under ~800KB — matching
//      imageCompression.js's client-side budget, so old and new uploads
//      end up consistent.
//   4. Re-uploads to the SAME storage path (upsert), so nothing in the
//      `waypoint_images` / `segment_images` tables needs to change.
//
// ── If images are STILL flipped after running this plain pass ───────────
// That means the EXIF tag is already gone and every affected photo needs
// the same manual correction. Once you've confirmed by eye what that
// correction is (e.g. "everything is rotated 90° clockwise" or "everything
// is mirrored left-right"), re-run with:
//   --rotate=90        (0 | 90 | 180 | 270, applied AFTER the auto step)
//   --flip-horizontal  (mirror left-right)
//   --flip-vertical    (mirror top-to-bottom)
// These apply to EVERY file the script touches, so only use them once
// you're sure the whole bucket needs the same fix — run --dry-run and
// spot-check a few files first (open the printed paths' public URLs).
//
// ── Setup ─────────────────────────────────────────────────────────────
//   npm install --save-dev sharp
//   SUPABASE_URL=https://ownnzoiipqcblyjwfset.supabase.co \
//   SUPABASE_SERVICE_ROLE_KEY=<service role key, NOT the anon key — \
//     this needs to read/write every file regardless of RLS> \
//   node scripts/fixExistingStorageImages.mjs [--dry-run] [--limit=20] \
//     [--prefix=waypoint/] [--rotate=90] [--flip-horizontal] [--flip-vertical]
//
// The service role key is sensitive — grab it from Supabase dashboard →
// Project Settings → API for this one run, and don't commit it anywhere.

import { createClient } from '@supabase/supabase-js';
import sharp from 'sharp';

const BUCKET = 'place-images';
const MAX_DIMENSION = 1600;
const TARGET_BYTES = 800 * 1024;
const MIN_QUALITY = 50;

const args = process.argv.slice(2);
const flag = (name) => args.includes(`--${name}`);
const opt = (name) => {
  const hit = args.find((a) => a.startsWith(`--${name}=`));
  return hit ? hit.split('=').slice(1).join('=') : null;
};

const DRY_RUN = flag('dry-run');
const LIMIT = opt('limit') ? parseInt(opt('limit'), 10) : Infinity;
const PREFIX = opt('prefix') ?? '';
const MANUAL_ROTATE = opt('rotate') ? parseInt(opt('rotate'), 10) : 0;
const FLIP_H = flag('flip-horizontal');
const FLIP_V = flag('flip-vertical');

const supabaseUrl = process.env.SUPABASE_URL?.trim();
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY?.trim();
if (!supabaseUrl || !serviceKey) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY env vars first. See the comment at the top of this file.');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceKey);

/** Storage's `list()` only returns one folder level, so this walks
 * `kind/entityId/...` (the two-level layout `uploadImage()` writes to)
 * recursively rather than assuming a fixed depth. */
async function listAllFiles(prefix) {
  const { data, error } = await supabase.storage.from(BUCKET).list(prefix, { limit: 1000 });
  if (error) throw error;
  const files = [];
  for (const entry of data) {
    const path = prefix ? `${prefix}/${entry.name}` : entry.name;
    if (entry.id === null) {
      // No `id` means it's a folder, not a file — recurse into it.
      files.push(...(await listAllFiles(path)));
    } else {
      files.push(path);
    }
  }
  return files;
}

async function processOne(path) {
  const { data: blob, error: dlError } = await supabase.storage.from(BUCKET).download(path);
  if (dlError) {
    console.error(`  ✗ download failed: ${dlError.message}`);
    return false;
  }
  const inputBuffer = Buffer.from(await blob.arrayBuffer());

  let pipeline = sharp(inputBuffer).rotate(); // auto-applies EXIF orientation if present, then strips it
  if (MANUAL_ROTATE) pipeline = pipeline.rotate(MANUAL_ROTATE);
  if (FLIP_H) pipeline = pipeline.flop(); // sharp: flop = horizontal mirror
  if (FLIP_V) pipeline = pipeline.flip(); // sharp: flip = vertical mirror
  pipeline = pipeline.resize({ width: MAX_DIMENSION, height: MAX_DIMENSION, fit: 'inside', withoutEnlargement: true });

  let quality = 82;
  let outBuffer = await pipeline.clone().jpeg({ quality }).toBuffer();
  while (outBuffer.length > TARGET_BYTES && quality > MIN_QUALITY) {
    quality -= 10;
    outBuffer = await pipeline.clone().jpeg({ quality }).toBuffer();
  }

  console.log(`  ${(inputBuffer.length / 1024).toFixed(0)}KB -> ${(outBuffer.length / 1024).toFixed(0)}KB`);

  if (DRY_RUN) return true;

  const { error: upError } = await supabase.storage
    .from(BUCKET)
    .upload(path, outBuffer, { contentType: 'image/jpeg', upsert: true });
  if (upError) {
    console.error(`  ✗ upload failed: ${upError.message}`);
    return false;
  }
  return true;
}

async function main() {
  console.log(`Listing files under "${PREFIX || '(bucket root)'}"...`);
  const allFiles = await listAllFiles(PREFIX);
  const files = allFiles.slice(0, LIMIT);
  console.log(`Found ${allFiles.length} file(s)${LIMIT < allFiles.length ? `, processing first ${LIMIT}` : ''}.${DRY_RUN ? ' [DRY RUN — nothing will be uploaded]' : ''}`);

  let ok = 0;
  let fail = 0;
  for (const path of files) {
    console.log(path);
    const success = await processOne(path);
    if (success) ok += 1;
    else fail += 1;
  }
  console.log(`\nDone. ${ok} succeeded, ${fail} failed.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
