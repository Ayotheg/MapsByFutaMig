# CLAUDE.md — Maps By FUTA React Migration

Read this in full before writing any code. This file is handed to every new LLM
session working on this project, regardless of which feature slice they're
assigned. Fill in the "Session Context" block at the bottom with the specific
slice you're working on before starting.

## Project summary
Maps By FUTA is a Leaflet.js campus navigation web app for Federal University
of Technology Akure. It is being migrated in two parallel tracks:

1. **Backend**: Firebase (Firestore + Auth) → Supabase (Postgres + Auth +
   Storage). This is a **permanent** move — Firebase is being fully retired,
   not kept as a fallback.
2. **Frontend**: a single monolithic vanilla JS app (`app.js`, ~7,500 lines;
   `style.css`, ~8,000 lines; `index.html`, ~1,400 lines) → a new React app,
   ported **feature-by-feature**, never all at once.

## Non-negotiable rules

- **Never guess at legacy behavior.** The old app is the spec. If you're
  unsure what a feature is supposed to do, find the relevant function/section
  in the legacy source (paths below) and read it before writing new code.
  Do not invent behavior that "seems reasonable" — match what's there.
- **No TypeScript.** Plain JSX only.
- **No Tailwind defaults for color/spacing.** Tailwind is configured via
  `@theme` in `src/index.css` to read from the design tokens in
  `BRAND_GUIDELINES.md` / `src/styles/tokens.css`. Use `bg-primary`,
  `rounded-lg`, etc. — never `bg-blue-500`, `p-4` from Tailwind's own default
  palette, since that introduces colors/spacing outside the established
  brand system.
- **CSS approach**: CSS Modules (`Component.module.css`) for real component
  styles, colocated with the component. Tailwind utility classes for small
  inline tweaks only. If a Tailwind utility needs to beat a CSS Module rule,
  use the `!` prefix (e.g. `!p-4`) — don't fight the cascade with specificity
  tricks, Tailwind v4's layers already make CSS Modules win by default.
- **No premature shared components.** Build each feature's UI as its own
  component first. Only extract something into a shared component
  (`src/components/ui/`) the *second* time an identical pattern shows up —
  by then you have two real usages to base the shared API on instead of
  guessing. (Known candidates once we hit them: a Modal shell reused across
  4+ legacy modals, a SidebarPanel shell reused across 5+ legacy panels.)
- **One slice at a time.** Do not start work on a feature not assigned to
  this session, even if it looks small or related. Check
  `MIGRATION_PLAN.md`'s progress tracker first.
- **Raw Leaflet, not react-leaflet.** The map instance is managed imperatively
  via `useRef` + `useEffect`. This preserves the existing canvas-marker
  performance work (two-tier circleMarker/CSS-dot rendering) exactly —
  don't re-introduce it through a wrapper library.
- **Supabase only.** Do not write any Firebase code, even temporarily. If a
  feature's data isn't in Supabase yet, stop and flag it rather than
  reaching for Firebase as a shortcut.
- **Preserve mobile behavior.** Nearly every legacy feature has a distinct
  desktop AND mobile treatment (e.g. desktop floating search bar vs. mobile
  bottom-sheet search). Both need to be ported together as part of the same
  slice — mobile is not an afterthought or a separate pass.
- **Update the progress tracker** in `MIGRATION_PLAN.md` when a slice is
  done, with a one-line note on anything the next session should know
  (known issues, deliberate deviations, follow-ups).
- **Bundle-size & code-splitting policy** — see the dedicated section below,
  **effective starting Slice 4**. This is a load-bearing rule, not a
  suggestion: skipping it is how a feature-by-feature migration quietly
  turns into one giant JS payload by Slice 11.

## Bundle-size & code-splitting policy

*Effective starting Slice 4.* Slices 1–3 predate this policy and don't need
retrofitting — none of them (base map, waypoints, legend/filter) are on the
"known candidates" list below anyway, so nothing was actually missed. Every
slice from 4 onward should be built with this in mind from the start.

