import { escapeHtml } from '../../lib/escapeHtml.js';

// Wraps the parts of `text` that match `q` in <mark>…</mark>, returning an
// HTML string for `dangerouslySetInnerHTML` (SearchResultItem, NavDestPanel).
//
// SAFE BY CONSTRUCTION: `text` is usually a waypoint name that came from the
// database, so it is never inserted raw. The text is split on the matches
// FIRST and each piece is escaped separately; the only tags in the output
// are the <mark> tags added here. (Escaping the whole string first and then
// matching would let a query like "amp" match inside `&amp;` and corrupt
// the entity.)
export function highlight(text, q) {
  const s = String(text ?? '');
  if (!q) return escapeHtml(s);
  const re = new RegExp(`(${q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')})`, 'gi');
  // With one capture group, split() puts every match at an odd index.
  return s
    .split(re)
    .map((part, i) => (i % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join('');
}
