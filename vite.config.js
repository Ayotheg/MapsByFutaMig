import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'


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
    tailwindcss()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined;
          if (id.includes('leaflet')) return 'leaflet';
          if (id.includes('@supabase')) return 'supabase';
          if (id.includes('/react-dom/') || id.includes('/react/') || id.includes('react-router-dom') || id.includes('scheduler')) return 'vendor';
          return undefined;
        },
      },
    },
  },
})
