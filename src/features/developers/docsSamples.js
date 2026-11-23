// Code samples and example responses for /developers/docs. Pure data, so
// scripts/developerData.test.mjs can check every example against the API's
// real output shaping (supabase/functions/_shared/publicApi.ts): if the API
// changes a field, the test fails until the docs are updated too.
//
// Example data is real (approved places from the live map), trimmed.

import { API_BASE_URL } from './developerData.js';

export const json = (value) => JSON.stringify(value, null, 2);

// ── Example objects ──────────────────────────────────────────────────────

export const EXAMPLE_PLACE = {
  id: '00a4f5d3-6e65-4a25-abd0-5f1076836854',
  name: 'Tosmof Villa',
  description: '',
  type: 'hostel',
  area: 'South Gate',
  lat: 7.288927,
  lng: 5.147786,
  rating: null,
  review_count: 0,
  image_count: 1,
};

const LIBRARY = {
  id: 'cd8359c8-040c-4049-90f7-3f5639361a48',
  name: 'Albert Ilemobade Library',
  description: '',
  type: 'library',
  area: 'Obanla',
  lat: 7.304348567978566,
  lng: 5.134508370646081,
  rating: null,
  review_count: 0,
  image_count: 1,
};
const SAAT_LIBRARY = {
  id: '5iQ5Iqcnn9dEBrEmjP5t',
  name: 'SAAT Library',
  description: '',
  type: 'library',
  area: null,
  lat: 7.3013006,
  lng: 5.1355217,
  rating: null,
  review_count: 0,
  image_count: 0,
};

export const EXAMPLE_LIST = {
  data: [LIBRARY, SAAT_LIBRARY],
  meta: {
    credits_charged: 1,
    credits_remaining: 4998,
    rate_limit_remaining: 58,
    pagination: { limit: 2, offset: 0, total: 3, next_offset: 2 },
  },
};

export const EXAMPLE_DETAIL = {
  data: EXAMPLE_PLACE,
  meta: { credits_charged: 1, credits_remaining: 4997, rate_limit_remaining: 57 },
};

export const EXAMPLE_NEARBY = {
  data: [
    {
      id: 'F3ilQ97t4d7gyO8nZDtx',
      name: 'Public Restroom',
      description: '',
      type: 'toilets',
      area: null,
      lat: 7.3008409,
      lng: 5.1346844,
      rating: null,
      review_count: 0,
      image_count: 0,
      distance_m: 69,
    },
    {
      id: 'pKrUVNN2PQsYOogpi5Te',
      name: 'Centre for Space Research and Applications (CESRA)',
      description: '',
      type: 'yes',
      area: null,
      lat: 7.3009285,
      lng: 5.1349788,
      rating: null,
      review_count: 0,
      image_count: 0,
      distance_m: 70,
    },
  ],
  meta: { credits_charged: 1, credits_remaining: 4996, rate_limit_remaining: 56 },
};

export const EXAMPLE_CATEGORIES = {
  data: [
    { id: 'admin', label: 'Admin', place_count: 12 },
    { id: 'bank', label: 'Bank', place_count: 8 },
    { id: 'bus_stop', label: 'Bus stop', place_count: 12 },
    { id: 'chapel', label: 'Chapel', place_count: 29 },
    { id: 'food', label: 'Food', place_count: 67 },
    { id: 'hostel', label: 'Hostel', place_count: 107 },
  ],
  meta: { credits_charged: 1, credits_remaining: 4995, rate_limit_remaining: 55 },
};

const IMG = 'https://ik.imagekit.io/pk5x5zal3/waypoints/00a4f5d3-6e65-4a25-abd0-5f1076836854/0-1792556402648.jpg';
export const EXAMPLE_IMAGES = {
  data: [
    {
      position: 0,
      url: `${IMG}?tr=w-900,c-at_max,q-75,f-auto`,
      full_url: `${IMG}?tr=w-1600,c-at_max,q-80,f-auto`,
    },
  ],
  meta: { credits_charged: 5, credits_remaining: 4990, rate_limit_remaining: 54 },
};

