# Maps By FUTA Public API (v1)

Read-only access to FUTA campus places, their categories and their photos, for
other apps (delivery, lodging, campus guides, student tools).

- Base URL: `https://mapsbyfuta.xyz/api/v1`
- Auth: send your key in the `x-api-key` header on every request.
- Format: JSON. Read-only: `GET` only.
- Call it from your server. A key placed in a mobile app or web page can be copied.

```bash
curl https://mapsbyfuta.xyz/api/v1/places?limit=5 \
  -H "x-api-key: fk_live_your_key_here"
```

## Credits

1 credit = 1 standard request. Photo requests cost more.

| Endpoint | Credits |
|---|---|
| `GET /v1/places` | 1 |
| `GET /v1/places/:id` | 1 |
| `GET /v1/places/nearby` | 1 |
| `GET /v1/categories` | 1 |
| `GET /v1/places/:id/images` | 5 |
| `GET /v1/usage` | 0 |

| Plan | Price | Credits per month | Requests per minute |
|---|---|---|---|
| Free | ₦0 | 1,000 | 20 |
| Starter | ₦3,000 | 5,000 | 60 |
| Growth | ₦10,000 | 25,000 | 120 |

- **Plan credits** reset every month on your reset date. Unused ones do not carry over.
- **Top-up credits** never expire. They are used only after the month's plan credits run out.

### What counts as a charged request

You are charged only when a request succeeds and we send you data.

| Outcome | Charged? |
|---|---|
| `200` with data | Yes |
| `200` with an empty list (the search ran, nothing matched) | Yes |
| `400` bad parameter, `404` not found, `405` | No |
| `401`, `402`, `403`, `429` | No |
| `500` (our fault) | No |
| `GET /v1/usage`, `OPTIONS` | No |

Credits are taken after the data has been fetched. If your last credits are spent
by another of your requests at the same moment, you get `402` and no data.

## Response format

Success:

```json
{
  "data": [],
  "meta": { "credits_charged": 1, "credits_remaining": 4999, "rate_limit_remaining": 59 }
}
```

Error:

