// ── supabase/functions/_shared/publicApi.ts ──────────────────────────────
//
// Pure rules for the Public API (no Deno, no database), so
// scripts/publicApi.test.mjs can test them in Node. Plain JavaScript on
// purpose: the test copies this file to .mjs and imports it.

export const KEY_PREFIX = 'fk_live_';

// The ONLY columns the API may select and return. They are columns of the
// api_public_* views (supabase/public_api.sql), never of the base tables.
export const PLACE_COLUMNS = 'id, name, description, type, area, lat, lng, rating, review_count, image_count';
export const IMAGE_COLUMNS = 'id, place_id, storage_path, position';
export const CATEGORY_COLUMNS = 'type, place_count';
export const USAGE_COLUMNS = 'endpoint, status_code, credits_charged, response_ms, created_at';

// Used only if a row is missing from api_credit_costs.
export const DEFAULT_COSTS = {
  'GET /v1/places': 1,
  'GET /v1/places/:id': 1,
  'GET /v1/places/nearby': 1,
  'GET /v1/categories': 1,
  'GET /v1/places/:id/images': 5,
  'GET /v1/usage': 0,
};

export const MAX_LIMIT = 50;
export const DEFAULT_LIMIT = 20;
export const MAX_OFFSET = 10000;
export const MAX_RADIUS_M = 5000;
export const DEFAULT_RADIUS_M = 500;

// Uploads for places live under these folders of the public place-images
// bucket. Promotion and event uploads share the bucket and must never be
// handed out.
const IMAGE_PATH = /^(waypoint|waypoints|waypoint_images)\//;
const IMAGE_BUCKET = 'place-images';
// Same sizes the app uses (src/lib/supabase.js).
const IMAGE_TRANSFORM = 'tr=w-900,c-at_max,q-75,f-auto';
const IMAGE_FULL_TRANSFORM = 'tr=w-1600,c-at_max,q-80,f-auto';

const PLACE_ID = /^[A-Za-z0-9_-]{1,64}$/;
const TYPE = /^[a-z0-9_]{1,40}$/;

// ── Keys ─────────────────────────────────────────────────────────────────

export async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(String(text));
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

export function isKeyFormat(key) {
  return typeof key === 'string' && /^fk_live_[A-Za-z0-9]{32,64}$/.test(key);
}

/** For logs: never the full key. */
export function maskKey(key) {
  if (typeof key !== 'string' || !key) return '(none)';
  return isKeyFormat(key) ? `${key.slice(0, 12)}…` : '(malformed)';
}

// ── Routing and cost ─────────────────────────────────────────────────────

/** Path as the function sees it (".../public-api/v1/places") → route. */
export function matchRoute(pathname) {
  // Everything up to the function's own name is hosting prefix
  // ("/functions/v1/public-api"), which has a /v1 of its own.
  const path = String(pathname || '');
  const own = path.lastIndexOf('/public-api/');
  const rest = own === -1 ? path : path.slice(own + '/public-api'.length);
  const parts = rest.split('/').filter(Boolean); // ['v1', ...]
  if (parts[0] !== 'v1') return null;
  const [, a, b, c] = parts;
  if (parts.length === 2 && a === 'places') return { pattern: 'GET /v1/places', name: 'places.list' };
  if (parts.length === 2 && a === 'categories') return { pattern: 'GET /v1/categories', name: 'categories' };
  if (parts.length === 2 && a === 'usage') return { pattern: 'GET /v1/usage', name: 'usage' };
  if (parts.length === 3 && a === 'places' && b === 'nearby') {
    return { pattern: 'GET /v1/places/nearby', name: 'places.nearby' };
  }
  if (parts.length === 3 && a === 'places') {
    return { pattern: 'GET /v1/places/:id', name: 'places.detail', id: safeDecode(b) };
  }
  if (parts.length === 4 && a === 'places' && c === 'images') {
    return { pattern: 'GET /v1/places/:id/images', name: 'places.images', id: safeDecode(b) };
  }
  return null;
}

function safeDecode(part) {
  try {
    return decodeURIComponent(part);
  } catch {
    return part;
  }
}