export const EXAMPLE_USAGE = {
  data: {
    key: 'fk_live_2e02',
    plan: { id: 'starter', name: 'Starter', monthly_credits: 5000, rate_limit_per_minute: 60 },
    credits: { plan: 2990, topup: 2000, total: 4990 },
    resets_at: '2026-12-10T07:30:00+00:00',
    recent_calls: [
      { endpoint: 'GET /v1/places/:id/images', status: 200, credits_charged: 5, response_ms: 212, at: '2026-11-10T09:41:07+00:00' },
      { endpoint: 'GET /v1/places', status: 400, credits_charged: 0, response_ms: 9, at: '2026-11-10T09:40:51+00:00' },
    ],
  },
  meta: { credits_charged: 0, credits_remaining: 4990, rate_limit_remaining: 53 },
};

export const EXAMPLE_ERROR = { error: { code: 'bad_request', message: 'limit must be between 1 and 50.' } };

// Every error the API can send, with what to do about it.
export const ERROR_GUIDE = [
  {
    status: 400,
    code: 'bad_request',
    when: 'A parameter is missing, the wrong type or out of range. The message names it, e.g. "radius_m must be between 1 and 5000."',
    fix: 'Fix the request. Retrying the same request will fail again.',
  },
  {
    status: 401,
    code: 'missing_api_key',
    when: 'No x-api-key header was sent.',
    fix: 'Send the header on every request. Check a proxy or framework is not stripping it.',
  },
  {
    status: 401,
    code: 'invalid_api_key',
    when: 'The key is not one of ours: a typo, a space or line break copied with it, or a key you rolled (the old one stops working).',
    fix: 'Copy the key again from your server config. Lost it? Roll the key on the developer page.',
  },
  {
    status: 402,
    code: 'out_of_credits',
    when: 'The key does not have enough credits for this call (a photo call needs 5).',
    fix: 'Wait for the monthly reset (see /usage), or ask for more credits on the developer page. Nothing was charged.',
  },
  {
    status: 403,
    code: 'key_revoked',
    when: 'The key was revoked by you or by us.',
    fix: 'Create a new key on the developer page.',
  },
  {
    status: 404,
    code: 'not_found',
    when: 'No place has that id, or the path is not an endpoint (e.g. a typo in /v1/place).',
    fix: 'Check the id came from this API, and the path. Places can be removed, so handle 404 for ids you stored.',
  },
  {
    status: 405,
    code: 'method_not_allowed',
    when: 'You used POST, PUT, PATCH or DELETE. The API is read-only.',
    fix: 'Use GET.',
  },
  {
    status: 429,
    code: 'rate_limited',
    when: "Too many calls from this key this minute, or too many calls without a working key from your IP address.",
    fix: 'Wait the number of seconds in the Retry-After header, then retry. Slow down or spread calls out.',
  },
  {
    status: 500,
    code: 'server_error',
    when: 'Something failed on our side.',
    fix: 'Retry after a short wait. Never charged. If it keeps happening, email hello@mapsbyfuta.xyz.',
  },
];

// ── Per-endpoint samples ─────────────────────────────────────────────────

const curl = (path) => `curl "${API_BASE_URL}${path}" \\\n  -H "x-api-key: $MAPS_BY_FUTA_KEY"`;

const js = (path, after) =>
  [
    `const res = await fetch("${API_BASE_URL}${path}", {`,
    '  headers: { "x-api-key": process.env.MAPS_BY_FUTA_KEY },',
    '});',
    'const body = await res.json();',
    'if (!res.ok) throw new Error(`${body.error.code}: ${body.error.message}`);',
    after,
  ].join('\n');

const py = (path, params, after) =>
  [
    'import os, requests',
    '',
    'res = requests.get(',
    `    "${API_BASE_URL}${path}",`,
    ...(params ? [`    params=${params},`] : []),
    '    headers={"x-api-key": os.environ["MAPS_BY_FUTA_KEY"]},',
    '    timeout=10,',
    ')',
    'body = res.json()',
    'if not res.ok:',
    '    raise RuntimeError(f"{body[\'error\'][\'code\']}: {body[\'error\'][\'message\']}")',
    after,
  ].join('\n');

