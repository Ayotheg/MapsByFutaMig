# Task 2 — TS → JSX Port + Component Split — Changes

Scope followed as specced: `App.tsx` ported to plain JSX, split into
one file per section under `src/pages/landing/`, and every
`mapsbyfuta.xyz` CTA swapped for `<Link to="/map">`. No other
copy/behavior changes — verified by diffing the reassembled output
against the original source (see Verification below).

## 1. Files created

`src/pages/landing/`:
`Nav.jsx`, `Hero.jsx` (includes `PhoneMockup`), `TrustBar.jsx`,
`DiscoverSection.jsx`, `ProductFeatures.jsx` (includes
`FeatureShowcase` + the 5 feature visual components), `VideoSection.jsx`,
`WhySection.jsx`, `ExploreSection.jsx`, `StatsSection.jsx` (includes
`StatCard`), `RoadmapSection.jsx`, `SupportSection.jsx`, `FinalCTA.jsx`,
`FAQ.jsx`, `Footer.jsx` — one file per section, matching the
granularity called for in the build plan.

Two extra files not explicitly named in the plan, needed because
several hooks/components (`useReveal`, `useCounter`, `Pin`, `Logo`)
are shared across multiple section files and had to live somewhere:
- `landingHooks.js` — `useReveal` and `useCounter`.
- `shared.jsx` — the `Pin` and `Logo` components.
Split into two files (not one) because the project's `.oxlintrc.json`
has `react/only-export-components` enabled, which warns on a single
file mixing hook exports and component exports. Splitting was the
cheap fix; both mixed-export warnings are gone as of the last lint
run (see Verification).

`landing.css` — the port's keyframes and utility classes
(`.glass`, `.btn-primary`, `.reveal`, etc.), imported only by
`LandingPage.jsx`. Plain global CSS, not a CSS Module — this is the
deliberate deviation the build plan already calls out (conflict #5):
the page is inline-`style`-heavy by design, and rewriting the
handful of className-based utility classes into CSS Modules for a
self-contained marketing page wasn't worth the churn.

`src/pages/LandingPage.jsx` — replaced the placeholder; now the thin
assembler importing all of the above and rendering them in the same
order as the original `App()` export.

## 2. TypeScript stripped

Every type annotation found in the file (enumerated by grep before
starting, so this list should be exhaustive):
- `useRef<HTMLDivElement>(null)`, `useRef<SVGPathElement>(null)` (×2)
  → `useRef(null)`
- `useState<number | null>(null)` → `useState(null)`
- `function useCounter(target: number, ...)` → untyped params
- `Pin`, `Logo`, `FeatureShowcase`, `StatCard` — typed destructured
  prop objects → untyped
- `const scrollTo = (id: string) => {` → untyped
- `fill={c as string}` → `fill={c}`

Confirmed clean with `grep` across all output files for
`: string`, `: number`, `: boolean`, `<HTMLDivElement>`,
`<SVGPathElement>`, `useState<`, `useRef<[A-Z]`, ` as string` — zero
matches.

## 3. CTA link swap

Found **9** occurrences of
`<a href="https://mapsbyfuta.xyz" target="_blank" rel="noreferrer">`,
not the 8 the build plan states — it missed the plain-text
`mapsbyfuta.xyz ↗` link in the footer. Swapped all 9 to
`<Link to="/map">` (imported from `react-router-dom`) per the literal
instruction to replace every occurrence, dropping `target="_blank"`
and `rel="noreferrer"` since it's now an internal route.

**Flagged, not fixed:** the footer link's visible text still reads
`mapsbyfuta.xyz ↗` even though it now points to `/map` internally.
That's a copy change, out of scope for a mechanical port — flag if
you want it updated (e.g. to "Open the map ↗") in a later pass.

Locations (file: line count of swapped links): `Nav.jsx` (2 — desktop
+ mobile menu CTA), `Hero.jsx` (1), `DiscoverSection.jsx` (1),
`WhySection.jsx` (1), `ExploreSection.jsx` (1 — inside the categories
`.map()`, so it's one source line rendering 20 times), `FinalCTA.jsx`
(1), `Footer.jsx` (2 — CTA button + the text link above).

`SupportSection.jsx`'s external link to
`oncrowdr.com/explore/c/fund-mapsbyfuta` was left untouched — it's
not a `mapsbyfuta.xyz` CTA, and the Crowdr integration is Task 6.

## 4. `index.css` duplicate `:root` block removed

Per TASK_1_CHANGES.md's note that this cleanup was bundled into
Task 2: the landing export's duplicate color-token `:root` block
(the one Task 1 aliased into `src/styles/tokens.css`) is gone.
`landing.css` keeps the keyframes/utility classes only; every
`var(--purple-light)` etc. reference in the section files now
resolves through the Task 1 aliases in `tokens.css` instead of a
second, redundant declaration.

**Not carried over, flagged instead:** the original `index.css` also
had `html { scroll-behavior: smooth }` and an `html, body` reset
block. Left out of `landing.css` — see the conflict below.

## 5. Conflicts found during this task — not fixed, flagged

**Task 0 isn't actually wired in yet.** The build plan marks Task 0
✅ DONE and says `LandingPage` mounts at `/` with the map moved to
`/map`. The actual `App.jsx` in this delivery still has `LandingPage`
commented out, `/` still mounts `HomeRoute` (the map), and there's no
`/map` route. That's fine for Task 2's scope — the plan assigns the
actual routing wire-in to Task 7 — but it means the `<Link to="/map">`
CTAs added in this task point nowhere until Task 7 lands. Flagging
so it isn't missed, not blocking on it.

**`html, body { position: fixed; overflow: hidden }` in the main
app's global `src/index.css`.** This is tuned for the fixed-viewport
map app and will prevent a normal scrolling page from scrolling at
all once `LandingPage` is actually mounted at a route. Not patched
here — a global override from inside one page's stylesheet felt like
the wrong place to solve a routing-level layout conflict. Needs a
decision at Task 7 (e.g. scope the fixed/overflow-hidden rule to the
`/map` route specifically, or override it for the landing route).

## Verification

- Reassembled all 14 section files (minus their own import/export
  lines) in the original `App()` render order and diffed against a
  TS-stripped copy of the original `App.tsx`. The only differences
  are the intended CTA swaps and the FAQ/FinalCTA function-definition
  reorder (harmless — each is its own file now, and `LandingPage.jsx`
  renders them in the correct original order regardless of file
  order on disk). No accidental copy, style, or structural changes.
- `npx esbuild` bundle of `LandingPage.jsx` (jsx loader, TS disabled,
  `react`/`react-dom`/`react-router-dom` external) — resolves cleanly,
  0 errors, both image imports resolve.
- `npx oxlint --config .oxlintrc.json src/pages` — 0 warnings, 0
  errors (after fixing an unused `useState` import in `Hero.jsx` and
  the hooks/components file split noted above).

## Files in this delivery
- `MapsByFutaMig-task2-landing-jsx.zip` — the migration project with
  `src/pages/landing/` populated and `LandingPage.jsx` wired to
  import from it. `App.jsx` itself is untouched (routing wire-in is
  Task 7, per the build plan).