```json
{ "error": { "code": "bad_request", "message": "limit must be between 1 and 50." } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `bad_request` | A parameter is missing or wrong. The message says which. |
| 401 | `missing_api_key`, `invalid_api_key` | No key, or not a real key. |
| 402 | `out_of_credits` | No credits left for this request. |
| 403 | `key_revoked` | The key was turned off. |
| 404 | `not_found` | No such place or endpoint. |
| 405 | `method_not_allowed` | Only `GET` is supported. |
| 429 | `rate_limited` | Too many requests this minute. |
| 500 | `server_error` | Our fault. Not charged. Safe to retry. |

## Rate limits

Each key has a per-minute limit set by its plan. The count restarts at the
start of every clock minute. Responses carry:

- `X-RateLimit-Limit`: requests allowed per minute
- `X-RateLimit-Remaining`: requests left in the current minute
- `Retry-After` (on `429` only): seconds until the next minute starts

Requests with a missing, wrong or revoked key are limited to 10 per minute per
IP address.

## Endpoints

### `GET /v1/places`

Approved places, sorted by name.

| Param | Notes |
|---|---|
| `type` | A category id from `/v1/categories`, e.g. `hostel`. |
| `q` | Text search over name, area and type. Up to 80 characters. No wildcards. |
| `limit` | 1 to 50. Default 20. |
| `offset` | Where to start. Default 0, up to 10000. Use `meta.pagination.next_offset` for the next page. |

```bash
curl "https://mapsbyfuta.xyz/api/v1/places?type=food&q=cafe&limit=2" -H "x-api-key: $KEY"
```

```json
{
  "data": [
    {
      "id": "0AbCdEf123",
      "name": "SUB Cafeteria",
      "description": "Main student cafeteria.",
      "type": "food",
      "area": "SUB area",
      "lat": 7.3001,
      "lng": 5.1352,
      "rating": 4.5,
      "review_count": 2,
      "image_count": 3
    }
  ],
  "meta": {
    "credits_charged": 1,
    "credits_remaining": 4999,
    "rate_limit_remaining": 59,
    "pagination": { "limit": 2, "offset": 0, "total": 1, "next_offset": null }
  }
}
```

`description`, `type`, `area` and `rating` can be `null`. `image_count` tells you
whether a photo request is worth its 5 credits.

### `GET /v1/places/:id`

One place, same fields as above.

```bash
curl https://mapsbyfuta.xyz/api/v1/places/0AbCdEf123 -H "x-api-key: $KEY"
```

### `GET /v1/places/nearby`

Places around a point, nearest first. Each has a `distance_m` (metres).

| Param | Notes |
|---|---|
| `lat`, `lng` | Required. Decimal degrees. |
| `radius_m` | 1 to 5000. Default 500. |
| `type` | Optional category id. |
| `limit` | 1 to 50. Default 20. |

```bash
curl "https://mapsbyfuta.xyz/api/v1/places/nearby?lat=7.3003&lng=5.1350&radius_m=300" -H "x-api-key: $KEY"
```

### `GET /v1/categories`

Every place type in use, with how many places have it.

```bash
curl https://mapsbyfuta.xyz/api/v1/categories -H "x-api-key: $KEY"
```

```json
{ "data": [{ "id": "hostel", "label": "Hostel", "place_count": 107 }], "meta": { "credits_charged": 1, "credits_remaining": 4998, "rate_limit_remaining": 58 } }
```

### `GET /v1/places/:id/images` (5 credits)

Photos of one place, in display order. `url` is sized for cards (900 px wide),
`full_url` for full-screen viewing (1600 px).

```bash
curl https://mapsbyfuta.xyz/api/v1/places/0AbCdEf123/images -H "x-api-key: $KEY"
```

```json
{
  "data": [{ "position": 0, "url": "https://ik.imagekit.io/…/a.jpg?tr=w-900,c-at_max,q-75,f-auto", "full_url": "https://ik.imagekit.io/…/a.jpg?tr=w-1600,c-at_max,q-80,f-auto" }],
  "meta": { "credits_charged": 5, "credits_remaining": 4993, "rate_limit_remaining": 57 }
}
```

A place with no photos returns an empty list and is still charged; check
`image_count` first.

### `GET /v1/usage` (free)

Your plan, credits, reset date and last 20 calls.

```bash
curl https://mapsbyfuta.xyz/api/v1/usage -H "x-api-key: $KEY"
```

```json
{
  "data": {
    "key": "fk_live_1a2b",
    "plan": { "id": "starter", "name": "Starter", "monthly_credits": 5000, "rate_limit_per_minute": 60 },
    "credits": { "plan": 4993, "topup": 0, "total": 4993 },
    "resets_at": "2026-12-10T07:30:00+00:00",
    "recent_calls": [{ "endpoint": "GET /v1/places", "status": 200, "credits_charged": 1, "response_ms": 84, "at": "2026-11-10T07:31:02+00:00" }]
  },
  "meta": { "credits_charged": 0, "credits_remaining": 4993, "rate_limit_remaining": 56 }
}
```

---

# For the Maps By FUTA team

## What the API can and cannot see

It reads three database views and nothing else (`supabase/public_api.sql`):

| View | Columns | Rows |
|---|---|---|
| `api_public_places` | id, name, description, type, area, lat, lng, rating, review_count, image_count | Approved places with a location. No people, channels or online businesses. |
| `api_public_place_images` | place_id, storage_path, position | Photos of those places only. The path is turned into a URL and never returned. |
| `api_public_categories` | type, place_count | Built from the places view. |

It never reads users, profiles, reviews, analytics, events, promotions or
submissions, and never returns who submitted a place. To expose a new field,
add it to the view **and** to `PLACE_COLUMNS` / `toPlace()` in
`supabase/functions/_shared/publicApi.ts`. A column missing from either is not served.

## Code

- `supabase/public_api.sql`: tables, views, functions, seeds, permissions.
- `supabase/functions/public-api/`: `index.ts` (Deno entry), `handler.ts`
  (auth → rate limit → fetch → charge → log), `store.ts` (every query).
- `supabase/functions/_shared/publicApi.ts`: pure rules. Tests: `scripts/publicApi.test.mjs`.
- `vercel.json`: `/api/v1/*` is forwarded to the function, so developers never see the Supabase address.

## Admin tasks (Supabase SQL Editor)

Payments are not wired up yet; credits are granted by hand.

```sql
-- Create a key. The api_key column is shown ONCE; only its hash is stored.
select * from api_create_key('Acme Delivery', 'dev@acme.com', 'starter');

-- List keys (the prefix is safe to show; the full key cannot be recovered).
select id, key_prefix, owner_name, plan_id, plan_credits_remaining,
       topup_credits_remaining, period_reset_at, status, last_used_at
  from api_keys order by created_at desc;

-- Grant top-up credits (never expire). The 4th argument is a unique reference:
-- running the same reference twice grants once.
select grant_credits('<key id>', 2000, 'topup', 'transfer-2026-11-10-acme', 'paid by bank transfer');

-- Change plan (refills to the new allowance and starts a fresh month).
select api_set_plan('<key id>', 'growth');

-- Revoke a key (it gets 403 from then on).
select api_revoke_key('<key id>');

-- Change a price, an allowance or a limit. No redeploy needed.
update api_credit_costs set credits = 8 where endpoint_pattern = 'GET /v1/places/:id/images';
update api_plans set monthly_credits = 6000 where id = 'starter';

-- A key's recent calls.
select endpoint, status_code, credits_charged, response_ms, created_at
  from api_usage where key_id = '<key id>' order by created_at desc limit 50;
```

A lost key cannot be recovered: revoke it and create a new one.

## Deploy

1. Run `supabase/public_api.sql` in the SQL Editor (safe to re-run).
2. `supabase secrets set IMAGE_PROXY_URL=https://ik.imagekit.io/<id>` (the same
   value the app uses). Without it, photo URLs point at Supabase Storage.
3. `supabase functions deploy public-api --no-verify-jwt` (callers have an API
   key, not a Supabase login; the function checks the key itself).
4. Merge and deploy the site so the `/api/v1/*` rule in `vercel.json` goes live.

## Adding payments later

A paid webhook (BACHS or Paystack) should call
`grant_credits(key_id, amount, 'topup', '<payment id>')` for a credit pack. The
payment id as the reference makes a repeated webhook harmless: the same
reference grants once.

`api_set_plan(key_id, plan)` has no such guard and refills on every call, so a
subscription webhook must first record the payment id itself (as
`bachs-webhook` does with `bachs_webhook_events`) and skip repeats.

Same rule as `docs/payments.md`: only the signature-checked webhook may grant
paid credits.

## Known limits

- `api_usage` grows by one row per request. Clear old rows when needed:
  `delete from api_usage where created_at < now() - interval '90 days';`
- Requests with a missing or unknown key are counted per IP but not written to
  `api_usage` (there is no key to file them under, and strangers must not be
  able to fill the table). A revoked key's requests are logged up to the
  per-IP limit.
- The per-IP limit trusts the `x-forwarded-for` header for the caller's IP, so
  a determined caller can dodge it. Keys carry about 180 random bits, so
  guessing one is not practical either way.
- The per-minute limit is a fixed clock-minute window: a caller can use one
  minute's allowance at its end and the next one's straight after.
- A reset day of the 29th to 31st settles on the last day of a shorter month.
