import { isWebLink, longDate, placeLabel, timeRange } from './eventsData';
import { track } from '../../lib/analytics';

// Events without an end time are saved to calendars as two hours long.
const DEFAULT_LENGTH_MS = 2 * 60 * 60 * 1000;

function icsDate(d) {
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

// RFC 5545 text: escape \ ; , and newlines.
function icsText(s) {
  return String(s || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r?\n/g, '\\n');
}

/** Downloads a .ics file the phone/computer calendar opens. */
export function addEventToCalendar(event) {
  const start = new Date(event.startsAt);
  const end = event.endsAt ? new Date(event.endsAt) : new Date(start.getTime() + DEFAULT_LENGTH_MS);
  const location = event.online
    ? isWebLink(event.online.link)
      ? event.online.link
      : placeLabel(event)
    : event.venue?.name || '';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Maps By FUTA//Events//EN',
    'BEGIN:VEVENT',
    `UID:${event.id}@mapsbyfuta.xyz`,
    `DTSTAMP:${icsDate(new Date())}`,
    `DTSTART:${icsDate(start)}`,
    `DTEND:${icsDate(end)}`,
    `SUMMARY:${icsText(event.title)}`,
    `LOCATION:${icsText(location)}`,
    `DESCRIPTION:${icsText([event.organiser && `By ${event.organiser}`, event.about].filter(Boolean).join('\n'))}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];
  const blob = new Blob([lines.join('\r\n')], { type: 'text/calendar;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${(event.title || 'event').replace(/[^\w-]+/g, '-').slice(0, 40)}.ics`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  track('event_calendar_add', {});
}

/**
 * Native share sheet where there is one, otherwise copies the details.
 * Resolves to 'shared' | 'copied' | 'cancelled'.
 */
export async function shareEvent(event) {
  const text = `${event.title} · ${longDate(event.startsAt)}, ${timeRange(event)} · ${placeLabel(event)}`;
  const url = `${window.location.origin}/map`;
  track('event_share', {});
  if (navigator.share) {
    try {
      await navigator.share({ title: event.title, text, url });
      return 'shared';
    } catch {
      return 'cancelled';
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}\n${url}`);
    return 'copied';
  } catch {
    return 'cancelled';
  }
}

// The database only accepts http(s) links (events_hardening.sql); checked
// again here so nothing else is ever handed to window.open.
export function joinOnlineEvent(event) {
  if (!isWebLink(event.online?.link)) return;
  track('event_join_online', { platform: event.online.platform || 'other' });
  window.open(event.online.link, '_blank', 'noopener,noreferrer');
}
