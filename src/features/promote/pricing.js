// ── Promote pricing ──────────────────────────────────────────────────────
//
// Single source of truth for the Campaign Duration slider's range/step and
// the ₦/day rate. Previously these lived only as local consts inside
// PromotePage.jsx — pulled out here because `submitPromotion.js` needs the
// exact same numbers to compute the amount actually charged. Two copies of
// "500 naira/day" is how a future price change quietly desyncs the slider
// display from what BACHS is told to collect.
//
// `computeAmount` is the one place `days → ₦` happens — the backend
// (create-promotion-checkout Edge Function, see
// PROMOTE_PAYMENT_INTEGRATION.md) independently re-derives the same amount
// from the stored `days` column rather than trusting a client-sent total,
// so this function existing client-side is for display/optimistic-UI only,
// never the source of truth for what gets charged.

export const MIN_DAYS = 1;
export const MAX_DAYS = 30;
export const DEFAULT_DAYS = 7;
export const NAIRA_PER_DAY = 500;
export const MAX_PHOTOS = 5;
export const CURRENCY = 'NGN';

export function computeAmount(days) {
  const clamped = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Number(days) || DEFAULT_DAYS));
  return clamped * NAIRA_PER_DAY;
}

export function formatNaira(amount) {
  return `₦${amount.toLocaleString('en-NG')}`;
}