/** Credits for a route: the database's price list first, then the defaults. */
export function costFor(pattern, costs) {
  // Checking your own balance is always free, whatever the price list says.
  if (pattern === 'GET /v1/usage') return 0;
  const fromDb = costs ? Number(costs[pattern]) : NaN;
  if (Number.isInteger(fromDb) && fromDb >= 0) return fromDb;
  return DEFAULT_COSTS[pattern] ?? 1;
}

/** Only a 2xx that returned data is charged. */
export function shouldCharge(status, cost) {
  return status >= 200 && status < 300 && cost > 0;
}

// ── Query params ─────────────────────────────────────────────────────────
// Each parser returns { value } or { error: 'message' }.

function parseIntParam(raw, name, { min, max, fallback }) {
  if (raw === null || raw === undefined || raw === '') return { value: fallback };
  if (!/^\d+$/.test(raw)) return { error: `${name} must be a whole number.` };
  const n = Number(raw);
  if (n < min || n > max) return { error: `${name} must be between ${min} and ${max}.` };
  return { value: n };
}

function parseType(raw) {
  if (raw === null || raw === undefined || raw === '') return { value: null };
  const type = String(raw).trim().toLowerCase();
  if (!TYPE.test(type)) return { error: 'type must be a category id such as "hostel" (see /v1/categories).' };
  return { value: type };
}

export function isPlaceId(id) {
  return typeof id === 'string' && PLACE_ID.test(id);
}

export function parseListParams(params) {
  const limit = parseIntParam(params.get('limit'), 'limit', { min: 1, max: MAX_LIMIT, fallback: DEFAULT_LIMIT });
  if (limit.error) return limit;
  const offset = parseIntParam(params.get('offset'), 'offset', { min: 0, max: MAX_OFFSET, fallback: 0 });
  if (offset.error) return offset;
  const type = parseType(params.get('type'));
  if (type.error) return type;
  const q = (params.get('q') || '').trim();
  if (q.length > 80) return { error: 'q must be 80 characters or fewer.' };
  // Postgres rejects NUL and friends; that is the caller's mistake, not ours.
  // eslint-disable-next-line no-control-regex
  if (/[\u0000-\u001f\u007f]/.test(q)) return { error: 'q contains characters that are not allowed.' };
  return { value: { limit: limit.value, offset: offset.value, type: type.value, q: q || null } };
}

export function parseNearbyParams(params) {
  const lat = parseCoord(params.get('lat'), 'lat', 90);
  if (lat.error) return lat;
  const lng = parseCoord(params.get('lng'), 'lng', 180);
  if (lng.error) return lng;
  const radius = parseIntParam(params.get('radius_m'), 'radius_m', {
    min: 1,
    max: MAX_RADIUS_M,
    fallback: DEFAULT_RADIUS_M,
  });
  if (radius.error) return radius;
  const limit = parseIntParam(params.get('limit'), 'limit', { min: 1, max: MAX_LIMIT, fallback: DEFAULT_LIMIT });
  if (limit.error) return limit;
  const type = parseType(params.get('type'));
  if (type.error) return type;
  return { value: { lat: lat.value, lng: lng.value, radius_m: radius.value, limit: limit.value, type: type.value } };
}

function parseCoord(raw, name, max) {
  if (raw === null || raw === undefined || raw === '') return { error: `${name} is required.` };
  if (!/^-?\d+(\.\d+)?$/.test(raw)) return { error: `${name} must be a number.` };
  const n = Number(raw);
  if (Math.abs(n) > max) return { error: `${name} must be between -${max} and ${max}.` };
  return { value: n };
}

/** A search term as an ILIKE pattern, with its wildcards made literal. */
export function likePattern(q) {
  // PostgREST also reads * as a wildcard and has no escape for it.
  const clean = String(q).toLowerCase().replace(/\*/g, ' ').replace(/[\\%_]/g, (ch) => `\\${ch}`);
  return `%${clean}%`;
}

// ── Output shaping (the allow-list on the way out) ───────────────────────

// Postgres numeric columns can arrive as strings.
const num = (v) => (v === null || v === undefined || v === '' ? null : Number(v));

/** Builds the public place object field by field: an unexpected column on
 * the row can never reach a client. */
