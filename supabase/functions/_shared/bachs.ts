// ── supabase/functions/_shared/bachs.ts ──────────────────────────────────
//
// Tiny fetch wrapper, not the official Bachs SDK — Deno Edge Functions
// can import npm packages (`npm:bachs-io`), but this stays on plain
// `fetch` deliberately: the two functions that use it each make exactly
// one BACHS call, and a raw fetch keeps the exact request/response shape
// visible in this repo instead of hidden behind an SDK's own types (easier
// for whoever integrates this to diff against Bachs's real API reference
// and fix any drift between what's guessed here and what's actually true).
//
// ⚠️ FLAGGED, NOT CONFIRMED — read before deploying:
// The request/response shapes below (`/v1/products`, `/v1/checkout_sessions`,
// field names like `product_cart`/`success_url`/`checkout_url`) are
// reconstructed from Bachs's public SDK READMEs (bachs-io Python SDK,
// zeevx/php-bachs) as of Sept 2026 — this session had no direct access to
// Bachs's own REST API reference or an OpenAPI spec, only SDK usage
// examples. Before this goes live:
//   1. Sign up at https://bachs.io, get a sandbox key (sk_sandbox_...).
//   2. Open the real API reference (linked from the dashboard) and confirm
//      the exact paths/fields against what's used below — the SDKs
//      strongly imply a *product-based* checkout (you create a Product,
//      then check out against it) rather than an ad-hoc "just charge this
//      amount" call. If Bachs's dashboard exposes a simpler ad-hoc-amount
//      checkout endpoint, prefer it and delete the create-a-Product step
//      entirely — it's only here because that's what the SDK examples
//      show, not because it's confirmed to be the only way.
//   3. Run one real sandbox checkout end-to-end and confirm the webhook
//      fires with the shape bachs-webhook/index.ts expects.

const BACHS_BASE_URL = Deno.env.get('BACHS_BASE_URL') ?? 'https://sandbox-api.bachs.io';
const BACHS_SECRET_KEY = Deno.env.get('BACHS_SECRET_KEY');

if (!BACHS_SECRET_KEY) {
  // Fail loudly at cold-start, same "flag rather than let every call
  // silently 401 later" instinct src/lib/supabase.js already uses for
  // its own missing-env-var case.
  console.error('[bachs] Missing BACHS_SECRET_KEY — set it with `supabase secrets set BACHS_SECRET_KEY=sk_sandbox_...`');
}

export async function bachsRequest(path, { method = 'POST', body } = {}) {
  const res = await fetch(`${BACHS_BASE_URL}${path}`, {
    method,
    headers: {
      Authorization: `Bearer ${BACHS_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: body ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let json;
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    throw new Error(`BACHS returned non-JSON response (${res.status}): ${text.slice(0, 300)}`);
  }

  if (!res.ok) {
    throw new Error(
      `BACHS ${method} ${path} failed (${res.status}): ${json?.message || json?.error || text.slice(0, 300)}`
    );
  }
  return json;
}
