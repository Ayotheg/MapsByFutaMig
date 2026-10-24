import { supabase } from '../../lib/supabase';
import { uploadImage } from '../admin/adminSave';
import { track } from '../../lib/analytics';

/**
 * /event form → `events` row (supabase/events.sql). Same split as
 * submitPromotion.js: these checks are for a friendly message; the insert
 * policy is the real enforcement.
 *
 *   Free     → inserted straight into 'pending_review'; returns { eventId }.
 *   Ticketed → inserted as 'awaiting_payment', then create-event-checkout
 *              returns a BACHS URL; returns { eventId, checkoutUrl }. Only
 *              bachs-webhook can mark it paid.
 */

// The page shows these prefixes in the link field, so people type only the code.
export const ONLINE_PREFIXES = {
  whatsapp: 'https://chat.whatsapp.com/',
  meet: 'https://meet.google.com/',
  telegram: 'https://t.me/',
};

export function buildOnlineLink(platform, value) {
  const trimmed = (value || '').trim();
  if (!trimmed) return null;
  // Pasting a whole link into a prefixed field still works.
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  const prefix = ONLINE_PREFIXES[platform];
  if (prefix) return `${prefix}${trimmed.replace(/^\/+/, '')}`;
  return /^[\w-]+(\.[\w-]+)+/.test(trimmed) ? `https://${trimmed}` : trimmed;
}

export function startsAtFrom(day, time) {
  if (!day || !time) return null;
  const d = new Date(`${day}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Returns the first problem as a sentence, or null when the form can be sent. */
export function validateEventForm({ entry, ticketPrice, title, organiser, day, starts, where, venue, venueName, link }) {
  if (entry !== 'free' && entry !== 'ticketed') return 'Choose free or ticketed in step 1.';
  if (entry === 'ticketed' && !(Number(ticketPrice) > 0)) return 'Add the ticket price.';
  if (!title?.trim()) return 'Add the event name.';
  if (!organiser?.trim()) return 'Add the organiser.';
  const startsAt = startsAtFrom(day, starts);
  if (!startsAt) return 'Pick the day and start time.';
  if (startsAt.getTime() <= Date.now()) return 'The start time has already passed.';
  if (where !== 'venue' && where !== 'online') return 'Choose a physical venue or online in step 3.';
  if (where === 'venue') {
    if (!venue) return 'Set the venue: search the map or use your current location.';
    if (!venueName?.trim()) return 'Add the venue name.';
  }
  if (where === 'online' && !link?.trim()) return 'Add the event link.';
  return null;
}

export async function submitEvent({
  userId,
  entry,
  ticketPrice,
  ticketNote,
  title,
  organiser,
  poster, // { file } | null
  day,
  starts,
  where,
  venue, // { lat, lng, waypointId }
  venueName,
  platform,
  link,
}) {
  if (!userId) throw new Error('Sign in first — an event has to be tied to your account.');

  const problem = validateEventForm({ entry, ticketPrice, title, organiser, day, starts, where, venue, venueName, link });
  if (problem) throw new Error(problem);

  const eventId = crypto.randomUUID();
  const ticketed = entry === 'ticketed';

  // Poster first, so the row is complete when it's inserted. Best-effort: a
  // failed upload shouldn't lose the whole listing.
  let posterPath = null;
  if (poster?.file) {
    try {
      posterPath = await uploadImage('event', eventId, poster.file, 0);
    } catch (e) {
      track('error_occurred', { context: 'event_poster_upload', message: e?.message || String(e) });
    }
  }

  const { error: insertError } = await supabase.from('events').insert({
    id: eventId,
    submitted_by: userId,
    title: title.trim(),
    organiser: organiser.trim(),
    poster_path: posterPath,
    starts_at: startsAtFrom(day, starts).toISOString(),
    entry_type: entry,
    ticket_price: ticketed ? Number(ticketPrice) : null,
    ticket_note: ticketed ? ticketNote?.trim() || null : null,
    location_type: where,
    venue_name: where === 'venue' ? venueName.trim() : null,
    venue_lat: where === 'venue' ? venue.lat : null,
    venue_lng: where === 'venue' ? venue.lng : null,
    venue_waypoint_id: where === 'venue' ? venue.waypointId || null : null,
    online_platform: where === 'online' ? platform : null,
    online_link: where === 'online' ? buildOnlineLink(platform, link) : null,
    // The checkout function sets the real fee for ticketed events.
    listing_fee: 0,
    status: ticketed ? 'awaiting_payment' : 'pending_review',
    payment_status: ticketed ? 'unpaid' : 'not_required',
  });
  if (insertError) throw new Error(friendlyInsertError(insertError));

  track('event_submitted', { entry_type: entry, location_type: where, has_poster: Boolean(posterPath) });

  if (!ticketed) return { eventId, checkoutUrl: null };

  const { data, error: fnError } = await supabase.functions.invoke('create-event-checkout', { body: { eventId } });
  if (fnError) {
    let serverMessage = null;
    try {
      serverMessage = (await fnError.context?.json?.())?.error || null;
    } catch {
      // body wasn't JSON
    }
    throw new Error(serverMessage || fnError.message || 'Could not start payment. Try again in a moment.');
  }
  if (!data?.checkoutUrl) throw new Error('Payment could not be started (no checkout URL returned). Try again.');

  track('event_checkout_started', {});
  return { eventId, checkoutUrl: data.checkoutUrl };
}

function friendlyInsertError(error) {
  if (error.code === '42P01' || /relation .*events.* does not exist/i.test(error.message || '')) {
    return 'Events are not set up yet (supabase/events.sql has not been run).';
  }
  if (error.code === '42501') return 'Could not save the event. Check the start time is in the future and try again.';
  return error.message || 'Could not save the event.';
}

/** Polled by the callback page after BACHS redirects back (and shown for free events). */
export async function fetchEventStatus(eventId) {
  const { data, error } = await supabase
    .from('events')
    .select('id, title, status, payment_status, entry_type')
    .eq('id', eventId)
    .maybeSingle();
  if (error) throw error;
  return data;
}