export function toPlace(row) {
  const place = {
    id: row.id,
    name: row.name,
    description: row.description ?? null,
    type: row.type ?? null,
    area: row.area ?? null,
    lat: num(row.lat),
    lng: num(row.lng),
    rating: num(row.rating),
    review_count: num(row.review_count) ?? 0,
    image_count: num(row.image_count) ?? 0,
  };
  if (row.distance_m !== undefined && row.distance_m !== null) {
    place.distance_m = Math.round(Number(row.distance_m));
  }
  return place;
}

export function toCategory(row) {
  const words = String(row.type).replace(/_/g, ' ');
  return {
    id: row.type,
    label: words.charAt(0).toUpperCase() + words.slice(1),
    place_count: num(row.place_count) ?? 0,
  };
}

/** Public URLs for one stored photo, or null if it isn't a place photo. */
export function imageUrls(storagePath, { imageProxyUrl, supabaseUrl }) {
  const clean = String(storagePath || '').replace(/^\/+/, '');
  if (!IMAGE_PATH.test(clean) || clean.includes('..')) return null;
  // Per segment, so a stored "?" or "#" can't become part of the URL's query.
  const path = clean.split('/').map(encodeURIComponent).join('/');
  const proxy = (imageProxyUrl || '').trim().replace(/\/+$/, '');
  if (proxy) {
    return { url: `${proxy}/${path}?${IMAGE_TRANSFORM}`, full_url: `${proxy}/${path}?${IMAGE_FULL_TRANSFORM}` };
  }
  const base = (supabaseUrl || '').trim().replace(/\/+$/, '');
  const url = `${base}/storage/v1/object/public/${IMAGE_BUCKET}/${path}`;
  return { url, full_url: url };
}

export function toImage(row, urlConfig) {
  const urls = imageUrls(row.storage_path, urlConfig);
  if (!urls) return null;
  return { position: num(row.position) ?? 0, url: urls.url, full_url: urls.full_url };
}

export function toUsageCall(row) {
  return {
    endpoint: row.endpoint,
    status: num(row.status_code),
    credits_charged: num(row.credits_charged) ?? 0,
    response_ms: num(row.response_ms),
    at: row.created_at,
  };
}

// ── Responses ────────────────────────────────────────────────────────────

export const ERRORS = {
  missing_api_key: [401, 'Send your API key in the x-api-key header.'],
  invalid_api_key: [401, 'This API key is not valid.'],
  out_of_credits: [402, 'This key has no credits left. Top up or wait for the monthly reset.'],
  key_revoked: [403, 'This API key has been revoked.'],
  not_found: [404, 'Not found.'],
  method_not_allowed: [405, 'This API is read-only. Use GET.'],
  rate_limited: [429, 'Too many requests. Slow down and retry shortly.'],
  bad_request: [400, 'Bad request.'],
  server_error: [500, 'Something went wrong on our side. You were not charged.'],
};

export function envelope(data, { creditsCharged = 0, creditsRemaining = null, rateLimitRemaining = null, extra } = {}) {
  return {
    data,
    meta: {
      credits_charged: creditsCharged,
      credits_remaining: creditsRemaining,
      rate_limit_remaining: rateLimitRemaining,
      ...extra,
    },
  };
}

export function errorBody(code, message) {
  const [status, fallback] = ERRORS[code] || ERRORS.server_error;
  return { status, body: { error: { code, message: message || fallback } } };
}

export function rateHeaders({ limit, remaining, retryAfter } = {}) {
  const headers = {};
  if (Number.isFinite(limit)) headers['X-RateLimit-Limit'] = String(limit);
  if (Number.isFinite(remaining)) headers['X-RateLimit-Remaining'] = String(Math.max(0, remaining));
  if (Number.isFinite(retryAfter)) headers['Retry-After'] = String(Math.max(1, Math.ceil(retryAfter)));
  return headers;
}

/** The caller's IP as the proxy in front of the function reports it. */
export function clientIp(headers) {
  const forwarded = (headers.get('x-forwarded-for') || '').split(',')[0].trim();
  return forwarded || (headers.get('cf-connecting-ip') || '').trim() || 'unknown';
}