export const ENDPOINT_SAMPLES = {
  'GET /v1/places': {
    curl: curl('/places?type=library&q=library&limit=2'),
    js: js(
      '/places?type=library&q=library&limit=2',
      'console.log(body.data.map((p) => p.name), "next page at", body.meta.pagination.next_offset);'
    ),
    python: py(
      '/places',
      '{"type": "library", "q": "library", "limit": 2}',
      'print([p["name"] for p in body["data"]], body["meta"]["pagination"]["next_offset"])'
    ),
    response: EXAMPLE_LIST,
  },
  'GET /v1/places/:id': {
    curl: curl(`/places/${EXAMPLE_PLACE.id}`),
    js: js(`/places/${EXAMPLE_PLACE.id}`, 'const place = body.data;\nconsole.log(place.name, place.lat, place.lng);'),
    python: py(`/places/${EXAMPLE_PLACE.id}`, null, 'place = body["data"]\nprint(place["name"], place["lat"], place["lng"])'),
    response: EXAMPLE_DETAIL,
  },
  'GET /v1/places/nearby': {
    curl: curl('/places/nearby?lat=7.3003&lng=5.1350&radius_m=300&limit=2'),
    js: js(
      '/places/nearby?lat=7.3003&lng=5.1350&radius_m=300&limit=2',
      'for (const p of body.data) console.log(`${p.name}: ${p.distance_m} m`);'
    ),
    python: py(
      '/places/nearby',
      '{"lat": "7.3003", "lng": "5.1350", "radius_m": 300, "limit": 2}',
      'for p in body["data"]:\n    print(f\'{p["name"]}: {p["distance_m"]} m\')'
    ),
    response: EXAMPLE_NEARBY,
  },
  'GET /v1/categories': {
    curl: curl('/categories'),
    js: js('/categories', 'const options = body.data.map((c) => ({ value: c.id, label: `${c.label} (${c.place_count})` }));'),
    python: py('/categories', null, 'for c in body["data"]:\n    print(c["id"], c["place_count"])'),
    response: EXAMPLE_CATEGORIES,
  },
  'GET /v1/places/:id/images': {
    curl: curl(`/places/${EXAMPLE_PLACE.id}/images`),
    js: js(
      `/places/${EXAMPLE_PLACE.id}/images`,
      'const html = body.data.map((img) => `<img src="${img.url}" loading="lazy" alt="">`).join("");'
    ),
    python: py(`/places/${EXAMPLE_PLACE.id}/images`, null, 'urls = [img["url"] for img in body["data"]]'),
    response: EXAMPLE_IMAGES,
  },
  'GET /v1/usage': {
    curl: curl('/usage'),
    js: js('/usage', 'const { credits, resets_at } = body.data;\nconsole.log(`${credits.total} credits left, resets ${resets_at}`);'),
    python: py('/usage', null, 'print(body["data"]["credits"]["total"], "credits left")'),
    response: EXAMPLE_USAGE,
  },
};

// ── Recipes ──────────────────────────────────────────────────────────────

