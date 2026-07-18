// ── Admin PIN Authentication ─────────────────────────────────────────────
// Ported verbatim from legacy app.js ~3563–3690 (`_ADMIN_PIN_HASH`,
// `_PIN_LENGTH`, `_hashPin`). Same hash, same 6-digit length — this is a
// public repo already, the hash was never a secret, and legacy's own
// comment already explains it's a UI convenience gate, not the real
// access control:
//
//   "The PIN alone is only a UI convenience — it does NOT grant any
//   database access. [...] Security Rules only trust request.auth.uid,
//   so we require a real [...] sign-in [...] BEFORE showing the PIN pad."
//
// Same reasoning applies here with Supabase RLS in place of Firestore
// Security Rules — this file + AdminPinGate.jsx are the UI gate;
// Slice 11's actual admin writes still need real RLS policies scoped to
// `auth.uid()` to mean anything.
//
// To change the PIN: `echo -n "YOURNEWPIN" | sha256sum` and replace the
// hash below. PIN length can be adjusted via PIN_LENGTH.
export const ADMIN_PIN_HASH = 'd3a44339b277f9516c40d305461bc3baa5ec2a2b59caf83b09b070e2f3d72444';
export const PIN_LENGTH = 6;

export async function hashPin(pin) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(pin));
  return Array.from(new Uint8Array(buf))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
