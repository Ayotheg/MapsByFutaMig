// ── Client-side image compression (pre-upload) ──────────────────────────
//
// Why this exists: every photo upload path in the app (admin edit modal,
// KML-import photo attach, student "suggest a place" submissions, business
// promotion photos) funnels through `uploadImage()` in
// `features/admin/adminSave.js`, which — until now — sent the raw
// `File` straight to Supabase Storage. Phone-camera photos routinely land
// at 3-8MB, which is what made a later external re-compression pass over
// the bucket seem necessary in the first place. Fixing it at the source
// (here) means every future upload already arrives small, so nothing else
// downstream needs to touch these images again.
//
// Why some images "flipped": phone photos taken with the camera rotated
// are stored as landscape pixel data plus an EXIF `Orientation` tag that
// tells a viewer to rotate/mirror them for display. A plain <img> tag (and
// most image-processing/resizing tools) honor that tag, so the photo
// looks right. But a naive re-encode — including some server-side
// resize/compress passes — can drop the EXIF block without baking the
// rotation into the actual pixels, so the now-metadata-less image renders
// in its raw sensor orientation: a horizontal photo can come out rotated
// or mirrored. `createImageBitmap(file, { imageOrientation: 'from-image' })`
// below decodes the photo WITH that tag applied, and then we draw it to a
// plain canvas and re-encode — so the orientation is baked into the pixels
// themselves and the output has no EXIF block left to lose. Any further
// resize/compression pass downstream (including one run on Supabase)
// can't un-rotate what's no longer tagged, only what's already correct.

const MAX_DIMENSION = 1600; // px, longest side — plenty for a card/lightbox photo
const TARGET_BYTES = 800 * 1024; // aim comfortably under the 1MB ask
const MIN_QUALITY = 0.5;
const MIN_DIMENSION = 640; // don't shrink below this even to hit the target
const OUTPUT_TYPE = 'image/jpeg'; // universal support, best size/quality ratio for photos

// Formats we deliberately leave untouched:
// - image/svg+xml: vector, nothing to rasterize/shrink
// - image/gif: re-encoding to canvas would flatten an animated GIF to one frame
const SKIP_TYPES = new Set(['image/svg+xml', 'image/gif']);

function loadViaImageElement(file) {
  const url = URL.createObjectURL(file);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.decoding = 'async';
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.src = url;
  });
}

/** Decodes `file` into something drawable, with EXIF orientation applied
 * to the actual pixels. Prefers `createImageBitmap` (supported in every
 * current evergreen browser) since its `imageOrientation: 'from-image'`
 * option is the explicit, spec-guaranteed way to get this; falls back to
 * a plain <img> element (modern browsers already auto-apply EXIF
 * orientation when decoding for canvas use, so this fallback is still
 * safe on the handful of engines without createImageBitmap's option). */
async function decodeSource(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file, { imageOrientation: 'from-image' });
    } catch {
      // Some engines support createImageBitmap but reject the option object
      // or the specific file — fall through to the <img> path below.
    }
  }
  return loadViaImageElement(file);
}

function sourceDimensions(source) {
  return {
    w: source.width ?? source.naturalWidth,
    h: source.height ?? source.naturalHeight,
  };
}

function drawToCanvas(source, targetLongSide) {
  const { w, h } = sourceDimensions(source);
  const scale = Math.min(1, targetLongSide / Math.max(w, h));
  const outW = Math.max(1, Math.round(w * scale));
  const outH = Math.max(1, Math.round(h * scale));
  const canvas = document.createElement('canvas');
  canvas.width = outW;
  canvas.height = outH;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(source, 0, 0, outW, outH);
  return canvas;
}

function canvasToBlob(canvas, type, quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas.toBlob returned null'))), type, quality);
  });
}

function withJpegName(originalName) {
  const base = originalName.replace(/\.[^./]+$/, '') || 'photo';
  return `${base}.jpg`;
}

/**
 * Compresses an image `File` for upload. Bakes in EXIF orientation, caps
 * the longest side at `maxDimension`, and steps quality (then dimensions)
 * down until the result is under `targetBytes` or the floors are hit.
 *
 * Never throws on a decode failure — falls back to the original file so a
 * weird/corrupt image never blocks the person's upload; Storage still gets
 * something, it's just not compressed in that one edge case.
 */
export async function compressImageFile(file, opts = {}) {
  if (!file?.type?.startsWith('image/') || SKIP_TYPES.has(file.type)) {
    return file;
  }

  const maxDimension = opts.maxDimension ?? MAX_DIMENSION;
  const targetBytes = opts.targetBytes ?? TARGET_BYTES;

  let source;
  try {
    source = await decodeSource(file);
  } catch {
    return file;
  }

  try {
    let dim = maxDimension;
    let blob;

    // Outer loop: shrink dimensions if quality alone can't hit the target.
    // Inner loop: step quality down first — cheaper than re-drawing the canvas.
    // eslint-disable-next-line no-constant-condition
    while (true) {
      const canvas = drawToCanvas(source, dim);
      let quality = 0.82;
      blob = await canvasToBlob(canvas, OUTPUT_TYPE, quality);

      while (blob.size > targetBytes && quality > MIN_QUALITY) {
        quality = Math.max(MIN_QUALITY, quality - 0.1);
        blob = await canvasToBlob(canvas, OUTPUT_TYPE, quality);
      }

      if (blob.size <= targetBytes || dim <= MIN_DIMENSION) break;
      dim = Math.max(MIN_DIMENSION, Math.round(dim * 0.85));
    }

    // If the original was already smaller than our first-pass encode
    // (rare — e.g. a very simple/plain photo), keep whichever is smaller.
    if (blob.size >= file.size && sourceDimensions(source).w <= maxDimension) {
      return file;
    }

    return new File([blob], withJpegName(file.name), {
      type: OUTPUT_TYPE,
      lastModified: Date.now(),
    });
  } finally {
    source.close?.(); // release ImageBitmap memory; no-op for <img> fallback
  }
}

/** Compresses a batch of files in sequence (kept simple/predictable rather
 * than parallel — uploads are already sequential in every caller). */
export async function compressImageFiles(files, opts) {
  const out = [];
  for (const file of files) {
    out.push(await compressImageFile(file, opts));
  }
  return out;
}
