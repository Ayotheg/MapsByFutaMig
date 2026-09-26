import { supabase } from '../../lib/supabase';
import { uploadImage, insertImageRows } from '../admin/adminSave';
import { track } from '../../lib/analytics';
import { MIN_DAYS, MAX_DAYS, MAX_PHOTOS, computeAmount, CURRENCY } from './pricing';

// ── Promote checkout (payment half only — see PROMOTE_PAYMENT_INTEGRATION.md) ──
//
// Mirrors `waypoints/submitWaypoint.js`'s shape (student-facing write, own
// file rather than admin/adminSave.js, reuses uploadImage/insertImageRows
// rather than duplicating them) but writes to a new `promotions` table
// (supabase/promotions.sql), NOT `waypoints` directly — a promotion only
// ever becomes a real waypoint pin once BACHS confirms payment AND an admin
// approves it in the (not-yet-built) Promote review tab. Until then it's
// its own row with its own `status`/`payment_status` pair, deliberately
// decoupled from `waypoints.status`'s pending/approved/rejected vocabulary
// so "awaiting a student's money" and "awaiting an admin's judgment" can't
// be confused with each other.
//
// This file stops at "redirect the browser to BACHS's hosted checkout
// page." Everything past that — the webhook that actually flips
// `payment_status` to 'paid', and the admin tab that turns a paid
// promotion into a live pin/card — is the Edge Functions under
// `supabase/functions/` plus a follow-up admin-panel slice, not this file.

const PLATFORMS_REQUIRING_VALUE = new Set(['whatsapp', 'telegram', 'instagram', 'other']);

export function validatePromotionForm({
  businessName,
  listingType,
  lat,
  lng,
  contactPlatform,
  contactValue,
  days,
  photos,
}) {
  const errors = [];

  if (!businessName || !businessName.trim()) {
    errors.push('Business name is required.');
  }
  if (listingType !== 'physical' && listingType !== 'online') {
    errors.push('Choose whether this is a Physical Shop or an Online Store.');
  }
  if (listingType === 'physical') {
    if (lat === '' || lng === '' || lat == null || lng == null) {
      errors.push('Set a location — use GPS or search the map for your shop.');
    }
  }
  if (listingType === 'online') {
    if (PLATFORMS_REQUIRING_VALUE.has(contactPlatform) && !contactValue?.trim()) {
      errors.push('Add a contact link/handle so customers can reach you.');
    }
  }
  const numDays = Number(days);
  if (!Number.isFinite(numDays) || numDays < MIN_DAYS || numDays > MAX_DAYS) {
    errors.push(`Campaign duration must be between ${MIN_DAYS} and ${MAX_DAYS} days.`);
  }
  if ((photos?.length || 0) > MAX_PHOTOS) {
    errors.push(`Please attach at most ${MAX_PHOTOS} photos.`);
  }

  return errors;
}

/**
 * Builds the exact contact string handed to a customer (e.g.
 * "wa.me/2348012345678") from the platform + raw value — the same prefix
 * map `PromotePage.jsx`'s CONTACT_PLATFORMS defines. Kept in this file
 * (not re-imported from the page component, which shouldn't be imported
 * by anything else) so the stored `contact_link` is always a ready-to-use
 * URL/handle, not just the raw digits/username the person typed.
 */
const CONTACT_PREFIXES = {
  whatsapp: 'https://wa.me/',
  telegram: 'https://t.me/',
  instagram: 'https://instagram.com/',
};

function buildContactLink(platform, value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  if (platform === 'other') {
    // "Other" is already a free-typed link or phone number — don't prefix it.
    return trimmed;
  }
  const prefix = CONTACT_PREFIXES[platform];
  return prefix ? `${prefix}${trimmed.replace(/^\/+/, '')}` : trimmed;
}

/**
 * Inserts a new `awaiting_payment` promotion, uploads its photos, then
 * calls the `create-promotion-checkout` Edge Function to get a BACHS
 * hosted-checkout URL back. Returns `{ promotionId, checkoutUrl }` — the
 * caller (PromotePage.jsx) is responsible for the actual
 * `window.location.href = checkoutUrl` redirect, not this function, so a
 * calling test/story can intercept the URL instead of it firing for real.
 *
 * RLS enforcement (supabase/promotions.sql): a signed-in user can only
 * ever insert a row with `submitted_by = auth.uid()` and
 * `payment_status = 'unpaid'` — the checks below are client-side UX
 * (fail fast, friendly message), same "not a substitute for RLS" framing
 * submitWaypoint.js's own header comment uses.
 */
export async function submitPromotion({
  userId,
  businessName,
  description,
  listingType,
  lat,
  lng,
  contactPlatform,
  contactValue,
  days,
  photos, // { id, file, previewUrl }[]
}) {
  if (!userId) {
    throw new Error('Sign in first — a promotion has to be tied to your account.');
  }

  const errors = validatePromotionForm({
    businessName,
    listingType,
    lat,
    lng,
    contactPlatform,
    contactValue,
    days,
    photos,
  });
  if (errors.length) {
    throw new Error(errors[0]);
  }

  const amount = computeAmount(days);
  const contactLink = listingType === 'online' ? buildContactLink(contactPlatform, contactValue) : null;
  const promotionId = crypto.randomUUID();

  const { error: insertError } = await supabase.from('promotions').insert({
    id: promotionId,
    submitted_by: userId,
    business_name: businessName.trim(),
    description: description?.trim() || null,
    listing_type: listingType,
    lat: listingType === 'physical' ? Number(lat) : null,
    lng: listingType === 'physical' ? Number(lng) : null,
    contact_platform: listingType === 'online' ? contactPlatform : null,
    contact_link: contactLink,
    days: Number(days),
    amount,
    currency: CURRENCY,
    status: 'awaiting_payment',
    payment_status: 'unpaid',
  });
  if (insertError) throw insertError;

  // Photos are attached to the promotion row before checkout so a paid,
  // approved listing already has everything it needs — no second upload
  // step needed after the person comes back from BACHS. Best-effort per
  // file (same "note the failure, keep going" behavior as a failed image
  // shouldn't block a successful payment) rather than all-or-nothing.
  const paths = [];
  for (let i = 0; i < (photos?.length || 0); i++) {
    try {
      paths.push(await uploadImage('promotion', promotionId, photos[i].file, i));
    } catch (e) {
      track('error_occurred', { context: 'promotion_photo_upload', message: e?.message || String(e) });
    }
  }
  if (paths.length) {
    await insertImageRows('promotion_images', 'promotion_id', promotionId, paths);
  }

  const { data, error: fnError } = await supabase.functions.invoke('create-promotion-checkout', {
    body: { promotionId },
  });
  if (fnError) {
    throw new Error(
      fnError.message ||
        'Could not start payment. Your listing is saved as a draft — try checkout again in a moment.'
    );
  }
  if (!data?.checkoutUrl) {
    throw new Error('Payment could not be started (no checkout URL returned). Try again.');
  }

  track('promotion_checkout_started', { listing_type: listingType, days: Number(days) });

  return { promotionId, checkoutUrl: data.checkoutUrl };
}

/** Polled by PromoteCallbackPage.jsx after the BACHS redirect back — the
 * redirect itself proves nothing (a person can close the tab mid-payment
 * and BACHS still bounces them to success_url); the webhook-written
 * `payment_status` column is the only trustworthy signal. */
export async function fetchPromotionStatus(promotionId) {
  const { data, error } = await supabase
    .from('promotions')
    .select('id, status, payment_status, business_name')
    .eq('id', promotionId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
