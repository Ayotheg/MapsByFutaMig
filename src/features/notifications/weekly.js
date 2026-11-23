// The weekly round-up as the admin Notify tab shows it. Mirrors
// build_weekly_digest() in supabase/push_notifications.sql — change both
// together. Plain module so scripts/weekly.test.mjs can run it in Node.

const HOUR = 3600 * 1000;
const SEND_HOUR_LAGOS = 18; // Sundays 6 pm

/** 'YYYY-MM-DD' of the Sunday the next round-up goes out (Lagos time). */
export function nextDigestDate(now = Date.now()) {
  const lagos = new Date(now + HOUR); // UTC+1, read with getUTC*
  const day = lagos.getUTCDay(); // 0 = Sunday
  let add = (7 - day) % 7;
  if (add === 0 && lagos.getUTCHours() >= SEND_HOUR_LAGOS) add = 7;
  const d = new Date(Date.UTC(lagos.getUTCFullYear(), lagos.getUTCMonth(), lagos.getUTCDate() + add));
  return d.toISOString().slice(0, 10);
}

const plural = (n, one, many) => `${n} ${n === 1 ? one : many}`;

/**
 * { title, body } the round-up would have, or null for a quiet week.
 * ann: { title, body, lead } | null · leadName: the chosen new place's name
 */
export function previewDigest({ places = 0, events = 0, ann = null, leadName = null }) {
  if (places === 0 && events === 0 && !ann) return null;
  const parts = [];
  if (places > 0) parts.push(plural(places, 'new place', 'new places'));
  if (events > 0) parts.push(plural(events, 'event this week', 'events this week'));

  if (ann?.lead) {
    return { title: ann.title, body: ann.body?.trim() || parts.join(' · ') };
  }
  if (leadName) {
    if (ann) parts.push(ann.title);
    return {
      title: `${leadName} is on the map${places > 1 ? `, plus ${places - 1} more` : ''}`,
      body: parts.join(' · '),
    };
  }
  if (ann) parts.push(ann.title);
  let title = 'Your week on campus';
  if (places > 0 && events === 0 && !ann) title = plural(places, 'new place on campus this week', 'new places on campus this week');
  else if (events > 0 && places === 0 && !ann) title = plural(events, 'event on campus this week', 'events on campus this week');
  return { title, body: parts.join(' · ') };
}
