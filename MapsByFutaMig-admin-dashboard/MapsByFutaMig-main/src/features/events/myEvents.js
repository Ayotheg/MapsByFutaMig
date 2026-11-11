import { supabase } from '../../lib/supabase';
import { lagosEndOfDay } from '../explore/eventsData';

// ── The account's events, for the profile card ───────────────────────────
//
// Same idea as promote/activePromotion.js (the "Ad running" card): shown in
// the profile (AuthModal) so people can see where their listing is without
// asking. Only events that need attention or are worth knowing about:
//   'unpaid'   — ticketed, listing fee not paid (cancelled/failed/expired
//                checkout): links to "Try payment again" on /event/callback
//   'review'   — free, or paid, and waiting for an admin
//   'live'     — approved and still in Explore (until the end of its day)
//   'rejected' — not approved in the last REJECTED_SHOW_DAYS, with reason
// Ended, removed and older rejected events are left out.

const DAY_MS = 24 * 60 * 60 * 1000;
const REJECTED_SHOW_DAYS = 7;
// Applied by the profile card after hiding cleared notices, so the next one
// moves up (clearedNotices.js).
export const MAX_EVENT_CARDS = 3;
const ORDER = { unpaid: 0, review: 1, live: 2, rejected: 3 };

// End of the event's day in Lagos, matching public_events().
const endOfDay = lagosEndOfDay;

function classify(e, now) {
  if (e.status === 'awaiting_payment' && ['unpaid', 'failed', 'expired'].includes(e.payment_status)) return 'unpaid';
  if (e.status === 'pending_review' && ['paid', 'not_required'].includes(e.payment_status)) return 'review';
  if (e.status === 'approved' && endOfDay(e.starts_at) >= now) return 'live';
  if (e.status === 'rejected' && e.reviewed_at && now - new Date(e.reviewed_at) < REJECTED_SHOW_DAYS * DAY_MS) {
    return 'rejected';
  }
  return null;
}

/**
 * @returns {Promise<{ status: 'ok', events: Array<{ id, title, startsAt, state, isFeatured, rejectionReason }> }
 *                 | { status: 'error' }>}
 * Events whose start time has passed are skipped unless already live (an
 * unpaid or unreviewed event for yesterday can't go live any more).
 */
/**
 * The profile card's "Remove" on an unpaid listing (events_owner_remove.sql).
 * Hides it rather than deleting it, so a payment still in flight is never
 * lost. Throws a sentence the card can show.
 */
export async function removeMyUnpaidEvent(eventId) {
  const { error } = await supabase.rpc('remove_my_unpaid_event', { p_id: eventId });
  if (!error) return;
  if (error.code === 'PGRST202' || /could not find the function/i.test(error.message || '')) {
    throw new Error("Removing isn't set up yet. Try again later.");
  }
  throw new Error(error.message || "Couldn't remove this event.");
}

export async function fetchMyEvents(userId) {
  if (!userId) return { status: 'ok', events: [] };
  const { data, error } = await supabase
    .from('events')
    .select('id, title, starts_at, status, payment_status, is_featured, rejection_reason, reviewed_at')
    .eq('submitted_by', userId)
    .in('status', ['awaiting_payment', 'pending_review', 'approved', 'rejected'])
    .order('created_at', { ascending: false })
    .limit(20);
  // Before supabase/events.sql exists, or offline: just show nothing.
  if (error) return { status: 'error' };

  const now = new Date();
  const events = (data || [])
    .map((e) => ({ e, state: classify(e, now) }))
    .filter(({ e, state }) => state && (state === 'live' || state === 'rejected' || new Date(e.starts_at) > now))
    .sort((a, b) => ORDER[a.state] - ORDER[b.state] || new Date(a.e.starts_at) - new Date(b.e.starts_at))
    .map(({ e, state }) => ({
      id: e.id,
      title: e.title,
      startsAt: e.starts_at,
      state,
      isFeatured: Boolean(e.is_featured),
      rejectionReason: e.rejection_reason,
    }));
  return { status: 'ok', events };
}
