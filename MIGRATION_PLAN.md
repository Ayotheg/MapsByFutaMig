# Maps By FUTA — React Migration Plan

**Source of truth:** `github.com/Ayotheg/MapsByFuta` @ `feature/login2`
**Destination:** `github.com/Ayotheg/MapsByFutaMig` @ `main` (Vite + React 19, JSX, Tailwind v4, react-router-dom 7)
**Backend:** migrating in parallel from Firebase → Supabase (see separate backend plan; this doc assumes Supabase is live by the time each slice starts touching data)

## How to use this document
Each slice below is a self-contained unit of work you can hand to a fresh LLM session. Work top to bottom — later slices assume earlier ones exist in the new repo. Don't skip ahead; several features quietly depend on ones above them (noted under "Depends on").

---

## Slice order (easiest/cheapest → hardest/most token-hungry)

### Slice 0 — Foundation (do once, before Slice 1)
Not a "feature," but required before anything else:
- Port design tokens (`BRAND_GUIDELINES.md`) into `src/styles/tokens.css`
- Wire tokens into Tailwind via `@theme` in `index.css`
- Self-hosted fonts (`@fontsource` packages) + `bootstrap-icons` npm package
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

### Slice 5 — KML import/export pipeline *(medium)*
- Generic import pipeline (`processImportPipeline`), parsers for KML/GPX/GeoJSON text
- Annotation sanitizing (`_sanitiseAnnotationName`, `_cleanKmlDescription`, `_isUnknownAnnotationName`)
- Static KML file loading (`loadKML`, `bindKmlPopup`)
- **Legacy source:** `app.js` lines ~99–658, 1696–2032
- **Depends on:** Slice 2, Slice 4

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

### Slice 10 — Auth *(high)*
- Login/Signup/Profile tabbed modal, Google OAuth + email/password (via Supabase Auth)
- Sidebar + mobile auth buttons with signed-in/out states
- Forgot password, sign-out
- Separate PIN-gate for admin panel entry
- **Legacy source:** `app.js` lines ~2744–3095ish (auth IIFE), PIN hash ~3569
- **Depends on:** Supabase Auth configured (Google OAuth client re-registered); ideally after Slice 8/9 since profile shows review/nav counts

### Slice 11 — Admin panel *(highest)*
- Waypoint + segment CRUD lists with search-filter
- Add-point coordinate picking mode, edit modal, image field management + thumbnails
- KML admin upload (file input, color picker, path input)
- Manual "sync" refresh
- **Legacy source:** `app.js` lines ~3692–4333ish
- **Depends on:** everything above — touches waypoints, segments, KML, images, auth (PIN gate). Do this last; it's the biggest and most stateful single piece, and benefits from every other data-layer pattern already being proven out.

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
| 0 — Foundation | 🟨 Partial | Tokens, Tailwind `@theme` wiring, self-hosted fonts done. Icon library changed from Bootstrap Icons to `lucide-react` — see `BRAND_GUIDELINES.md` Icons section and `src/lib/legacyIconMap.js`. Supabase client wiring (`src/lib/supabase.js`) is a separate track/session, not yet confirmed done — don't build on it until it is. |
| 1 — Base map | ✅ Done | Mounted directly at `/` in `App.jsx` (no `pages/` wrapper — see `CLAUDE.md` Folder structure note on when to introduce `pages/MapPage.jsx`). Full-bleed for now, no sidebar shell exists yet — swap `left: 0` back to `left: var(--sidebar-total-w)` in `MapShell.module.css` once one lands. `html`/`body` font-family uses `--font-ui`, deviating from a dead literal in legacy CSS — see `CLAUDE.md` Session Context if this needs revisiting. |
| 2 — Waypoints | 🟨 Partial | Code written, builds clean (`npx vite build`), lints clean — not yet run live end-to-end by a human against the real Supabase project. `src/lib/supabase.js` added (needs `.env.local`, see `.env.example`). `pages/MapPage.jsx` introduced (composes MapShell + WaypointLayer + PlaceCard) — this is the "chrome around the map" CLAUDE.md flagged as the trigger for that file to exist; `App.jsx`'s `/` route now points there instead of MapShell directly. **Deferred to Slice 4:** waypoint→segment photo fallback (a waypoint with no photos of its own no longer borrows its parent segment's photos — needs `segments`/`segment_images` join). **Deferred to Slice 8:** rating badge always renders its empty state — `waypoints` has no `avg_rating`/`review_count` columns; that data will come from a `reviews` table + Postgres trigger that doesn't exist yet. **Deviation:** legacy's photo-thumbnail click called a segment-scoped `openPhoto(idx, segId)` lightbox; since waypoint photos aren't segment-scoped, thumbnails/hero here just `window.open()` the full-res URL directly instead — same end-user result, no Slice-4 dependency. **Deviation:** legacy's plan description said "canvas CircleMarker at low zoom → CSS-dot divIcon at high zoom," but the actual legacy code only ever builds a single `L.divIcon` per waypoint and fakes the zoom-tier look entirely with CSS (`.zoom-far/mid/near/close` opacity/scale rules) — ported what the code does, not the plan's paraphrase. **Deviation:** `PlaceCard.module.css` desktop anchor uses `left: var(--pad-lg)` instead of `var(--sidebar-total-w)` — same placeholder MapShell already uses, since no sidebar shell exists yet; swap both together when one lands. **Font-mapping inference:** `.name` uses `--font-ui`/700 per `BRAND_GUIDELINES.md`'s documented decision (legacy's literal CSS said `'Geist'`/800); `.desc` uses `--font-body` as the closest documented token for prose, since that doc's "Usage pattern" section doesn't explicitly cover the description field — flag if either should be different. |
| 3 — Legend/filter | ⬜ Not started | |
| 4 — Saved segments | ⬜ Not started | |
| 5 — KML import/export | ⬜ Not started | |
| 6 — OSM annotations | ⬜ Not started | |
| 7 — Search + chips | ⬜ Not started | |
| 8 — Reviews | ⬜ Not started | |
| 9 — GPS & Nav | ⬜ Not started | |
| 10 — Auth | ⬜ Not started | |
| 11 — Admin panel | ⬜ Not started | |
