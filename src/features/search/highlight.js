import { escapeHtml } from '../../lib/escapeHtml.js';
import { STOPWORDS } from './searchEngine.js';

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function wrapMatches(s, re) {
  re.lastIndex = 0;
  // With one outer capture group, split() puts every match at an odd index.
  return s
    .split(re)
    .map((part, i) => (i % 2 === 1 ? `<mark>${escapeHtml(part)}</mark>` : escapeHtml(part)))
    .join('');
}

// Wraps the parts of `text` that match `q` in <mark>…</mark>, returning an
// HTML string for `dangerouslySetInnerHTML` (SearchResultItem, NavDestPanel).
//
// SAFE BY CONSTRUCTION: `text` is never inserted raw. It is split on matches
// FIRST and each piece is escaped separately; the only tags in the output
// are the <mark> tags added here.
export function highlight(text, q) {
  const s = String(text ?? '');
  const rawQ = String(q ?? '');
  const trimmed = rawQ.trim();
  if (!trimmed) return escapeHtml(s);

  const exactRe = new RegExp(`(${escapeRegex(rawQ)})`, 'gi');
  if (exactRe.test(s)) return wrapMatches(s, exactRe);

  if (trimmed !== rawQ) {
    const trimRe = new RegExp(`(${escapeRegex(trimmed)})`, 'gi');
    if (trimRe.test(s)) return wrapMatches(s, trimRe);
  }

  const rawTokens = (trimmed.toLowerCase().match(/[a-z0-9]+/g) || []).filter((t) => t.length >= 2);
  if (!rawTokens.length) return escapeHtml(s);

  const nonStop = rawTokens.filter((t) => !STOPWORDS.has(t));
  const tokens = [...new Set(nonStop.length ? nonStop : rawTokens)].sort((a, b) => b.length - a.length);
  const tokenRe = new RegExp(`(${tokens.map(escapeRegex).join('|')})`, 'gi');
  if (!tokenRe.test(s)) return escapeHtml(s);

  return wrapMatches(s, tokenRe);
}
