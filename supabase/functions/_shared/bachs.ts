// ── supabase/functions/_shared/bachs.ts ──────────────────────────────────
//
// Tiny fetch wrapper, not the official Bachs SDK. See
// create-promotion-checkout/index.ts for the confirmed request shape
// (`/v1/checkout-sessions` with an ad-hoc `pricing: { amount, currency }`).

const BACHS_BASE_URL = Deno.env.get('BACHS_BASE_URL') ?? 'https://sandbox-api.bachs.io';
const BACHS_SECRET_KEY = Deno.env.get('BACHS_SECRET_KEY');

if (!BACHS_SECRET_KEY) {
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
