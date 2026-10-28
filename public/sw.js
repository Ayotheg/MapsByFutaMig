/* Maps By FUTA — service worker.
 *
 * Scope is deliberately narrow: it caches ONLY map tiles and place photos
 * that a person has actually viewed. It does not cache the app shell, JS,
 * HTML or API calls (Supabase REST/auth) — so a deploy is never stuck
 * behind a stale bundle, and data freshness is untouched.
 *
 * Why: tiles and photos are the slow, network-bound parts of the map. A
 * tile seen once is served from the device next time (instant, offline-
 * capable, zero data). Nothing is prefetched, so caching never costs a
 * user data they didn't already spend.
 *
 * Safety limits (all below): entry caps + oldest-first eviction, 30-day
 * tile expiry, a per-photo size ceiling, versioned cache names.
 *
 * CORS note: cross-origin <img> loads are "no-cors" and come back as
 * OPAQUE responses, which Chrome pads to several MB each against the
 * storage quota regardless of real size. So we re-request in CORS mode
 * (tile hosts and Supabase Storage send Access-Control-Allow-Origin) to
 * store real-size responses. If a host refuses CORS, we fall back to the
 * browser's normal request and simply don't cache it.
 */

const VERSION = 'v3'; // bump to drop every previously cached tile/photo (v3: caps lowered, frees the old v2 caches on every device)
const TILE_CACHE = `mbf-tiles-${VERSION}`;
const PHOTO_CACHE = `mbf-photos-${VERSION}`;

// Kept small on purpose: 600 tiles + 40 full-size photos added up to ~17 MB
// on a phone (seen in Safari's Website Data). These caps hold it to a few MB.
const MAX_TILES = 300; // ~10–25 KB each → ~3–7 MB
const MAX_PHOTOS = 25;
// Photos above this are passed through uncached. Full-size iPhone originals
// (multi-MB) would eat the quota; compressed uploads (~800 KB) fit.
const MAX_PHOTO_BYTES = 1024 * 1024;
// And all cached photos together stay under this, oldest dropped first.
// Through ImageKit (IMAGE_PROXY_URL) a photo is ~30–150 KB, so this rarely
// bites; straight from Supabase it stops 25 big photos adding up to ~20 MB.
const MAX_PHOTO_CACHE_BYTES = 5 * 1024 * 1024;
const BYTES = 'x-sw-bytes';
// Tile freshness follows the server's Cache-Control max-age (OSM's tile
// policy asks clients to honour caching headers for re-visits), falling
// back to 7 days when none is readable. Past that, a stale tile is still
// served instantly while a fresh copy is fetched in the background — up to
// MAX_STALE_MS, after which the network is required.
const DEFAULT_TILE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const MAX_STALE_MS = 30 * 24 * 60 * 60 * 1000;

const CACHED_AT = 'x-sw-cached-at';
const TTL_MS = 'x-sw-ttl-ms';

const TILE_HOSTS = [
  'tile.openstreetmap.org', // Light
  'tile.openstreetmap.fr', // Dark (HOT)
  'tile.opentopomap.org', // Terrain
  'server.arcgisonline.com', // Satellite
];

function isTile(url) {
  return TILE_HOSTS.some((h) => url.hostname === h || url.hostname.endsWith('.' + h));
}

// ImageKit proxy in front of Supabase Storage (IMAGE_PROXY_URL). Only this
// app's own ImageKit account, not any image on ik.imagekit.io. Change it
// here too if IMAGE_PROXY_URL ever points at a different account.
const PHOTO_PROXY_HOST = 'ik.imagekit.io';
const PHOTO_PROXY_PATH = '/pk5x5zal3/';

function isPhoto(url) {
  if (url.hostname === PHOTO_PROXY_HOST) return url.pathname.startsWith(PHOTO_PROXY_PATH);
  return (
    url.hostname.endsWith('.supabase.co') &&
    /\/storage\/v1\/(object|render\/image)\/public\/place-images\//.test(url.pathname)
  );
}

self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const keep = new Set([TILE_CACHE, PHOTO_CACHE]);
      const names = await caches.keys();
      await Promise.all(names.filter((n) => n.startsWith('mbf-') && !keep.has(n)).map((n) => caches.delete(n)));
      await self.clients.claim();
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Only plain GET image loads — never API calls, never range requests.
  if (req.method !== 'GET' || req.destination !== 'image' || req.headers.has('range')) return;
  const url = new URL(req.url);
  if (isTile(url)) event.respondWith(handleTile(event, req));
  else if (isPhoto(url)) event.respondWith(handlePhoto(event, req));
});

