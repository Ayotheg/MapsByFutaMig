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
- **Route-level Code Splitting:** Use `React.lazy()` and `<Suspense>` to lazy-load distinct pages or heavily isolated feature components. This safely code-splits the application, keeping initial load speeds incredibly fast by preventing monolithic JS bundles. Do NOT lazy-load small, heavily reused UI components, as that causes unnecessary waterfalls.

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
│   └── NotFoundPage.jsx
│
├── features/                 # one folder per SLICE from MIGRATION_PLAN.md
│   ├── map/                  # Slice 1
│   │   ├── MapShell.jsx
│   │   └── MapShell.module.css
│   ├── waypoints/            # Slice 2
│   ├── legend/                # Slice 3
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

Route-level files go in `pages/`, not `features/`. A page composes one
or more features; it shouldn't contain feature logic itself. (Slice 1
is an exception in the current codebase — `MapShell` is mounted
directly as the `/` route element in `App.jsx` rather than through a
`pages/` wrapper, since there's no page-level chrome around it yet. If
a future slice adds chrome around the map, introduce
`pages/MapPage.jsx` at that point rather than growing `MapShell` into
one.)

`components/ui/` stays empty until the *second* real usage of an
identical pattern shows up (the Modal shell and SidebarPanel shell are
the two known future candidates — see Non-negotiable rules above).
Don't scaffold it early "just in case."



| What | Location |
|---|---|
| Legacy source of truth | `github.com/Ayotheg/MapsByFuta`, branch `feature/login2` |
| New React app | `github.com/Ayotheg/MapsByFutaMig`, branch `main` |
| Full feature list + slice order | `MIGRATION_PLAN.md` |
| Design tokens / brand system | `BRAND_GUIDELINES.md` |
| Supabase schema/RLS | (link to be added once Phase 1 backend work ships) |

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
5. Note anything ambiguous or any deliberate deviation from legacy behavior
   clearly, and ask the person before assuming.
6. Update the progress tracker.

---

## Session Context *(fill in before starting a new session)*

- **Slice being worked on:** None active — Slice 2 (waypoint markers &
  popups) is code-complete and builds/lints clean, but hasn't been run
  live end-to-end by a human yet against the real Supabase project. Do
  that first before starting Slice 3. Next up per `MIGRATION_PLAN.md`
  order after that: Slice 3 (legend/filter panel).
- **Legacy line ranges read so far:** `app.js` lines ~55–98 (Slice 1);
  ~2280–2560, ~2592–2790, ~5995–6140 (Slice 2 — waypoint markers,
  `loadSavedWaypoints`, place-card controller); `index.html` ~1155–1216
  (Slice 2 — place-card markup); `style.css` ~2690–2820, ~3900–4130
  (Slice 2 — wp-popup/gm-pin/place-card CSS).
- **Dependencies confirmed done:** Slice 0 is partial — tokens, Tailwind
  theme, fonts, and icons are done. Supabase client wiring
  (`src/lib/supabase.js`) is now done as part of Slice 2 — created
  reading `VITE_SUPABASE_URL`/`VITE_SUPABASE_ANON_KEY` from `.env.local`
  (see `.env.example`); `@supabase/supabase-js` added to
  `package.json`. RLS SELECT policies for `waypoints`/`waypoint_images`
  and a public-read policy on the `place-images` storage bucket were
  added directly in the Supabase dashboard (not tracked in this repo —
  no migrations-as-code yet; consider adding that if the schema keeps
  changing by hand).
- **Schema note for whoever builds Slice 4/8:** the live Supabase schema
  normalizes images into their own tables (`waypoint_images`,
  presumably `segment_images` too) instead of Firestore's embedded
  `imageUrls` arrays, and `waypoints` has no `avg_rating`/`review_count`
  columns — those need adding as part of Slice 8 alongside a `reviews`
  table and a recompute trigger (replacing legacy's client-side
  rolling-average `tx.update(wpRef, {avgRating, reviewCount})`, which
  was correctly flagged as race-prone during backend planning).
  `numeric` columns (`lat`/`lng` etc.) come back as strings over
  PostgREST — always `Number()`-coerce before using them.
- **Anything unusual carried over from the last session:**
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
  - **`#map` is full-bleed** (`left: 0` in `MapShell.module.css`), not
    offset by `--sidebar-total-w` like legacy. No sidebar shell exists
    yet in this migration (it's implied across the legend/GPS/search
    panel slices, not built as its own slice). When a sidebar lands,
    swap that one line back — the spot is commented in that file.
  - **Routing:** `pages/LandingPage.jsx` exists but isn't wired into a
    route — it's reserved for a future "how the map works" explainer
    page. `MapShell` is mounted directly at `/` in `App.jsx` for now.
    `pages/LoadingScreen.jsx` and `pages/NotFoundPage.jsx` are still
    Vite-scaffold stubs, not yet built out.
  - **Folder structure was reorganized** this session — see the new
    "Folder structure" section above. If you're looking at an older
    commit and file paths don't match that section, the reorg is why.
