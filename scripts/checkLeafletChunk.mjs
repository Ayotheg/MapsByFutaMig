// Post-build guard: leaflet-rotate reads the global `L` the moment it runs,
// so in the built leaflet chunk `window.L = …` (src/features/map/
// leafletGlobal.js) must come before leaflet-rotate's first use of `L`.
// Production broke once with "L is not defined" when it didn't.
// Run after `vite build`: node scripts/checkLeafletChunk.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const dir = 'dist/assets';
const chunk = readdirSync(dir).find((f) => /^leaflet-.*\.js$/.test(f));
if (!chunk) {
  console.error('checkLeafletChunk: no dist/assets/leaflet-*.js — run vite build first');
  process.exit(1);
}
const code = readFileSync(join(dir, chunk), 'utf8');
const setGlobal = code.search(/window\.L\s*=/);
// leaflet-rotate's first line of code: `const domUtilProto = L.extend({}, L.DomUtil)`.
const rotateStart = code.search(/L\.extend\(\s*\{\s*\}\s*,\s*L\.DomUtil\s*\)/);
if (setGlobal === -1 || rotateStart === -1 || setGlobal > rotateStart) {
  console.error(
    `checkLeafletChunk: ${chunk} — window.L at ${setGlobal}, leaflet-rotate at ${rotateStart}. ` +
      'The global must be set first (see vite.config.js manualChunks).'
  );
  process.exit(1);
}
console.log(`ok: ${chunk} sets window.L before leaflet-rotate runs`);
