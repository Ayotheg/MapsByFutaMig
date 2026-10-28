import { WP_TYPE_LABELS } from '../waypoints/wpTypeMeta';

// Plain-English wording for the admin Insights tab. Raw event names
// (supabase analytics_events.event_name) never reach the screen.

// "What people tapped" labels. Admin actions and errors aren't things
// visitors tap, so they're left out of that list (null).
const TAP_LABELS = {
  app_opened: 'Opened the app',
  place_opened: 'Opened a place',
  search_query: 'Searched',
  search_result_selected: 'Picked a search result',
  nav_started: 'Started directions',
  nav_completed: 'Arrived',
  nav_abandoned: 'Stopped directions',
  nav_rerouted: 'Went off route',
  feature_panel_open: 'Opened a menu',
  review_submitted: 'Left a review',
  review_prompt_shown: 'Asked for a review',
  review_prompt_rate: 'Tapped "rate"',
  review_prompt_dismissed: 'Said no to a review',
  waypoint_suggested: 'Suggested a place',
  whatsapp_channel_click: 'Opened WhatsApp channel',
  whatsapp_prompt_shown: 'Saw WhatsApp invite',
  whatsapp_prompt_dismissed: 'Closed WhatsApp invite',
  explore_channel_click: 'Opened a channel',
  business_link_click: 'Opened a business link',
  promote_link_click: 'Tapped "get featured"',
  promotion_checkout_started: 'Started paying for an ad',
  add_event_click: 'Tapped "add your event"',
  event_submitted: 'Added an event',
  event_checkout_started: 'Started paying for an event',
  event_calendar_add: 'Saved an event to calendar',
  event_share: 'Shared an event',
  event_join_online: 'Joined an online event',
  install_video_open: 'Watched how to install',
  donate_click: 'Tapped donate',
  contact_click: 'Tapped contact',
  marketing_optin_answer: 'Answered the updates question',
  admin_action: null,
  error_occurred: null,
};

export function tapLabel(eventName) {
  if (eventName in TAP_LABELS) return TAP_LABELS[eventName];
  return humanize(eventName);
}

const PANEL_NAMES = {
  layers: 'Layers',
  explore: 'Explore',
  gps: 'Signal',
  navigate: 'Directions',
  admin: 'Admin',
  profile: 'Profile',
  suggest: 'Suggest',
};

export const SOURCE_LABELS = {
  map: 'Tapped on the map',
  search: 'Searched',
  explore: 'From Explore',
  list: 'From a category list',
  nearby: 'Nearby, during a trip',
  other: 'Other',
};

export function placeTypeLabel(type) {
  return WP_TYPE_LABELS[type] || humanize(type);
}

/** One line describing an event, for a visit's step list. */
export function describeStep(e) {
  const p = e.props || {};
  switch (e.event_name) {
    case 'app_opened':
      return p.returning ? 'Opened the app (been here before)' : 'Opened the app for the first time';
    case 'place_opened':
      return `Opened ${p.name || 'a place'}${SOURCE_SUFFIX[p.source] || ''}`;
    case 'search_query':
      return p.result_count === 0 ? `Searched "${p.query}", found nothing` : `Searched "${p.query}"`;
    case 'search_result_selected':
      return `Picked ${p.place_name || 'a result'} from search`;
    case 'nav_started':
      return `Started directions to ${p.to || 'a place'}`;
    case 'nav_completed':
      return `Arrived at ${p.to || 'the place'}`;
    case 'nav_abandoned':
      return `Stopped directions to ${p.to || 'a place'}`;
    case 'nav_rerouted':
      return 'Went off route, got new directions';
    case 'feature_panel_open':
      return `Opened ${PANEL_NAMES[p.panel] || humanize(p.panel || 'a')} menu`;
    case 'error_occurred':
      return 'Something went wrong';
    case 'admin_action':
      return 'Made an admin change';
    default: {
      const label = tapLabel(e.event_name);
      return label || humanize(e.event_name);
    }
  }
}

const SOURCE_SUFFIX = {
  map: ' on the map',
  search: ' from search',
  explore: ' from Explore',
  list: ' from a list',
  nearby: ' from nearby places',
};

/** Where someone was, from the page path. */
export function whereLabel(path) {
  if (!path || path === '/' || path.startsWith('/map')) return 'on the map';
  if (path.startsWith('/event')) return 'on the events page';
  if (path.startsWith('/promote')) return 'on the ads page';
  return `on ${path}`;
}

/** Presence status ("navigating to X") as a sentence. */
export function statusLabel(action) {
  if (!action) return 'Looking at the map';
  const s = String(action);
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function humanize(raw) {
  const s = String(raw || '').replace(/[_-]+/g, ' ').trim();
  return s ? s.charAt(0).toUpperCase() + s.slice(1) : '';
}

export function timeAgo(ms) {
  if (!ms) return '';
  const seconds = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (seconds < 10) return 'now';
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m`;
  return `${Math.floor(minutes / 60)}h`;
}

export function clockTime(iso) {
  return new Date(iso).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
}

export function shortDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

export function minutesLabel(seconds) {
  if (seconds == null) return '—';
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const m = Math.round(seconds / 60);
  return m < 60 ? `${m} min` : `${Math.floor(m / 60)}h ${m % 60}m`;
}

/** "↑ 12% from last week" style change, or null when there's nothing to compare. */
export function change(now, before, periodWord) {
  if (!before) return null;
  const pct = Math.round(((now - before) / before) * 100);
  if (pct === 0) return { dir: 'same', text: `Same as last ${periodWord}` };
  return { dir: pct > 0 ? 'up' : 'down', text: `${pct > 0 ? 'Up' : 'Down'} ${Math.abs(pct)}% from last ${periodWord}` };
}

export function fmt(n) {
  return Number(n || 0).toLocaleString();
}
