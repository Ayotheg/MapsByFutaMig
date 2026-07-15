# Maps By FUTA — React Migration Plan

**Source of truth:** `github.com/Ayotheg/MapsByFuta` @ `feature/login2`
**Destination:** `github.com/Ayotheg/MapsByFutaMig` @ `main` (Vite + React 19, JSX, Tailwind v4, react-router-dom 7)
**Backend:** migrating in parallel from Firebase → Supabase (see separate backend plan; this doc assumes Supabase is live by the time each slice starts touching data)

## How to use this document
Each slice below is a self-contained unit of work you can hand to a fresh LLM session. Work top to bottom — later slices assume earlier ones exist in the new repo. Don't skip ahead; several features quietly depend on ones above them (noted under "Depends on").

**Bundle-size & code-splitting policy** (see `CLAUDE.md`) is effective **starting Slice 4**. Slices 1–3 predate it and don't need retrofitting.

---

## Slice order (easiest/cheapest → hardest/most token-hungry)

### Slice 0 — Foundation (do once, before Slice 1)
Not a "feature," but required before anything else:
- Port design tokens (`BRAND_GUIDELINES.md`) into `src/styles/tokens.css`
- Wire tokens into Tailwind via `@theme` in `index.css`
- Self-hosted fonts (variable-font `@fontsource-variable` packages where available — see `BRAND_GUIDELINES.md`; **not yet switched over as of Slice 3, still on static per-weight packages**) + `lucide-react`
- Confirm Supabase client is wired up (`src/lib/supabase.js`)
- **Depends on:** nothing

---

### Slice 1 — Base map shell *(trivial)*
- Leaflet map init, OSM tile layer, `#map` container full-bleed
- Zoom-state class toggling (`_updateZoomClass`)
- Interaction start/end pausing animations mid-gesture (`_onInteractStart/End`)
- **Legacy source:** `app.js` lines ~55–98
- **Depends on:** Slice 0
- **Why first:** every other feature attaches to this map instance. Nothing to port visually except the map itself — lowest risk, cheapest to verify.

### Slice 2 — Waypoint markers & popups *(low)*
- `buildWaypointMarker`, `buildWaypointIcon`, `_buildGmStyleIcon`, `_wpColor`, `_hexToRgb`
- Two-tier rendering (circleMarker at low zoom → CSS-dot divIcon at close zoom)
- Place-card bottom panel (photo carousel, rating badge) replacing Leaflet popups
- `loadSavedWaypoints` (Supabase read) + local cache helpers
- **Legacy source:** `app.js` lines ~2307–2544, 2592–2780ish
- **Depends on:** Slice 1, Supabase `waypoints`/`waypoint_images` tables live

### Slice 3 — Legend / filter / layers panel *(low)*
- Place-type legend, category toggles, "All" quick-select
- Layer opacity slider, trail/boundary layer rows
- **Legacy source:** `index.html` lines ~123–522; `app.js` legend handlers ~5000ish
- **Depends on:** Slice 2 (toggles waypoint visibility)

