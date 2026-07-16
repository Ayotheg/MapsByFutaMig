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
6. Slice 6 — OSM annotations + dedup slice-6-OSM-annotations+dedup
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
| 4 — Saved segments | 🟨 Partial | **Scope split from the plan's literal line range — flagged, not guessed at.** `app.js` ~2033–2306 (`openSaveModal`/`saveToFbBtn`/`buildGPX`/`buildKML`/`buildGeoJSON`/`downloadFile`) turned out to have exactly one call site (`processImportPipeline`, ~line 1895) — it's structurally part of Slice 5's import pipeline, not reachable on its own, and its save handler writes straight to Firebase (`window.db`), which would violate "Supabase only" if ported now. Per direction from the person, **built only what's actually this slice**: `loadSavedSegments`→`useSegments.js`, `drawSavedSegment`→`SegmentsLayer.jsx` (+ `segmentPopup.css` for the Leaflet-injected popup), and `openDetailModal`/`#detailModal`→`DetailModal.jsx` + `.module.css`. **Save modal, export builders, and the Firebase→Supabase segment-insert are Slice 5's job**, not deferred-and-forgotten — pick them up there where `processImportPipeline` actually exists to call them. New folder: `src/features/segments/`. **Bundle-size policy** (effective starting this slice) applied: `DetailModal` is lazy-loaded via `React.lazy`/`Suspense` (verified via `npm run build` — splits into its own ~2.3 kB chunk); `SegmentsLayer` is NOT lazy (draws on first paint, same tier as `WaypointLayer`). `vite.config.js` untouched — no `chunkSizeWarningLimit` bump needed or made. **`#map` sidebar-offset gap (carried over from Slice 3) — fixed.** `Sidebar.jsx` now syncs its `collapsed` state onto `document.body.classList` (`sidebar-collapsed`), matching legacy's own approach (app.js ~3309/3320) instead of legacy's Firestore-era `#map` positioning being invented fresh; `MapShell.module.css` reacts to that class via `:global()`, with the mobile `left:0 !important` override preserved. **Schema assumption, unverified — flag before relying on it:** no `segments`/`segment_images` schema doc exists yet (`CLAUDE.md` still says "link to be added"). `useSegments.js` assumes `segments(id, name, description, category, points jsonb, distance, duration)` + `segment_images(segment_id, storage_path, position)`, mirroring the `waypoints`/`waypoint_images` normalization from Slice 2. **Deliberate deviation from legacy:** a segment's `waypoints` (shown in the detail modal) are NOT read from an embedded array (legacy's Firestore shape) — queried instead as `waypoints WHERE segment_id = seg.id`, since that column already exists live per Slice 2. Confirm the real schema matches before this is load-bearing. **Not ported:** `FUTA_SEARCH.register(...)` inside `drawSavedSegment` (~2579–2588) — no search index exists until Slice 7; revisit then. **First real usage of the "Modal shell" pattern** (`DetailModal`) — per "no premature shared components," stayed feature-local; Slice 5's save modal would be the second usage that should trigger extracting a shared `Modal` into `components/ui/`, don't pre-extract from this one. |
| 5 — KML import/export | 🟨 Partial | Code written, builds/lints clean (`npm run build`/`npm run lint` both pass) — **not yet run live end-to-end against a real Supabase project** (see schema/RLS flags below). New folder: `src/features/kml/` (`kmlAnnotationUtils.js`, `geoUtils.js`, `parsers.js`, `exportBuilders.js`, `useImportPipeline.js`, `segmentSave.js`, `StaticKmlLayer.jsx`, `ImportTrigger.jsx`, `KmlImportPanel.jsx`, `SaveModal.jsx` + `.module.css` files). Static KML assets copied from legacy `kml/*.kml` into `public/kml/`. Added `@tmcw/togeojson` npm dependency (legacy loaded a vendored `toGeoJSON` global via `<script>`; this port uses the maintained npm package instead). **Scope correction, cross-checked against real call sites (same discipline as Slice 4's split):** the plan's `app.js` ~99–658 range also contains the on-screen debug console, a toast/reverse-geocode click handler, and the start of `FUTA_SEARCH` (Slice 7) — none of those are this slice; only the KML sanitizing helpers + `loadKML`/`bindKmlPopup`/`loadKmlsStaggered` are. **Not ported:** a GeoJSON *import* parser — despite the plan bullet saying "KML/GPX/GeoJSON", the actual `adminImportInput` handler only branches on `.kml`/`.gpx`; GeoJSON only exists as an export format in legacy. Also not ported: `escapeHtmlJsString` (dead code — its one call site was an inline-`onclick` HTML string Slice 2 already replaced with a React callback). **Second real usage of the "Modal shell" pattern, as Slice 4 flagged would happen** — extracted `src/components/ui/Modal.jsx` + `.module.css` (incl. shared `.btn`/`.btnPrimary`/`.btnSecondary`/`.btnDanger` footer-button classes); `DetailModal.jsx` refactored to use it, `Detailmodal.module.css` trimmed to body-only styles. **Schema — corrected, not just assumed, this time:** `useSegments.js`'s Slice-4 guess turned out to be wrong in two ways once cross-checked against `FIREBASE_TO_SUPABASE_MIGRATION.md` (a real schema-design doc that's been sitting in the repo since the Slice 2 commit, just never linked from this doc's own table below) — there's no `segments.points` jsonb column (it's a separate `segment_points(segment_id, seq, lat, lng, ...)` table), and the distance/duration columns are `distance_m`/`duration_ms`, not `distance`/`duration`. Both fixed in `useSegments.js` and used correctly in the new `segmentSave.js` insert. See `useSegments.js`'s own header comment for the full cross-check. **Link this doc's "Supabase schema/RLS" row (below) to `FIREBASE_TO_SUPABASE_MIGRATION.md` now that it's actually been read for this.** **Still unconfirmed — flag before trusting live data or the save flow:** RLS is enabled on all five tables per that doc, but only `waypoints`/`waypoint_images` are confirmed to have real SELECT policies added in the dashboard; `segments`/`segment_points`/`segment_images` reads may currently come back silently empty rather than erroring, and the save flow's INSERTs (plus the `place-images` bucket upload) may need dashboard-side policies added before they'll succeed for an anonymous (no-auth-yet, pre-Slice-10) user. **Deliberate deviations:** `_adminData.waypoints`/`.segments` (an admin-panel cache that doesn't exist, Slice 11) replaced with the live `useWaypoints()`/`useSegments()` data already loaded by `MapPage`, passed down as props. Both hooks gained a `refetch()` return value so the save flow can refresh the map after inserting, replacing legacy's manual `drawSavedSegment`/`_adminData.segments.push`/cache-invalidate dance. Image uploads use real `File`s to Supabase Storage instead of legacy's FileReader→base64 (+ a 900KB canvas-downscale step that existed only to fit Firestore's 1MB document limit — nothing to work around with Storage). **Flagged placement decision, not silently guessed:** legacy's import trigger button lives inside the not-yet-built admin panel (Slice 11) — `Sidebar.jsx`'s `.adminBtn` is explicitly reserved chrome for that slice, so this couldn't hang off it without reaching into Slice 11's territory. Ships instead as its own small floating "Import" button (`ImportTrigger.jsx`, bottom-left) as a clearly-provisional stand-in — **Slice 11 should relocate/re-gate this behind real admin auth** once that panel and Slice 10's auth exist. **Bundle-size policy applied:** `KmlImportPanel` (file input + pipeline + `SaveModal`, pulls in `@tmcw/togeojson`) is lazy-loaded behind the small eager `ImportTrigger` button — verified via `npm run build`, splits into its own ~14 kB JS / ~3 kB CSS chunk. `StaticKmlLayer` is NOT lazy (first-paint tier, same as `WaypointLayer`/`SegmentsLayer`) — its `@tmcw/togeojson` usage does land in the main bundle as a result; that's expected per the policy, not an oversight. **Not ported (out of scope, belongs to later slices):** the KML→OSM dedup block (no OSM layer exists yet, Slice 6), `FUTA_SEARCH.register` (Slice 7), the `#mapLoader` progress-bar UI (no matching DOM/slice exists — the underlying staggered-batch *loading behavior*, 1 file at a time on mobile vs 3 on desktop, IS preserved since it's a real perf fix). `_infoMode` gate and canvas `_wpCanvasRenderer` skipped, matching Slice 2's own precedent in `WaypointLayer.jsx`. |
| 6 — OSM annotations | 🟨 Partial | Code written, builds/lints clean (`npm run build`/`npm run lint` both pass, 0 errors/0 warnings) — **not yet run live in a browser** (Overpass API call untested against real network response shapes beyond reading legacy's own handling of them). New folder: `src/features/osm-annotations/` (`osmAnnotationUtils.js` — pure `osmBadge`/`metersApart`/`dedupNormName`/`findDuplicate`; `useOSMAnnotations.js` — Overpass fetch + sessionStorage cache (same key/TTL as legacy) + reactive dedup; `useViewMode.js`; `OSMAnnotationLayer.jsx`; `ViewModeToggle.jsx` + `.module.css`). **Scope correction, same discipline as Slices 4/5:** the plan's `app.js` ~2896–3393 range also contains a one-time `window.runFirebaseDedupMigration` console utility (Firebase-only, explicitly a one-off dev tool — would violate "Supabase only" if ported, not built), `window.openPhoto`/`window.openKmlPhoto` (unrelated photo-lightbox handlers, not part of this feature), and — past line ~3296 — sidebar-rail tab switching (already ported differently in Slice 3's `Sidebar.jsx`) and admin-panel init (Slice 11). Only `loadOSMAnnotations`/dedup helpers/`_renderOSMItems` (~2870–3107) and the viewport-rendering/`applyViewMode` block (~3220–3295) are actually this slice. **Deliberate architectural deviation, flagged:** legacy runs dedup checks in *both* directions to cover load-order races — `_renderOSMItems` checks new OSM items against the existing `FUTA_SEARCH.index`, and separately `loadKML`'s `pointToLayer` checks each new KML point against already-loaded OSM entries (app.js ~237–263). This port does the OSM→existing-index direction only, but makes it *reactive* (`useOSMAnnotations`'s dedup is a `useMemo` over a live index prop, recomputed whenever waypoints/KML annotations change — not a one-shot check run once at fetch time), which covers both orderings inherently without needing a second, opposite-direction check. One real behavioral difference from legacy: when a KML point loads *after* an OSM entry is already showing, legacy keeps the OSM marker (building-centroid coords) and hides the KML one; this port always keeps the waypoint/KML marker as canonical and snaps+enriches it with the OSM data, regardless of load order. Net visual result is the same (one pin, richer info, positioned at the OSM/building coordinate) — just consistently resolved in one direction rather than depending on script timing. **`FUTA_SEARCH.index` doesn't exist yet (Slice 7):** `findDuplicate` takes an `index` array parameter instead of reading a global; the live index is built in `MapPage.jsx` from `waypoints` (prop, already loaded) + a new `kmlAnnotations` state populated via `StaticKmlLayer`'s new `onAnnotationsChange` callback (named points only, mirroring legacy's `!_isUnknownAnnotationName` gate before `FUTA_SEARCH.register`). **Segments intentionally excluded from the dedup index** — legacy's `FUTA_SEARCH.index` does contain segment entries (added via the admin edit modal, Slice 11, not `drawSavedSegment` itself per Slice 4's own note), but segments are routes/paths, not point places, and no evidence in the actual dedup call sites suggests OSM POIs are meant to dedupe against them; scoped out rather than guessed in. **View mode (`applyViewMode`) deviation:** legacy hides raw-mode markers via *both* a CSS kill-switch (`body.raw-mode .gm-pin-wrap{display:none}`) and an imperative batched `removeLayer()` pass over a single global `window._waypointLayers` array shared by all three marker sources. This port uses the CSS kill-switch only (ported verbatim into `waypointMarkers.css`) — `display:none` already drops pointer-event interaction, and it avoids WaypointLayer/StaticKmlLayer/OSMAnnotationLayer (three separate components here, not one array) each needing a toggle-driven removal pass. `Sidebar.module.css` gained a matching `body.raw-mode` opacity-0.3 rule for the Layers panel (legacy's `#panelLayers` dim). `ViewModeToggle` is desktop-only (rendered conditionally via `MapPage`'s existing `isMobile` flag, same pattern as Sidebar/MobileSheet), matching legacy's `≤768px { display:none }`; position reacts to `body.sidebar-collapsed` the same way `MapShell`'s offset was meant to (see next item). **Pre-existing doc/code mismatch found, not fixed (out of scope for this slice):** `CLAUDE.md`'s Session Context and the Slice 3/4 tracker rows both say the `#map` sidebar-offset gap was "fixed" in Slice 4, but `MapShell.module.css` as it actually stands is still `left: 0` with a stale "for now, once the sidebar shell lands..." comment — the sidebar shell *has* landed (Slice 3) but the offset was never actually wired up. `ViewModeToggle` positions itself correctly off `--sidebar-total-w`/`--sidebar-rail-w` regardless (it doesn't depend on `#map`'s own offset), so this didn't block Slice 6, but it's a real, currently-inaccurate claim in `CLAUDE.md` worth a future session correcting either the code or the doc. **Bundle-size policy:** OSM annotations are core always-on map content (same tier as `WaypointLayer`/`StaticKmlLayer`), not a candidate on `CLAUDE.md`'s lazy-load list — correctly NOT lazy-loaded. Main chunk grew from 628.20 kB → 635.64 kB (+7.4 kB, ~1.2%) per `npm run build`, well within noise. **Separately found, not fixed:** `vite.config.js` does not actually contain the `chunkSizeWarningLimit: 1000` override `CLAUDE.md`'s Bundle-size section describes as "currently set" — the file has no such option, so Vite's default 500 kB warning threshold is what's actually firing on every build (both before and after this slice's changes, confirmed by building the pre-Slice-6 tree too). Not touched here per `CLAUDE.md`'s own "leave it as-is until [Slice 9] rather than touching `vite.config.js` outside of a slice that actually needs to" — flagging the doc/reality gap for whoever next touches that file or that section of `CLAUDE.md`. |
| 7 — Search + chips | ⬜ Not started | |
| 8 — Reviews | ⬜ Not started | |
| 9 — GPS & Nav | ⬜ Not started | Lazy-load candidate. Also where `manualChunks` vendor-splitting and the `chunkSizeWarningLimit` revert (1000 → 500) land — see `CLAUDE.md`. |
| 10 — Auth | ⬜ Not started | Lazy-load candidate (auth modal). Wires up the inert Sign In button added in Slice 3. |
| 11 — Admin panel | ⬜ Not started | Highest-priority lazy-load candidate. Wires up the inert Admin toggle added in Slice 3. |