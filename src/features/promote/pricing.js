// ── Promote pricing ──────────────────────────────────────────────────────
//
// Single source of truth for the Campaign Duration slider's range/step and
// the ₦/day rate. Previously these lived only as local consts inside
// PromotePage.jsx — pulled out here because `submitPromotion.js` needs the
// exact same numbers to compute the amount actually charged. Two copies of
// "200 naira/day" is how a future price change quietly desyncs the slider
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
export const NAIRA_PER_DAY = 200;
export const MAX_PHOTOS = 5;
export const CURRENCY = 'NGN';

// Optional promo code — 50% off the campaign total. The Edge Function
// (create-promotion-checkout) holds its own copy of this code and discount
// and re-checks it, so editing it here alone does not change what BACHS
// collects. Keep both in sync.
export const PROMO_CODE = 'IAMAFUTARIAN';
export const PROMO_DISCOUNT = 0.5;

export function normalizePromoCode(code) {
  return (code || '').trim().toUpperCase();
}

export function isValidPromoCode(code) {
  return normalizePromoCode(code) === PROMO_CODE;
}

export function computeAmount(days, promoCode) {
  const clamped = Math.min(MAX_DAYS, Math.max(MIN_DAYS, Number(days) || DEFAULT_DAYS));
  const full = clamped * NAIRA_PER_DAY;
  return isValidPromoCode(promoCode) ? Math.round(full * (1 - PROMO_DISCOUNT)) : full;
}

export function formatNaira(amount) {
  return `₦${amount.toLocaleString('en-NG')}`;
}
