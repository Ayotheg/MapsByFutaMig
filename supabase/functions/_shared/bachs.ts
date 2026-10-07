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
// CONFIRMED against a real sandbox account (not just SDK READMEs):
// `/v1/checkout-sessions` (hyphen) accepts an ad-hoc
// `{ pricing: { amount, currency }, success_url, cancel_url, reference,
// metadata }` body directly — no `/v1/products` step needed, and no
// `product_cart`. A real sandbox checkout + webhook round-trip confirmed
// the whole flow end-to-end, including the webhook signature scheme (see
// bachs-webhook/index.ts). Still genuinely unconfirmed: the exact field
// name on the checkout-sessions response carrying the hosted page URL
// (create-promotion-checkout/index.ts guesses `url` or `checkout_url` —
// check its console.error output on first real deploy to settle this).

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