// PostToolUse (Edit|Write): flags fonts and colours in NEW text that aren't
// in DESIGN_SYSTEM.md. Silent when everything is fine.
import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();
const input = JSON.parse(readFileSync(0, 'utf8'));
const file = input.tool_input?.file_path || '';
if (!/\.(css|jsx?|html)$/.test(file) || /tokens(-v2)?\.css$/.test(file) || /[\\/]\.claude[\\/]/.test(file)) process.exit(0);

const added = input.tool_input?.new_string ?? input.tool_input?.content ?? '';
const removed = input.tool_input?.old_string ?? '';
const read = (p) => { try { return readFileSync(join(root, p), 'utf8'); } catch { return ''; } };
const norm = (s) => s.trim().replace(/^['"]|['"]$/g, '').replace(/\s+Variable$/i, '').toLowerCase();

// Self-hosted fonts = @fontsource imports in src/index.css.
const installed = new Set(
  [...read('src/index.css').matchAll(/@fontsource(?:-variable)?\/([a-z0-9-]+)/g)].map((m) => m[1].replace(/-/g, ' ')),
);
const ds = read('DESIGN_SYSTEM.md');
const alternates = (ds.match(/Approved alternates[^:]*:\s*([^.]+)\./)?.[1] || '').split(',').map(norm).filter(Boolean);
const generic = new Set(['inherit', 'initial', 'unset', 'sans-serif', 'serif', 'monospace', 'system-ui', 'ui-sans-serif',
  'ui-monospace', 'ui-serif', '-apple-system', 'blinkmacsystemfont', 'segoe ui', 'roboto', 'helvetica', 'arial',
  'courier new', 'cursive', 'emoji']);

const fontsIn = (text) => {
  const out = new Set();
  for (const m of text.matchAll(/font-?family\s*:\s*([^;}\n]+)/gi)) {
    for (const part of m[1].replace(/var\([^)]*\)/g, '').split(',')) {
      const f = norm(part.replace(/[`'"},)]+$/g, ''));
      if (f) out.add(f);
    }
  }
  return out;
};
const before = fontsIn(removed);
const problems = [];
for (const f of fontsIn(added)) {
  if (before.has(f) || generic.has(f) || installed.has(f)) continue;
  problems.push(alternates.includes(f)
    ? `Font "${f}" is an approved alternate but not self-hosted. Ask the user before installing it (DESIGN_SYSTEM.md > Adding a font), or use var(--font-ui) / var(--font-display) / var(--font-mono).`
    : `Font "${f}" is not in DESIGN_SYSTEM.md and not installed. Use var(--font-ui) / var(--font-display) / var(--font-mono), or ask the user to approve installing it.`);
}

// Brand colours = hex values in design-system/tokens.json.
const hex6 = (h) => { h = h.toLowerCase().slice(1); return '#' + (h.length === 3 ? [...h].map((c) => c + c).join('') : h.slice(0, 6)); };
const brand = new Set([...read('design-system/tokens.json').matchAll(/"value":\s*"(#[0-9a-fA-F]{3,8})"/g)].map((m) => hex6(m[1])));
const hexIn = (text) => new Set([...text.matchAll(/#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)].map((m) => hex6(m[0])));
if (brand.size) {
  const oldHex = hexIn(removed);
  const bad = [...hexIn(added)].filter((h) => !brand.has(h) && !oldHex.has(h));
  if (bad.length) problems.push(`Colour ${bad.join(', ')} is not one of the 16 brand colours. Use the nearest variable from DESIGN_SYSTEM.md.`);
}

if (problems.length) {
  process.stderr.write(`Design check (${file.split(/[\\/]/).pop()}):\n- ${problems.join('\n- ')}\n`);
  process.exit(2);
}
