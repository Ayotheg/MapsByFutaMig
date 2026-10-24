import { useEffect, useState } from 'react';
import { supabase, getPlaceImageUrl } from '../../lib/supabase';
import { track } from '../../lib/analytics';

const PLATFORM_LABELS = { whatsapp: 'WhatsApp', meet: 'Google Meet', telegram: 'Telegram' };

// public_events() row (supabase/events.sql) → the shape the Explore cards
// and EventCard read (see eventsData.js).
function toCardEvent(r) {
  const ticketed = r.entry_type === 'ticketed';
  return {
    id: r.id,
    title: r.title,
    organiser: r.organiser,
    startsAt: r.starts_at,
    endsAt: r.ends_at,
    price: ticketed ? Number(r.ticket_price) || 0 : 0,
    priceNote: ticketed ? r.ticket_note || null : 'No ticket needed',
    poster: r.poster_path ? getPlaceImageUrl(r.poster_path) : null,
    about: r.about,
    isFeatured: Boolean(r.is_featured),
    venue:
      r.location_type === 'venue'
        ? { name: r.venue_name, hint: '', lat: Number(r.venue_lat), lng: Number(r.venue_lng) }
        : null,
    online:
      r.location_type === 'online'
        ? { platform: PLATFORM_LABELS[r.online_platform] || null, link: r.online_link }
        : null,
  };
}

/**
 * Approved, not-yet-over events for Explore → Events. Only fetched once the
 * Events tab is opened (`enabled`), then kept for the session.
 */
export function useEvents(enabled) {
  const [state, setState] = useState({ events: [], loading: false, loaded: false });

  useEffect(() => {
    if (!enabled || state.loaded) return undefined;
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    supabase.rpc('public_events').then(({ data, error }) => {
      if (cancelled) return;
      if (error) {
        // Before supabase/events.sql has run the function doesn't exist;
        // show an empty list rather than an error.
        track('error_occurred', { context: 'public_events', message: error.message });
        setState({ events: [], loading: false, loaded: true });
        return;
      }
      setState({ events: (data || []).map(toCardEvent), loading: false, loaded: true });
    });
    return () => {
      cancelled = true;
    };
  }, [enabled, state.loaded]);

  return state;
}