This exists because raising Vite's `chunkSizeWarningLimit` is *not* an
acceptable fix for a growing bundle — it silences the warning, it doesn't
shrink anything. **Do not raise that number again.** It's currently set to
1000 in `vite.config.js` (raised from Vite's default 500) — that was a
stopgap from before this policy existed. Revert it back to the default once
Slice 9's lazy boundary (below) lands; leave it as-is until then rather than
touching `vite.config.js` outside of a slice that actually needs to.

**The rule:** any component that is not needed for the very first paint of
the map — a modal, a panel that isn't open by default, or an entire feature
slice that most users won't touch every session — must be lazy-loaded.
Small, ubiquitous UI atoms (icons, buttons, the place card that's core to
Slice 2, the sidebar/legend that's core to Slice 3) must NOT be lazy — that
just adds pointless waterfalls for things everyone needs immediately.

**Known candidates** (update this list as slices land):
- Slice 9 (Navigation/GPS HUD) — only mounts once a user actually starts
  navigating, not on initial map load
- Slice 10 (Auth modal) — only mounts when the user opens it
- Slice 11 (Admin panel) — the biggest slice by far, and the one an ordinary
  campus user never opens at all. This one matters most.
- Slice 5's admin-only KML upload sub-panel (distinct from the always-on KML
  static-layer loading, which is NOT lazy — that's needed on initial load)

**The exact pattern to copy** — every session should implement this the same
way, so it doesn't end up done three different inconsistent ways across
slices:

```jsx
import { lazy, Suspense } from 'react';

const AdminPanel = lazy(() => import('../features/admin/AdminPanel'));

// inside the component that conditionally shows it:
{adminOpen && (
  <Suspense fallback={null}>
    <AdminPanel />
  </Suspense>
)}
```

`fallback={null}` is intentional and fine here — these are all
user-triggered (a button click opens the admin panel/auth modal/nav HUD),
so there's already a natural "loading" moment implied by the click; don't
build a shared skeleton/spinner component up front just for this. If a
specific case genuinely needs a visible loading state, an inline one-off
`<div>` is fine — it doesn't need to graduate to `components/ui/` unless a
second, truly identical loading-state pattern shows up later.

**Vendor chunk stability** — apply this in `vite.config.js` once Slice 9
starts pulling in heavier dependencies. It pins large, rarely-changing
libraries to their own permanently-named chunks, so a deploy that only
changes app code doesn't force returning visitors to re-download
Leaflet/Supabase/React again:

```js
build: {
  rolldownOptions: {
    output: {
      manualChunks: {
        leaflet: ['leaflet'],
        supabase: ['@supabase/supabase-js'],
        vendor: ['react', 'react-dom', 'react-router-dom'],
      },
    },
  },
}
```

**Fonts**: switch the static per-weight `@fontsource/*` packages to the
`@fontsource-variable/*` equivalents where available — one file per family
covering the full weight range instead of 5–6 static files each. Same
visual result, meaningfully less static payload. See `BRAND_GUIDELINES.md`
for the exact package names — this hasn't been done yet as of Slice 3; do
it the next time `index.css`'s font imports are touched rather than leaving
it as a standing gap indefinitely.

**Icons**: already handled correctly — `lucide-react` is tree-shaken by
default (only the ~26 icons actually imported end up in the bundle, unlike
an icon-font approach which ships all ~1,700/2,000 icons regardless of
usage). No further action needed here.

**Per-slice check before marking anything done**: run `npm run build` and
look at the reported chunk sizes. If a newly-added feature pushed the main
chunk up noticeably and it's one of the "known candidates" above (or looks
like it should be), add its lazy boundary *in that same slice* — don't
defer it. Retrofitting a lazy boundary after 3 more slices have been built
on top of the unsplit feature is more invasive than doing it at the time.

## Folder structure

Flat and predictable — max two levels deep under `src/`, no exceptions.
This has to stay legible across 12 slices and many separate LLM
sessions, so don't improvise on it.

```
src/
├── main.jsx
├── App.jsx                  # route table only — no page/feature logic here
├── index.css                 # tokens import, @theme wiring, base reset
│
├── pages/                    # one file per ROUTE, thin — composes features,
│   ├── LandingPage.jsx       # doesn't contain feature logic itself
│   ├── LoadingScreen.jsx
│   ├── MapPage.jsx           # composes MapShell + WaypointLayer + PlaceCard
│   │                         # + Sidebar/LayersPanel/MobileSheet; single
│   │                         # useWaypoints() call shared across features
│   └── NotFoundPage.jsx
│
├── features/                 # one folder per SLICE from MIGRATION_PLAN.md
│   ├── map/                  # Slice 1
│   │   ├── MapShell.jsx
│   │   └── MapShell.module.css
│   ├── waypoints/            # Slice 2
│   ├── legend/                # Slice 3 — placeTypeGroups.js, useTypeVisibility.js,
│   │                          # PlaceTypeFilter.jsx, LayersPanel.jsx, Sidebar.jsx,
│   │                          # MobileSheet.jsx + .module.css for each
│   ├── segments/               # Slice 4
│   ├── kml/                     # Slice 5
│   ├── osm-annotations/          # Slice 6
│   ├── search/                    # Slice 7
│   ├── reviews/                    # Slice 8
│   ├── navigation/                  # Slice 9 (GPS + nav + voice, all of it)
│   ├── auth/                          # Slice 10
│   └── admin/                          # Slice 11
│
├── components/ui/            # SHARED components only — Modal shell,
│                              # SidebarPanel shell, etc. Empty until a
│                              # second slice needs an identical pattern,
│                              # per the "no premature shared components"
│                              # rule above. Don't create this folder
│                              # speculatively.
│
├── lib/                       # non-component code: data/lookup tables,
│   ├── legacyIconMap.js       # the Supabase client, constants, pure
│   └── supabase.js            # helper functions. No JSX in here.
│
└── styles/
    └── tokens.css              # design tokens only — see BRAND_GUIDELINES.md
```

**The hard rule:** everything a feature needs — its component(s), its
`.module.css`, any feature-local helper — lives flat inside its own
`src/features/<slice>/` folder. Do not create a third level (no
`features/navigation/components/NavHud/NavHud.jsx`, no
`features/navigation/hooks/useVoice.js`). If a slice grows enough
sub-pieces that a flat folder feels crowded, that's still fine — five
or six colocated files in one folder beats three levels of nesting to
find them. Multiple `.jsx` files at that one level, differentiated by
name (`NavHud.jsx`, `VoiceControl.jsx`, `TurnIcons.jsx`), not by
subfolder.

Route-level files go in `pages/`, not `features/`. A page composes one or
more features; it shouldn't contain feature logic itself. `pages/MapPage.jsx`
was introduced as part of Slice 2 (once the map needed chrome around it —
originally `MapShell` was mounted directly at `/`) and now, as of Slice 3,
also composes the sidebar/legend features and owns the single shared
`useWaypoints()` call. If you're looking at an older commit where
`MapShell` is still mounted directly in `App.jsx`, that predates Slice 2.

`components/ui/` stays empty until the *second* real usage of an identical
pattern shows up (the Modal shell and SidebarPanel shell are the two known
future candidates — see Non-negotiable rules above). Don't scaffold it
early "just in case."

| What | Location |
|---|---|
| Legacy source of truth | `github.com/Ayotheg/MapsByFuta`, branch `feature/login2` |
| New React app | `github.com/Ayotheg/MapsByFutaMig`, branch `main` |
| Full feature list + slice order | `MIGRATION_PLAN.md` |
| Design tokens / brand system | `BRAND_GUIDELINES.md` |
| Supabase schema/RLS | `FIREBASE_TO_SUPABASE_MIGRATION.md` — its Step 0 SQL is the real target schema. Landed in the Slice 2 commit but sat unlinked here until Slice 5 actually cross-checked `useSegments.js` against it and found real mismatches — see MIGRATION_PLAN.md's Slice 5 row. Still not confirmed against a *live* database (RLS policy state in particular — see that same row). |

## How to work a slice

1. Read `MIGRATION_PLAN.md`, find your assigned slice, note its "Legacy
   source" line numbers and "Depends on" list.
2. Confirm every dependency in "Depends on" is already marked done in the
   progress tracker. If not, stop and flag it — don't build on top of
   something that doesn't exist yet.
3. Pull the actual legacy code at those line ranges from `app.js`/`index.html`/
   `style.css` on `feature/login2` — read it fully before writing anything.
4. Port it into the new repo as its own component(s), using the design
   tokens for all styling, CSS Modules for structure, matching legacy
   behavior exactly unless the person working with you says otherwise.
   Apply the bundle-size policy above if this slice is on (or looks like it
   should be added to) the "known candidates" list.
5. Note anything ambiguous or any deliberate deviation from legacy behavior
   clearly, and ask the person before assuming.
6. Update the progress tracker.

---

## Session Context *(fill in before starting a new session)*

- **Slice being worked on:** Slice 10 (Auth) — **built this session**, see
  `MIGRATION_PLAN.md`'s progress tracker for full detail. Build/lint both
  run clean this session (`npm run build`/`npm run lint`, 0 errors/0
  warnings, network access available). **Not yet run live** — Google
  OAuth especially needs its client re-registered under Supabase Auth
  first (external, not verifiable from the repo — `FIREBASE_TO_SUPABASE_
  MIGRATION.md`'s Step 5 already flagged this). New folder:
  `src/features/auth/` (`useAuth.js`, `adminPin.js`, `useAdminPin.js`,
  `AuthModal.jsx`+`.module.css`, `AdminPinGate.jsx`+`.module.css`).
  **Scope correction, same discipline as every slice since 4:** the
  plan's `app.js` ~2744–3095 range for the auth IIFE was wrong (that's
  `_cacheRead`/OSM-dedup code) — real `initFutaAuth()` is ~7073–7421,
  corrected in the plan's own Slice 10 entry. **No React Context added**
  — `useAuth()` called once in `MapPage.jsx`, passed down as props, same
  convention as `gps`/`viewMode`. `AuthModal`/`AdminPinGate` are both
  deliberately bespoke, not built on `components/ui/Modal.jsx` — legacy's
  own DOM structure for both genuinely doesn't fit Modal's enforced
  header+body(+footer) shape. `AdminPinGate`/`useAdminPin.js` are built
  but **not called from anywhere yet** — same "machinery built, next
  slice wires it" call Slice 8 made for `ReviewModal`; Slice 11 wires
  `Sidebar.jsx`'s Admin toggle to actually call `requestAdminAccess()`.
  Schema: `FIREBASE_TO_SUPABASE_MIGRATION.md`'s new "Step 7"
  (`reviews.user_id` + a `profiles` table for review/nav counts, not yet
  applied to the live database). `nav_count` has no writer wired this
  session — flagged deliberately, legacy's own signal for it is a
  dismissal counter, not a completion counter, porting it faithfully
  means porting a bug. Also created `.env.example` (referenced by
  `README.md`/`src/lib/supabase.js` since Slice 2, never actually
  committed — an unrelated pre-existing gap, fixed in passing since its
  contents were unambiguous). Full detail + every flagged decision (the
  two dead-CSS-variable findings, the PIN hash port, the profile-stats
  query design) in the tracker row.
- **Slice 9 (GPS & Navigation)** — see `MIGRATION_PLAN.md`'s tracker row
  for full detail. Build/lint both run clean that session (network access
  was available then too). New folder: `src/features/navigation/` (12
  files). `src/features/kml/geoUtils.js` promoted to
  `src/lib/geoUtils.js`. `ReviewModal` (built Slice 8, unwired) was wired
  up that session, triggered by nav arrival — this session (10) adds
  `user_id` attribution to it. `PlaceCard`'s "Navigate Here" and
  `MobileSearchBar`'s nav trigger were wired. Two real doc/reality
  mismatches were found and fixed in `vite.config.js` itself (no
  `chunkSizeWarningLimit` override ever existed; `manualChunks`'s
  object-map form fails on this repo's actual Vite 8 + Rolldown bundler,
  rewritten as the function form). The `#map` sidebar-offset gap (Slice 4
  claimed fixed, Slice 6 found still broken) was genuinely fixed that
  session.
- **Slice 8 (Reviews & ratings)** — see `MIGRATION_PLAN.md`'s tracker row
  for full detail. Build/lint could not be run in that session (no
  network); confirmed clean now, in this session, before Slice 9 code was
  added on top. New folder: `src/features/reviews/`. Schema added to
  `FIREBASE_TO_SUPABASE_MIGRATION.md`'s "Step 6" — not yet applied to the
  live database, still needs an INSERT RLS policy added before
  submissions will actually work. `ReviewModal` was built but deliberately
  left unwired that session (no trigger existed yet) — Slice 9 (above) is
  what wired it.
- **Mobile view-mode toggle gap — resolved this session, not still open.**
  Slice 7 flagged that mobile had no way to toggle view mode
  (`ViewModeToggle` is desktop-only by design) and assigned building
  `.mob-fab-cluster` to whoever picked up Slice 9. Done: `MobFabCluster.jsx`
  now holds the locate/view-toggle/auth FABs, `#mobViewToggleBtn`'s
  equivalent wired to the same `toggleViewMode` desktop uses.
- **`lib/legacyIconMap.js`'s `FLAGGED_ICONS` resolved this session** — both
  `football` and `mosque` (no confirmed Lucide equivalent, open since
  Slice 2/6) now have hand-drawn custom SVGs (`lib/MosqueIcon.jsx`/
  `FootballIcon.jsx`, 24×24/2px-stroke/round-caps/no-fill, matching
  Lucide's own spec) at the person's explicit request. `FLAGGED_ICONS` is
  now `[]`; if a future slice hits a *different* unmapped `bi-*` icon,
  same rule still applies — flag before guessing, don't assume this list
  staying empty means every icon is covered.
- **Schema doc found and linked this session — read before assuming it's
  still "TBD":** `FIREBASE_TO_SUPABASE_MIGRATION.md` has been sitting in
  the repo since the Slice 2 commit with the real target schema, but this
  doc's own "Supabase schema/RLS" link said "TBD" the whole time — nobody
  had connected the two. Slice 4's `segments`/`segment_images` guess turned
  out to be *close* but not exact once actually checked against it — see
  `useSegments.js`'s header comment and the Slice 5 tracker row for the
  full diff. Lesson for future sessions: check the repo root for a schema
  doc under any plausible name before assuming one doesn't exist just
  because this table says so.
- **Scope correction made this session — read before trusting the plan's
  line ranges blindly elsewhere:** `MIGRATION_PLAN.md`'s Slice 4 entry
  originally pointed at `app.js` ~2033–2306 for "save modal" + export
  builders. Tracing actual call sites showed `openSaveModal()` is only ever
  invoked from inside `processImportPipeline` (Slice 5), and its save
  button writes directly to Firebase — porting it under Slice 4 would have
  meant building unreachable, rule-violating code. Flagged to the person,
  who confirmed: build only what's genuinely Slice 4 (segment viewer),
  leave the save modal for Slice 5. Point of this note: the plan's legacy
  line ranges are a starting pointer, not gospel — still read the actual
  code and check call sites before trusting a range's boundaries.
- **Bundle-size policy reminder:** effective starting Slice 4. Applied this
  session: `DetailModal` is lazy-loaded (`React.lazy`/`Suspense`, confirmed
  via `npm run build` splitting it into its own chunk); `SegmentsLayer` is
  not (first-paint tier, same as `WaypointLayer`). `vite.config.js` still
  untouched — no need yet.
- **Legacy line ranges read so far:** `app.js` lines ~55–98 (Slice 1);
  ~2280–2560, ~2592–2790, ~5995–6140 (Slice 2 — waypoint markers,
  `loadSavedWaypoints`, place-card controller); `index.html` ~1155–1216
  (Slice 2 — place-card markup); `style.css` ~2690–2820, ~3900–4130
  (Slice 2 — wp-popup/gm-pin/place-card CSS); `index.html` ~79–630,
  ~1133–1154; `app.js` ~3296–3324, ~5320–5760, ~6140–6301; `style.css`
  ~155–440, ~935–1360, ~3250–3620, ~4290–4680 (Slice 3 — sidebar shell,
  layer panel, place-type filter, mobile sheet); `app.js` ~1592–1895
  (traced only to find `openSaveModal`'s call site — not ported),
  ~2548–2852 (Slice 4 — `drawSavedSegment`, `loadSavedSegments`,
  `openDetailModal`); `index.html` ~757–765 (Slice 4 — detail modal
  markup); `style.css` ~127–144 (`#map` sidebar-offset rules, now ported),
  ~1406–1449, ~1603–1632, ~2669–2684, ~2925–2926, ~3274–3280, ~3646–3652
  (Slice 4 — modal shell, detail-*, seg-popup, mobile #map/modal overrides);
  `app.js` ~99–658 (Slice 5 — read in full; only ~99–380 (KML sanitizing
  helpers + `loadKML`/`bindKmlPopup`/`loadKmlsStaggered`) turned out to be
  this slice, the rest is debug console/toast/`FUTA_SEARCH` — not ported,
  see tracker row), ~1696–2306 (Slice 5 — `processImportPipeline`,
  `parseKMLText`/`parseGPXText`, `openSaveModal`, image handling,
  `buildGPX`/`buildKML`/`buildGeoJSON`, `saveToFbBtn`), ~1592–1696 (Slice 5
  — `haversine`/`simplifyPath` Douglas-Peucker helpers, also needed by the
  not-yet-built Slice 9); `index.html` ~695–757 (Slice 5 — save modal
  markup); `style.css` ~1450–1601 (Slice 5 — field-group/waypoint-item/
  image-upload-zone/export-toggle/save-status); `app.js` ~2420–2456
  (Slice 8 — `POI_RATEABLE_TYPES`/`isRateablePOI`/`_ratingBadgeHtml`,
  matched the plan's line range fine), ~2590–2760 (Slice 8 — traced to
  confirm the plan's "~2613–2743 review modal" range was actually
  `loadSavedWaypoints`/cache helpers, not reviews — already covered by
  Slice 2, not re-ported here), ~4930–4975 (Slice 8 — read only to
  confirm `arrivedAtDestination`/`finishArrival`'s `POI_REVIEW.open(...)`
  call site; not ported, that's Slice 9), ~6934–7066 (Slice 8 — the real
  `initPoiReview()` review modal, found via `grep -n -i review app.js`
  after the plan's own range came up empty), ~7423–7484 (Slice 8 — read
  only to confirm `patchReviewWithAuth`/`patchNavCountWithAuth` are
  Slice-10-only, not this slice); `index.html` ~1338–1365 (Slice 8 —
  `#reviewModal` markup); `style.css` ~2605–2645, ~4070–4095 (Slice 8 —
  review modal + rating badge CSS); `app.js` ~1–13 (Slice 9 — top-of-file
  GPS/nav constants), ~1195–1700 (Slice 9 — accuracy gauge, dead
  reckoning, warm-up watcher, `onPositionUpdate`), ~4364–5330 (Slice 9 —
  full Navigation module: OSRM routing, HUD, voice, arrival detection,
  destination search, mode selector — read in full, not just the plan's
  narrower ~4333–4650 pointer), ~5556–5840, ~7124, ~7342–7356 (Slice 9 —
  mobile FAB cluster wiring, `mobAuthBtn` confirmed Slice-10-only),
  ~5995–6140 (Slice 9 — re-read place-card controller's `onNavigate` opt
  to confirm the reachable "Navigate Here" call site vs. the KML-preview
  popup's near-identical one at ~2280–2345, which is Slice 5's); `index.html`
  ~540–700, ~1110–1155 (Slice 9 — GPS panel/nav dest panel/nav HUD/mobile
  FAB markup); `style.css` ~86–130, ~414–425, ~610–650, ~804–935,
  ~2091–2650, ~3250–3410 (Slice 9 — `#map` offset, nav-panel-hint,
  nav-launch-btn, GPS panel, nav dest panel/HUD, mobile FAB cluster).
- **Flagged, not silently decided: where does the KML import trigger live?**
  Legacy's `#adminImportBtn` sits inside the not-yet-built admin overlay
  (Slice 11); `Sidebar.jsx`'s `.adminBtn` is reserved chrome for that same
  slice. This session shipped a standalone floating "Import" button
  (`features/kml/ImportTrigger.jsx`) as a working stand-in so the pipeline
  is actually reachable/testable now, rather than blocking the whole slice
  on Slice 11 or reaching into its reserved chrome. **This needs a decision
  from the person, or a relocation once Slice 11 lands** — it's not meant
  to be the final placement.
- **Dependencies confirmed done:** Slice 0 is partial — tokens, Tailwind
  theme, and icons are done; fonts are self-hosted but still on static
  per-weight packages, not yet switched to variable-font packages (see
  Bundle-size policy above and `BRAND_GUIDELINES.md`). Supabase client
  wiring (`src/lib/supabase.js`) is done as part of Slice 2 — reads
  `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from `.env.local` (see
  `.env.example`); `@supabase/supabase-js` added to `package.json`. RLS
  SELECT policies for `waypoints`/`waypoint_images` and a public-read
  policy on the `place-images` storage bucket were added directly in the
  Supabase dashboard (not tracked in this repo — no migrations-as-code yet;
  consider adding that if the schema keeps changing by hand).
- **Schema note for whoever builds Slice 5/8, and whoever verifies Slice
  4's assumption:** the live Supabase schema normalizes images into their
  own tables (`waypoint_images`, confirmed; `segment_images` — **assumed
  by Slice 4, not yet confirmed live**, same shape: `segment_id`,
  `storage_path`, `position`) instead of Firestore's embedded `imageUrls`
  arrays. Slice 4 also assumed a `segments` table
  (`id, name, description, category, points jsonb, distance, duration`)
  and — deliberately deviating from legacy's embedded `seg.waypoints`
  array — reads a segment's waypoints via `waypoints WHERE segment_id =
  seg.id` instead, since that FK already exists live. **None of this is
  confirmed against a real schema doc** ("link to be added once Phase 1
  backend work ships" still hasn't happened) — `useSegments.js` will
  throw/error at runtime if the actual table/column names differ. Verify
  before Slice 5 builds the save-flow insert on top of it. Separately:
  `waypoints`' `avg_rating`/`review_count` columns + a `reviews` table +
  recompute trigger (replacing legacy's client-side rolling-average
  `tx.update(wpRef, {avgRating, reviewCount})`, correctly flagged as
  race-prone during backend planning) are now **designed** by Slice 8 —
  see `FIREBASE_TO_SUPABASE_MIGRATION.md`'s "Step 6" for the actual SQL —
  but **not yet run against the live database**, same "designed, not
  applied" situation Slice 4/5 already flagged for their own tables.
  `numeric` columns (`lat`/`lng`/`distance`/`duration` etc.) come back as
  strings over PostgREST — always `Number()`-coerce before using them.
- **Anything unusual carried over from earlier sessions:**
  - **Icon library changed from the original plan.** `BRAND_GUIDELINES.md`
    originally specified Bootstrap Icons (self-hosted npm package); this
    was changed to `lucide-react` instead — see that file's Icons section
    for why. Full `bi-name → LucideIcon` mapping table is in
    `src/lib/legacyIconMap.js`. Two icons (`football`, `mosque`) have no
    confirmed Lucide equivalent yet — don't pick a stand-in silently if a
    slice needs them, they're flagged in that file.
  - **`html, body` font-family** in `src/index.css` uses `--font-ui`,
    not legacy's literal `'Geist', 'Outfit'` (which was never imported
    anywhere in the legacy app and was silently falling back to generic
    sans-serif — treated as dead code, not intentional design). Flag if
    that's wrong.
  - **`#map`'s sidebar offset — real, unresolved gap, not yet fixed.**
    `MapShell.module.css`'s `#map { left: 0 }` comment turned out to be
    correct all along: legacy's `#map` actually uses
    `left: var(--sidebar-total-w)` with a `body.sidebar-collapsed` variant
    at `--sidebar-rail-w`, because the sidebar is `position: absolute` and
    doesn't push the map via normal document flow on its own. Now that
    Slice 3's sidebar (`features/legend/Sidebar.jsx`) exists, `#map` needs
    that same offset plus a reaction to the sidebar's collapsed state —
    needs Sidebar's `collapsed` state reflected somewhere `MapShell`/
    `MapPage` can read it (e.g. a `document.body` class matching legacy's
    `body.sidebar-collapsed`, or lifting `collapsed` up to `MapPage`). Not
    done yet — pick this up alongside Slice 4, it's small but real.
  - **`PlaceCard`'s desktop anchor** now correctly uses
    `left: var(--sidebar-total-w)`, fixed as part of Slice 3 (was a
    placeholder waiting on the sidebar to land).
  - **Legend swatch colors ≠ marker pin colors** for several place types
    (`printing_shop`, `cafe`, `restaurant`, `pharmacy`, `barber`,
    `laundry`, `fuel`, `security_post`) — legacy itself has this
    inconsistency (distinct legend swatch color, but falls back to default
    teal on the actual map pin via `WP_TYPE_COLORS`). Ported faithfully as
    two separate color maps (`placeTypeGroups.js` vs `wpTypeMeta.js`) —
    not a bug in the port, a pre-existing legacy quirk.
  - **Flagged low-contrast issue, ported as-is, not silently fixed:** the
    place-type filter's group headers/bodies render on a solid white
    background (a "keep legend visible" override in legacy CSS that wins
    over the dark-theme block) while the text stays light-colored —
    low-contrast, likely an unintentional legacy bug. Worth a decision on
    whether to actually fix this or keep matching legacy exactly.
  - **Not ported, confirmed dead code in legacy:** group-header
    collapse/expand, group-level toggle checkboxes, the legend stats
    strip/ALL-toggle/active-dot — none of these have working JS or matching
    DOM in the current legacy app, so they were correctly left out rather
    than ported as broken features.
  - **Basemap:** only "Light" renders — legacy's JS supports a "Dark"
    CartoDB style but no second `.basemap-thumb` exists in the current HTML
    to select it, so the port matches that same single-option state.
  - **Routing:** `pages/LandingPage.jsx` exists but isn't wired into a
    route — reserved for a future "how the map works" explainer page.
    `pages/LoadingScreen.jsx` and `pages/NotFoundPage.jsx` are still
    Vite-scaffold stubs, not yet built out.
  - **Folder structure was reorganized in Slice 2's session** — if an
    older commit's file paths don't match the section above, that's why.