import { supabase } from '../../lib/supabase';

// ── One ad per account at a time ─────────────────────────────────────────
//
// An account may only have one promotion in play: a second checkout is
// blocked while an earlier one is either
//   - 'live':   approved, still linked to its listing, and not yet ended, or
//   - 'review': paid and waiting for an admin to approve it.
// Unpaid/abandoned checkouts, rejected, removed and ended ads don't count.
//
// Used by PromotePage (notice + blocked checkout) and the profile tab in
// AuthModal (countdown). create-promotion-checkout repeats the same check
// server-side, so this is the friendly early warning, not the guard.

const DAY_MS = 24 * 60 * 60 * 1000;

/** Whole days left, counting today: 6 days 2 hours left reads as 7. */
export function daysLeft(endsAt, now = Date.now()) {
  const end = Date.parse(endsAt);
  if (Number.isNaN(end)) return 0;
  return Math.max(0, Math.ceil((end - now) / DAY_MS));
}

/**
 * @returns {Promise<
 *   | { status: 'none' }
 *   | { status: 'live', businessName: string, days: number, endsAt: string, daysLeft: number }
 *   | { status: 'review', businessName: string, days: number }
 *   | { status: 'error', message: string }
 * >}
 */
export async function fetchActivePromotion(userId) {
  if (!userId) return { status: 'none' };
  const { data, error } = await supabase
    .from('promotions')
    .select('business_name, days, status, payment_status, waypoint_id, promo_ends_at, paid_at')
    .eq('submitted_by', userId)
    .in('status', ['approved', 'pending_review'])
    .order('paid_at', { ascending: false, nullsFirst: false })
    .limit(20);
  if (error) return { status: 'error', message: error.message || 'Could not check your ads.' };

  const now = Date.now();
  const live = (data || []).find(
    (p) => p.status === 'approved' && p.waypoint_id && p.promo_ends_at && Date.parse(p.promo_ends_at) > now
  );
  if (live) {
    return {
      status: 'live',
      businessName: live.business_name,
      days: live.days,
      endsAt: live.promo_ends_at,
      daysLeft: daysLeft(live.promo_ends_at, now),
    };
  }

  const review = (data || []).find((p) => p.status === 'pending_review' && p.payment_status === 'paid');
  if (review) return { status: 'review', businessName: review.business_name, days: review.days };

  return { status: 'none' };
}

/** The sentence PromotePage shows when checkout is blocked. */
export function activePromotionNotice(active) {
  if (active?.status === 'live') {
    const d = active.daysLeft;
    return (
      `You already have an ad running for "${active.businessName}" (${d} day${d === 1 ? '' : 's'} left). ` +
      'You can place a new ad once it ends.'
    );
  }
  if (active?.status === 'review') {
    return (
      `Your ad for "${active.businessName}" is paid and waiting for approval. ` +
      'You can place a new ad once it has finished running.'
    );
  }
  return null;
}