export const RECIPES = {
  firstCall: `curl "${API_BASE_URL}/usage" \\\n  -H "x-api-key: fk_live_your_key_here"`,

  envFile: '# .env (never commit this file)\nMAPS_BY_FUTA_KEY=fk_live_your_key_here',

  paginate: [
    `const BASE = "${API_BASE_URL}";`,
    'const headers = { "x-api-key": process.env.MAPS_BY_FUTA_KEY };',
    '',
    '// Every place of one type, 50 at a time (1 credit per page).',
    'export async function allPlaces(type) {',
    '  const places = [];',
    '  let offset = 0;',
    '  while (offset !== null) {',
    '    const url = new URL(`${BASE}/places`);',
    '    url.searchParams.set("limit", "50");',
    '    url.searchParams.set("offset", String(offset));',
    '    if (type) url.searchParams.set("type", type);',
    '',
    '    const res = await fetch(url, { headers });',
    '    const body = await res.json();',
    '    if (!res.ok) throw new Error(`${body.error.code}: ${body.error.message}`);',
    '',
    '    places.push(...body.data);',
    '    offset = body.meta.pagination.next_offset; // null on the last page',
    '  }',
    '  return places;',
    '}',
  ].join('\n'),

  paginatePython: [
    'import os, requests',
    '',
    `BASE = "${API_BASE_URL}"`,
    'session = requests.Session()',
    'session.headers["x-api-key"] = os.environ["MAPS_BY_FUTA_KEY"]',
    '',
    'def all_places(place_type=None):',
    '    places, offset = [], 0',
    '    while offset is not None:',
    '        params = {"limit": 50, "offset": offset}',
    '        if place_type:',
    '            params["type"] = place_type',
    '        body = session.get(f"{BASE}/places", params=params, timeout=10).json()',
    '        if "error" in body:',
    '            raise RuntimeError(body["error"]["message"])',
    '        places += body["data"]',
    '        offset = body["meta"]["pagination"]["next_offset"]',
    '    return places',
  ].join('\n'),

  retry: [
    `const BASE = "${API_BASE_URL}";`,
    '',
    '// Retries 429 (after Retry-After) and 5xx (after 1s, 2s, 4s). Never retries 4xx:',
    "// they fail the same way again. Failed calls are never charged.",
    'export async function mbf(path, { tries = 4 } = {}) {',
    '  for (let attempt = 0; attempt < tries; attempt++) {',
    '    const res = await fetch(BASE + path, {',
    '      headers: { "x-api-key": process.env.MAPS_BY_FUTA_KEY },',
    '    });',
    '    if (res.status === 429 || res.status >= 500) {',
    '      const seconds = Number(res.headers.get("retry-after")) || 2 ** attempt;',
    '      await new Promise((r) => setTimeout(r, seconds * 1000));',
    '      continue;',
    '    }',
    '    const body = await res.json();',
    '    if (!res.ok) {',
    '      const err = new Error(body.error.message);',
    '      err.code = body.error.code;',
    '      err.status = res.status;',
    '      throw err;',
    '    }',
    '    return body;',
    '  }',
    '  throw new Error("Maps By FUTA API: gave up after retries");',
    '}',
  ].join('\n'),

  proxyExpress: [
    'import express from "express";',
    '',
    `const BASE = "${API_BASE_URL}";`,
    'const KEY = process.env.MAPS_BY_FUTA_KEY; // stays on your server',
    'const cache = new Map(); // url -> { at, status, body }',
    'const TEN_MINUTES = 10 * 60 * 1000;',
    '',
    'async function cached(path) {',
    '  const hit = cache.get(path);',
    '  if (hit && Date.now() - hit.at < TEN_MINUTES) return hit;',
    '  const res = await fetch(BASE + path, { headers: { "x-api-key": KEY } });',
    '  const entry = { at: Date.now(), status: res.status, body: await res.json() };',
    '  if (res.ok) cache.set(path, entry); // only cache successes',
    '  return entry;',
    '}',
    '',
    'const app = express();',
    '',
    '// Your app calls /campus/nearby?lat=..&lng=.. ; the browser never sees the key.',
    'app.get("/campus/nearby", async (req, res) => {',
    '  // Round to ~100 m so nearby users share one cached answer.',
    '  const lat = Number(req.query.lat).toFixed(3);',
    '  const lng = Number(req.query.lng).toFixed(3);',
    '  const { status, body } = await cached(`/places/nearby?lat=${lat}&lng=${lng}&radius_m=800`);',
    '  res.status(status).json(body);',
    '});',
    '',
    'app.listen(3000);',
  ].join('\n'),

  proxyNext: [
    '// app/api/campus/search/route.js  (Next.js App Router)',
    `const BASE = "${API_BASE_URL}";`,
    '',
    'export async function GET(request) {',
    '  const q = new URL(request.url).searchParams.get("q") ?? "";',
    '  const res = await fetch(`${BASE}/places?q=${encodeURIComponent(q)}&limit=20`, {',
    '    headers: { "x-api-key": process.env.MAPS_BY_FUTA_KEY },',
    '  });',
    '  return Response.json(await res.json(), { status: res.status });',
    '}',
  ].join('\n'),

  directions: [
    '// Open walking directions to a place in Google Maps.',
    'const directionsUrl = (place) =>',
    '  `https://www.google.com/maps/dir/?api=1&destination=${place.lat},${place.lng}&travelmode=walking`;',
  ].join('\n'),

  creditsCheck: [
    '// Before a big job (e.g. photos for 100 places = 500 credits), check you can afford it.',
    'const { data } = await mbf("/usage"); // free',
    'const needed = places.filter((p) => p.image_count > 0).length * 5;',
    'if (data.credits.total < needed) {',
    '  throw new Error(`Need ${needed} credits, have ${data.credits.total}`);',
    '}',
  ].join('\n'),
};
