import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'
import { BASEMAP_STYLES } from './src/features/map/basemaps.js'

// ── Tile-caching (map-tile-caching-implementation-guide.md) ───────────
// `basemaps.js` is the single source of truth for tile URLs (per
// CLAUDE.md / the guide's own "Notes for Implementation"), so the
// Workbox `urlPattern` for each style is derived from that file's
// templates instead of a second, easy-to-drift-out-of-sync hardcoded
// copy here.
//
// Each `style.url` is a Leaflet template like
// 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png' — `{s}` is a
// subdomain placeholder, `{z}/{x}/{y}` are numeric tile coords. This
// turns that template into a RegExp Workbox can match real request
// URLs against, escaping the literal parts and substituting a
// subdomain alternation / `\d+` for the placeholders.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

function templateToRegExp(template, { subdomains } = {}) {
  const placeholder = /\{s\}|\{z\}|\{x\}|\{y\}|\{key\}|\{mapId\}/g;
  let out = '';
  let lastIndex = 0;
  let match;
  while ((match = placeholder.exec(template))) {
    out += escapeRegExp(template.slice(lastIndex, match.index));
    switch (match[0]) {
      case '{s}':
        out += subdomains ? `[${subdomains}]` : '';
        break;
      case '{z}':
      case '{x}':
      case '{y}':
        out += '\\d+';
        break;
      // A production tile provider (e.g. MapTiler) swapped in for the
      // raw OSM server — see basemaps.js's `prodUrl` — carries a map id
      // and an API key. Match either loosely so the generated service
      // worker keeps caching correctly whether or not
      // VITE_MAPTILER_KEY is set for a given deploy, without needing
      // this file touched again when it is.
      case '{key}':
        out += '[^&]+';
        break;
      case '{mapId}':
        out += '[^/]+';
        break;
      default:
        break;
    }
    lastIndex = placeholder.lastIndex;
  }
  out += escapeRegExp(template.slice(lastIndex));
  return new RegExp(`^${out}$`);
}

// One (or two, for a style with a `prodUrl` fallback pair — see
// basemaps.js) StaleWhileRevalidate runtimeCaching entry per basemap
// style, each in its own named cache so switching styles at runtime
// (`map._setBasemap`, MapShell.jsx) never evicts a different style's
// already-cached tiles.
const TILE_CACHE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // ~30 days
const TILE_CACHE_MAX_ENTRIES = 500; // per style; tune to campus bbox × zoom range used

const tileRuntimeCaching = BASEMAP_STYLES.flatMap((style) => {
  const templates = [style.url, style.prodUrl].filter(Boolean);
  return templates.map((template) => ({
    urlPattern: templateToRegExp(template, { subdomains: style.subdomains }),
    handler: 'StaleWhileRevalidate',
    options: {
      cacheName: `tiles-${style.id}`,
      expiration: {
        maxEntries: TILE_CACHE_MAX_ENTRIES,
        maxAgeSeconds: TILE_CACHE_MAX_AGE_SECONDS,
        purgeOnQuotaError: true,
      },
      // Only cache successful responses — never let a broken/partial
      // tile from a flaky connection poison the cache.
      cacheableResponse: {
        statuses: [200],
      },
    },
  }));
});


// https://vite.dev/config/
//
// Slice 9: CLAUDE.md's bundle-size policy says to add vendor-chunk
// stability here "once Slice 9's lazy boundary lands," plus revert
// `chunkSizeWarningLimit` from a claimed 1000 back to the default 500.
//
// Real, flagged mismatches found while doing this:
//  1. There was no `chunkSizeWarningLimit` override anywhere in this file
//     before this edit — confirmed by reading it directly, and consistent
//     with every prior slice's own tracker note ("vite.config.js
//     untouched"). Nothing has ever set it to 1000 in this repo, so
//     there's nothing to revert; the default (500) already applies and
//     stays that way.
//  2. CLAUDE.md's copy-pasted `manualChunks` snippet uses the plain
//     object-map form (`{ leaflet: [...], supabase: [...] }`). This repo
//     is on Vite 8, which bundles with Rolldown by default (hence
//     `rolldownOptions` instead of `rollupOptions` — real, this project
//     really is on Rolldown, not classic Rollup+esbuild) — confirmed by
//     `npm run build` actually failing with
//     `TypeError: manualChunks is not a function` when the object form
//     was tried verbatim. Rolldown's `manualChunks` only accepts the
//     function form, unlike classic Rollup which accepts either. Ported
//     the same intent (group leaflet / supabase / react+router into
//     stable long-term-cacheable vendor chunks) as a function instead.
export default defineConfig({
  plugins: [react(),
    tailwindcss(),
    // Map-tile caching only — see tile-caching-implementation-guide.md.
    // `manifest: false` because `public/site.webmanifest` and its
    // `<link rel="manifest">` already exist and are hand-maintained
    // (index.html); this plugin should not generate/inject a second
    // one. `globPatterns: []` disables Workbox's normal app-shell
    // precaching on purpose — this change is scoped to the raster base
    // tile layer only (per the guide's "Notes for Implementation"), not
    // a step toward making the whole app installable/offline-first,
    // which is still listed as "coming soon" in index.html's own FAQ
    // JSON-LD. Without a precache manifest, `injectManifest`-style
    // self.__WB_MANIFEST handling never engages — `generateSW` (the
    // default `strategies` mode) still runs and installs the service
    // worker purely to own the `runtimeCaching` routes below.
    VitePWA({
      registerType: 'autoUpdate',
      injectRegister: 'auto',
      manifest: false,
      workbox: {
        globPatterns: [],
        cleanupOutdatedCaches: true,
        runtimeCaching: tileRuntimeCaching,
      },
    }),
  ],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('leaflet')) return 'leaflet';
          if (id.includes('@supabase')) return 'supabase';
          // Slice 14: recharts gets its own key, per CLAUDE.md's bundle-size
          // policy — kept out of `vendor` so it doesn't bleed into the
          // react/react-dom/react-router-dom group; only the lazy-loaded
          // Insights tab pulls it in.
          if (id.includes('recharts') || id.includes('/d3-') || id.includes('victory-vendor')) return 'charts';
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('react-router-dom') || id.includes('scheduler')) return 'vendor';
          return undefined;
        },
      },
    },
  },
})