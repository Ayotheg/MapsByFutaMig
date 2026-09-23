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

const VERSION = 'v2'; // bump to drop every previously cached tile/photo (v1 may hold CARTO "API KEY REQUIRED" tiles)
const TILE_CACHE = `mbf-tiles-${VERSION}`;
const PHOTO_CACHE = `mbf-photos-${VERSION}`;

const MAX_TILES = 600; // ~10–25 KB each → a few MB (estimate, not measured)
const MAX_PHOTOS = 40;
// Photos above this are passed through uncached. Full-size iPhone originals
// (multi-MB) would eat the quota; once the backend serves resized variants
// they fit under this and start being cached automatically.
const MAX_PHOTO_BYTES = 1.5 * 1024 * 1024;
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

function isPhoto(url) {
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
async function trim(cache, max) {
  const keys = await cache.keys();
  for (let i = 0; i < keys.length - max; i++) await cache.delete(keys[i]);
}

// Store a CORS response with real size + a timestamp header. Returns
// without storing if it's too big or has no reliable size.
async function store(cache, key, res, max, maxBytes) {
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
  const m = /max-age=(\d+)/i.exec(res.headers.get('cache-control') || '');
  headers.set(TTL_MS, String(m ? Number(m[1]) * 1000 : DEFAULT_TILE_TTL_MS));
  await cache.put(key, new Response(body, { status: res.status, statusText: res.statusText, headers }));
  await trim(cache, max);
}

// CORS-mode fetch, optionally abandoned after `ms`.
async function corsFetch(url, ms) {
  const ctrl = ms ? new AbortController() : null;
  const timer = ms ? setTimeout(() => ctrl.abort(), ms) : null;
  try {
    return await fetch(url, { mode: 'cors', credentials: 'omit', signal: ctrl ? ctrl.signal : undefined });
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
    res = await corsFetch(key, 0);
  } catch {
    return fetch(req);
  }
  if (!res.ok) return res;
  // Decide from the header BEFORE cloning: an unread clone of a multi-MB
  // body would just sit buffered in memory.
  const len = Number(res.headers.get('content-length'));
  if (len > 0 && len <= MAX_PHOTO_BYTES) {
    event.waitUntil(store(cache, key, res.clone(), MAX_PHOTOS, MAX_PHOTO_BYTES).catch(() => {}));
  }
  return res;
}