// Oldest-first eviction. Cache.keys() is in insertion order, and re-putting
// a URL moves it to the end, so this is "least recently (re)stored" first.
async function trim(cache, max, maxTotalBytes) {
  const keys = await cache.keys();
  let start = 0;
  for (; start < keys.length - max; start++) await cache.delete(keys[start]);
  if (!maxTotalBytes) return;
  // Then drop oldest until the rest fit the total budget.
  const sizes = [];
  for (let i = start; i < keys.length; i++) {
    const r = await cache.match(keys[i]);
    sizes.push(Number(r?.headers.get(BYTES)) || 0);
  }
  let total = sizes.reduce((a, b) => a + b, 0);
  for (let i = 0; total > maxTotalBytes && i < sizes.length - 1; i++) {
    await cache.delete(keys[start + i]);
    total -= sizes[i];
  }
}

// Store a CORS response with real size + a timestamp header. Returns
// without storing if it's too big or has no reliable size.
async function store(cache, key, res, max, maxBytes, maxTotalBytes) {
  if (maxBytes) {
    const len = Number(res.headers.get('content-length'));
    if (!len || len > maxBytes) return; // unknown or too big: don't even read the body
  }
  const body = await res.blob();
  if (maxBytes && body.size > maxBytes) return;
  const headers = new Headers(res.headers);
  headers.delete('content-encoding'); // body is already decoded
  headers.delete('content-length');
  headers.set(CACHED_AT, String(Date.now()));
  headers.set(BYTES, String(body.size));
  const m = /max-age=(\d+)/i.exec(res.headers.get('cache-control') || '');
  headers.set(TTL_MS, String(m ? Number(m[1]) * 1000 : DEFAULT_TILE_TTL_MS));
  await cache.put(key, new Response(body, { status: res.status, statusText: res.statusText, headers }));
  await trim(cache, max, maxTotalBytes);
}

// CORS-mode fetch, optionally abandoned after `ms`.
async function corsFetch(url, ms, headers) {
  const ctrl = ms ? new AbortController() : null;
  const timer = ms ? setTimeout(() => ctrl.abort(), ms) : null;
  try {
    return await fetch(url, { mode: 'cors', credentials: 'omit', headers, signal: ctrl ? ctrl.signal : undefined });
  } finally {
    if (timer) clearTimeout(timer);
  }
}

async function refreshTile(cache, key) {
  const res = await corsFetch(key, 0);
  if (res.ok) await store(cache, key, res, MAX_TILES, 0);
}

async function handleTile(event, req) {
  const cache = await caches.open(TILE_CACHE);
  const key = req.url;
  const cached = await cache.match(key);
  if (cached) {
    const age = Date.now() - Number(cached.headers.get(CACHED_AT) || 0);
    const rawTtl = cached.headers.get(TTL_MS); // may legitimately be 0 (max-age=0)
    const ttl = rawTtl === null ? DEFAULT_TILE_TTL_MS : Number(rawTtl);
    if (age < ttl) return cached;
    if (age < MAX_STALE_MS) {
      // Stale but usable: show it now, refresh quietly for next time.
      event.waitUntil(refreshTile(cache, key).catch(() => {}));
      return cached;
    }
  }

  let res;
  try {
    res = await corsFetch(key, 0);
  } catch {
    // Network down. Try the browser's own no-cors request (covers hosts
    // without CORS); it just won't be cached.
    return cached || fetch(req);
  }
  // Non-2xx (e.g. a 403/429 block tile): pass through untouched, never cache.
  if (!res.ok) return cached || res;
  event.waitUntil(store(cache, key, res.clone(), MAX_TILES, 0).catch(() => {}));
  return res;
}

async function handlePhoto(event, req) {
  const cache = await caches.open(PHOTO_CACHE);
  const key = req.url;
  // Photo URLs are unique per upload (path includes a timestamp), so a
  // cached copy never goes stale — no expiry check.
  const cached = await cache.match(key);
  if (cached) return cached;

  let res;
  try {
    // Pass on the browser's Accept header: ImageKit's f-auto picks WebP/AVIF
    // from it, and a bare fetch would get (and cache) the bigger JPEG.
    const accept = req.headers.get('accept');
    res = await corsFetch(key, 0, accept ? { Accept: accept } : undefined);
  } catch {
    return fetch(req);
  }
  if (!res.ok) return res;
  // Decide from the header BEFORE cloning: an unread clone of a multi-MB
  // body would just sit buffered in memory.
  const len = Number(res.headers.get('content-length'));
  if (len > 0 && len <= MAX_PHOTO_BYTES) {
    event.waitUntil(
      store(cache, key, res.clone(), MAX_PHOTOS, MAX_PHOTO_BYTES, MAX_PHOTO_CACHE_BYTES).catch(() => {})
    );
  }
  return res;
}
