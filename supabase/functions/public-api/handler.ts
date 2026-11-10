// ── supabase/functions/public-api/handler.ts ─────────────────────────────
//
// The Public API's request logic: check the key, apply the rate limit,
// fetch, charge, log. It talks to the database only through `store`
// (store.ts), so scripts/publicApi.test.mjs can run it in Node against a
// fake one. Plain JavaScript on purpose: the test copies it to .mjs.
//
// Order matters for billing (docs/public-api.md, "What counts as a charged
// request"): credits are taken only after the data was fetched, and the
// data is dropped if they can't be taken.

import {
  clientIp,
  costFor,
  envelope,
  errorBody,
  isKeyFormat,
  isPlaceId,
  maskKey,
  matchRoute,
  parseListParams,
  parseNearbyParams,
  rateHeaders,
  sha256Hex,
  shouldCharge,
  toCategory,
  toImage,
  toPlace,
  toUsageCall,
} from '../_shared/publicApi.ts';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'x-api-key, content-type',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, Retry-After',
  'Access-Control-Max-Age': '86400',
};

/**
 * @param store   see store.ts for the shape
 * @param config  { imageProxyUrl, supabaseUrl } for building photo URLs
 */
export function createHandler({ store, config = {}, now = () => Date.now(), log = console }) {
  return async function handle(req) {
    // Preflight: never authenticated, counted, charged or logged.
    if (req.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    const started = now();
    const url = new URL(req.url);
    const route = matchRoute(url.pathname);
    const endpoint = route ? `${req.method} ${route.pattern.slice(4)}` : `${req.method} (unknown)`;
    const apiKey = (req.headers.get('x-api-key') || '').trim();

    let auth = null;
    let rate = {};

    const send = async (status, body, { charged = 0, logIt = true } = {}) => {
      if (logIt) {
        try {
          await store.logUsage({
            key_id: auth?.key_id ?? null,
            endpoint,
            status_code: status,
            credits_charged: charged,
            response_ms: Math.max(0, Math.round(now() - started)),
          });
        } catch (err) {
          // A lost log line must not fail a request the caller paid for.
          log.error('[public-api] usage log failed:', err?.message || err);
        }
      }
      return new Response(JSON.stringify(body), {
        status,
        headers: {
          ...CORS_HEADERS,
          ...rateHeaders(rate),
          'Content-Type': 'application/json; charset=utf-8',
          // Paid, per-key answers: no proxy in between may store or replay one.
          'Cache-Control': 'no-store',
        },
      });
    };
    const fail = (code, message, opts) => {
      const { status, body } = errorBody(code, message);
      return send(status, body, opts);
    };

    // ── 1. Key + rate limit (one database call) ──────────────────────────
    // A missing or malformed key can't match a stored hash, so it is sent
    // as '' and counted against the caller's IP like any wrong key.
    // The IP comes from x-forwarded-for, which a caller could fake, so
    // nothing unbounded may hang off it: see the logging rules below.
    try {
      const keyHash = isKeyFormat(apiKey) ? await sha256Hex(apiKey) : '';
      const ipHash = await sha256Hex(clientIp(req.headers));
      auth = await store.authorize(keyHash, ipHash);
      if (!auth || !auth.status) throw new Error('empty authorize result');
    } catch (err) {
      log.error('[public-api] authorize failed:', maskKey(apiKey), err?.message || err);
      auth = null;
      return fail('server_error', null, { logIt: false });
    }
    rate = { limit: auth.rate_limit, remaining: auth.rate_remaining };

    // Requests without a working key are counted (per IP) but only a revoked
    // key's first few per minute are logged. Strangers must not be able to
    // fill api_usage, and there is no key to file an unknown one under.
    if (auth.status === 'ip_rate_limited') {
      rate.retryAfter = auth.retry_after;
      return fail('rate_limited', 'Too many requests without a valid API key. Try again in a minute.', { logIt: false });
    }
    if (auth.status === 'invalid') {
      return fail(apiKey ? 'invalid_api_key' : 'missing_api_key', null, { logIt: false });
    }
    if (auth.status === 'revoked') return fail('key_revoked');
    if (auth.status === 'rate_limited') {
      rate.retryAfter = auth.retry_after;
      return fail('rate_limited');
    }
    if (auth.status !== 'ok') return fail('server_error');

    // ── 2. Route + params (nothing below runs for a bad request) ─────────
    if (!route) return fail('not_found', 'No such endpoint. See the docs for the list.');
    if (req.method !== 'GET') return fail('method_not_allowed');

    let params = null;
    if (route.name === 'places.list' || route.name === 'places.nearby') {
      const parsed = route.name === 'places.list' ? parseListParams(url.searchParams) : parseNearbyParams(url.searchParams);
      if (parsed.error) return fail('bad_request', parsed.error);
      params = parsed.value;
    }
    if ((route.name === 'places.detail' || route.name === 'places.images') && !isPlaceId(route.id)) {
      return fail('bad_request', 'That is not a valid place id.');
    }

    // ── 3. Enough credits to start? (saves the work; step 5 is the real check)
    const cost = costFor(route.pattern, auth.costs);
    let creditsRemaining = auth.credits_remaining;
    if (cost > creditsRemaining) return fail('out_of_credits');

    // ── 4. Fetch ─────────────────────────────────────────────────────────
    let data;
    let extra;
    try {
      if (route.name === 'places.list') {
        const { rows, total } = await store.listPlaces(params);
        data = rows.map(toPlace);
        const next = params.offset + rows.length;
        extra = {
          pagination: {
            limit: params.limit,
            offset: params.offset,
            total,
            next_offset: next < total ? next : null,
          },
        };
      } else if (route.name === 'places.nearby') {
        data = (await store.nearbyPlaces(params)).map(toPlace);
      } else if (route.name === 'places.detail') {
        const row = await store.getPlace(route.id);
        if (!row) return fail('not_found', 'No place with that id.');
        data = toPlace(row);
      } else if (route.name === 'places.images') {
        const row = await store.getPlace(route.id);
        if (!row) return fail('not_found', 'No place with that id.');
        data = (await store.placeImages(route.id)).map((img) => toImage(img, config)).filter(Boolean);
      } else if (route.name === 'categories') {
        data = (await store.categories()).map(toCategory);
      } else if (route.name === 'usage') {
        const calls = await store.recentUsage(auth.key_id);
        data = {
          key: auth.key_prefix,
          plan: {
            id: auth.plan_id,
            name: auth.plan_name,
            monthly_credits: auth.monthly_credits,
            rate_limit_per_minute: auth.rate_limit,
          },
          credits: {
            plan: auth.plan_credits_remaining,
            topup: auth.topup_credits_remaining,
            total: auth.credits_remaining,
          },
          resets_at: auth.period_reset_at,
          recent_calls: calls.map(toUsageCall),
        };
      }
    } catch (err) {
      log.error('[public-api] fetch failed:', endpoint, err?.message || err);
      return fail('server_error');
    }

    // ── 5. Charge, then answer ───────────────────────────────────────────
    let charged = 0;
    if (shouldCharge(200, cost)) {
      try {
        const result = await store.consumeCredits(auth.key_id, cost);
        // Another request spent the last credits first: no data goes out.
        if (result.insufficient) return fail('out_of_credits');
        // Revoked in the moment between the key check and the charge.
        if (result.revoked) return fail('key_revoked');
        charged = cost;
        creditsRemaining = result.credits_remaining;
      } catch (err) {
        log.error('[public-api] charge failed:', endpoint, err?.message || err);
        return fail('server_error');
      }
    }

    return send(
      200,
      envelope(data, { creditsCharged: charged, creditsRemaining, rateLimitRemaining: auth.rate_remaining, extra }),
      { charged }
    );
  };
}