### Slice 4 — Saved segments / routes *(low-medium)*
- `drawSavedSegment`, `loadSavedSegments`, save modal, detail modal
- Export builders: `buildGPX`, `buildKML`, `buildGeoJSON`, `downloadFile`
- **Legacy source:** `app.js` lines ~2033–2306, 2548–2891
- **Depends on:** Slice 1, Supabase `segments`/`segment_images` tables live
- **Also pick up while here:** the `#map` sidebar-offset gap flagged in
  `CLAUDE.md` Session Context (full-bleed map needs to react to the
  Slice-3 sidebar's collapsed state) — small, real, unresolved since
  Slice 3.

### Slice 5 — KML import/export pipeline *(medium)*
- Generic import pipeline (`processImportPipeline`), parsers for KML/GPX/GeoJSON text
- Annotation sanitizing (`_sanitiseAnnotationName`, `_cleanKmlDescription`, `_isUnknownAnnotationName`)
- Static KML file loading (`loadKML`, `bindKmlPopup`)
- **Legacy source:** `app.js` lines ~99–658, 1696–2032
- **Depends on:** Slice 2, Slice 4
- **Bundle-size note:** the admin-only KML upload sub-panel is a lazy-load candidate (see `CLAUDE.md`); the always-on static KML layer loading is NOT — that's needed on initial load.

### Slice 6 — OSM annotations *(medium)*
- `loadOSMAnnotations`, viewport-based rendering, dedup against your own waypoints (`_metersApart`, `_dedupNormName`, `_findDuplicate`)
- View-mode toggle (`applyViewMode`)
- **Legacy source:** `app.js` lines ~2896–3393
- **Depends on:** Slice 2, Slice 3

### Slice 7 — Search + Quick Chips *(medium-high)*
- Autocomplete dropdown (local + OSM), `doSearch`, `handleSearchInput`
- Desktop floating search bar + mobile floating search bar
- Quick suggestion chips, desktop floating results panel, mobile "Category Results" sidebar panel
- Route start/end input binding (`bindRouteInput`)
- **Legacy source:** `app.js` lines ~659–1220; `index.html` search/chip sections
- **Depends on:** Slices 2, 3, 6 (searches across waypoints + OSM)

### Slice 8 — Reviews & ratings *(medium-high)*
- Rating/comment modal, gated to rateable place types (`isRateablePOI`)
- Rating badge on popups/place cards (`_ratingBadgeHtml`)
- Supabase insert + trigger-based average recompute (already designed in backend plan)
- **Legacy source:** `app.js` lines ~2444–2507, ~2613–2743(ish, review modal block), ~7000ish submit handler
- **Depends on:** Slice 2; ties into Slice 9's arrival detection

### Slice 9 — GPS & Navigation *(high)*
- Accuracy gauge, position smoothing, dot/arrow markers, path simplification (Douglas-Peucker)
- OSRM turn-by-turn routing, nav HUD, turn icons, distance/ETA
- **Voice navigation** (Web Speech API `speak()`, voice toggle button)
- Arrival detection → triggers Slice 8's review modal
- **Legacy source:** `app.js` lines ~1221–1696, ~4333–4650ish (nav HUD/voice block)
- **Depends on:** Slices 2, 4, 7, 8 — largest single feature, most interdependent state (position, route, HUD, voice, arrival). Budget the most tokens here.
- **Bundle-size note:** lazy-load candidate (see `CLAUDE.md`) — only mounts once navigation actually starts. This is also the slice where the `manualChunks` vendor-splitting config and the `chunkSizeWarningLimit` revert (from 1000 back to default 500) should both land.

### Slice 10 — Auth *(high)*
- Login/Signup/Profile tabbed modal, Google OAuth + email/password (via Supabase Auth)
- Sidebar + mobile auth buttons with signed-in/out states
- Forgot password, sign-out
- Separate PIN-gate for admin panel entry
- **Legacy source:** `app.js` lines ~2744–3095ish (auth IIFE), PIN hash ~3569
- **Depends on:** Supabase Auth configured (Google OAuth client re-registered); ideally after Slice 8/9 since profile shows review/nav counts
- **Bundle-size note:** lazy-load candidate (see `CLAUDE.md`) — the auth modal only mounts when opened.
- **Also needed here:** the sidebar footer's Sign In button already exists as inert chrome (added during Slice 3) — this slice wires up its actual behavior.

### Slice 11 — Admin panel *(highest)*
- Waypoint + segment CRUD lists with search-filter
- Add-point coordinate picking mode, edit modal, image field management + thumbnails
- KML admin upload (file input, color picker, path input)
- Manual "sync" refresh
- **Legacy source:** `app.js` lines ~3692–4333ish
- **Depends on:** everything above — touches waypoints, segments, KML, images, auth (PIN gate). Do this last; it's the biggest and most stateful single piece, and benefits from every other data-layer pattern already being proven out.
- **Bundle-size note:** the single most important lazy-load candidate (see `CLAUDE.md`) — most campus users never open this at all.
- **Also needed here:** the sidebar footer's Admin toggle already exists as inert chrome (added during Slice 3) — this slice wires up its actual behavior.

### Slice 12 — Mobile-specific chrome *(cross-cutting, weave in per slice, don't do standalone)*
- Bottom sheet (peek/expanded, tabs), mobile FABs, mobile menu
- Not a separate slice on its own — each slice above should include its mobile treatment as part of that slice's scope, since the legacy CSS/JS already couples them tightly (e.g. search bar has a desktop version AND a mobile version built together).

---

## Rough token-cost ranking (easiest → hardest)
1. Slice 1 — Base map shell
2. Slice 2 — Waypoint markers & popups
3. Slice 3 — Legend/filter panel
4. Slice 4 — Saved segments/routes
5. Slice 5 — KML import/export pipeline
6. Slice 6 — OSM annotations + dedup
7. Slice 7 — Search + Quick Chips
8. Slice 8 — Reviews & ratings
9. Slice 9 — GPS & Navigation (incl. voice)
10. Slice 10 — Auth
11. Slice 11 — Admin panel

## Progress tracker
Update this after each slice ships — future LLM sessions should read this before starting new work.

| Slice | Status | Notes |
|---|---|---|
| 0 — Foundation | 🟨 Partial | Tokens, Tailwind `@theme` wiring done. Icon library changed from Bootstrap Icons to `lucide-react` — see `BRAND_GUIDELINES.md` Icons section and `src/lib/legacyIconMap.js`. Fonts are self-hosted but still on static per-weight `@fontsource/*` packages — switch to `@fontsource-variable/*` where available per `BRAND_GUIDELINES.md`, not yet done as of Slice 3. Supabase client wiring (`src/lib/supabase.js`) done as of Slice 2. |
| 1 — Base map | ✅ Done | `MapPage.jsx` now composes it (introduced in Slice 2). Full-bleed for now — real, unresolved gap: `#map` needs to react to the Slice 3 sidebar's collapsed state, see `CLAUDE.md` Session Context. `html`/`body` font-family uses `--font-ui`, deviating from a dead literal in legacy CSS. |
| 2 — Waypoints | 🟨 Partial | Code written, builds/lints clean — not yet run live end-to-end by a human against the real Supabase project (Slice 3's live test implies the data pipeline works, but that's inferred, not an explicit sign-off on this row — worth a direct pass). `pages/MapPage.jsx` introduced, composing MapShell + WaypointLayer + PlaceCard. **Deferred to Slice 4:** waypoint→segment photo fallback. **Deferred to Slice 8:** rating badge always renders its empty state (no `avg_rating`/`review_count` columns yet). **Deviation:** photo thumbnails/hero use `window.open()` on the full-res URL directly (legacy's segment-scoped lightbox doesn't apply — waypoint photos aren't segment-scoped). **Deviation:** legacy only ever builds a single `L.divIcon` per waypoint and fakes zoom-tier appearance entirely with CSS (`.zoom-far/mid/near/close`) — ported what the code does, not the plan's "canvas CircleMarker" paraphrase. **Font-mapping inference:** `.name` uses `--font-ui`/700 (legacy's literal CSS said `'Geist'`/800, treated as dead code); `.desc` uses `--font-body` as the closest documented token for prose. **Refactor for Slice 3:** `WaypointLayer` no longer calls `useWaypoints()` itself — `waypoints` is now a prop from `MapPage`, shared with the legend's filter counts, avoiding a duplicate Supabase read. |
| 3 — Legend/filter | ✅ Done | **Verified live by a human.** Legacy source: `index.html` ~79–522, 611–630, 1133–1154; `app.js` ~3296–3324 (rail), ~5320–5536 (layer panel/opacity/basemap), ~5542–5760 (mobile sheet), ~6154–6301 (place-type filter). New: `src/features/legend/` (`placeTypeGroups.js`, `useTypeVisibility.js`, `PlaceTypeFilter.jsx`, `LayersPanel.jsx`, `Sidebar.jsx`, `MobileSheet.jsx` + `.module.css` each). `PlaceCard.module.css` desktop anchor now correctly `left: var(--sidebar-total-w)` (was a Slice-2 placeholder pending this). **Added:** `.sidebar-footer` (Sign In + Admin toggle) as real-but-inert chrome — Sign In wires up in Slice 10, Admin toggle in Slice 11. GPS/Nav rail buttons + mobile tabs not opening anything yet is expected (Slice 9). **Flagged, ported as-is:** place-type filter's white-background/light-text low-contrast issue (a legacy CSS override conflict) — needs a decision on whether to actually fix or keep matching legacy. **Confirmed pre-existing legacy quirk, not a bug:** legend swatch colors ≠ actual marker pin colors for 8 place types — two separate color maps preserve this faithfully. **Correctly NOT ported (dead code in legacy):** group-header collapse/expand, group-level toggle checkboxes, legend stats strip/ALL-toggle/active-dot. **UI-only for now:** GPS Trail toggle dims its row but controls nothing (trail layer doesn't exist until Slice 9). **Basemap:** only "Light" renders, matching legacy's actual current HTML (no second `.basemap-thumb` exists to select "Dark"). **Deviation:** mobile sheet drag uses Pointer Events instead of legacy's touch/mouse listener pairs; sheet state is component-local instead of `body.mob-sheet-*` classes. **Still open:** the `#map` sidebar-offset gap — see `CLAUDE.md` Session Context, picking this up is now assigned to Slice 4. |
| 4 — Saved segments | ⬜ Not started | Bundle-size policy (see `CLAUDE.md`) is effective starting this slice. Also owns the `#map` sidebar-offset fix carried over from Slice 3. |
| 5 — KML import/export | ⬜ Not started | Admin KML upload sub-panel is a lazy-load candidate. |
| 6 — OSM annotations | ⬜ Not started | |
| 7 — Search + chips | ⬜ Not started | |
| 8 — Reviews | ⬜ Not started | |
| 9 — GPS & Nav | ⬜ Not started | Lazy-load candidate. Also where `manualChunks` vendor-splitting and the `chunkSizeWarningLimit` revert (1000 → 500) land — see `CLAUDE.md`. |
| 10 — Auth | ⬜ Not started | Lazy-load candidate (auth modal). Wires up the inert Sign In button added in Slice 3. |
| 11 — Admin panel | ⬜ Not started | Highest-priority lazy-load candidate. Wires up the inert Admin toggle added in Slice 3. |