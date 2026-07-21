# Maps By FUTA — Landing Page Build Plan (v2)

Supersedes the first draft of this doc. That draft was written blind
(no design access). We now have the **actual working source** exported
from Figma Make: `MapsByFuta-LandingPage.zip` → `src/App.tsx` (1,222
lines, single file, every section built) + `src/index.css` +
`src/imports/` (flyer + logo JPGs).

This is a port-and-fix job, not a from-scratch build. Read `About.md`
for brand/functionality background, then this doc for the concrete
task list.

---

## What's actually in the Figma Make export

One file, `App.tsx`, containing every section as its own component,
rendered in this order by the root `App` export:

```
Nav → Hero (+ PhoneMockup) → TrustBar → DiscoverSection →
ProductFeatures (5x FeatureShowcase) → VideoSection → WhySection →
ExploreSection → StatsSection → RoadmapSection → SupportSection →
FinalCTA → FAQ → Footer
```

Good news about quality: the color tokens in its `index.css` are an
**exact match** to `BRAND_GUIDELINES.md` (`--purple-light: #ddb7ff`,
`--teal: #44e2cd`, `--orange: #ffb95f`, `--bg-darkest: #0b1326`, etc.)
— whoever built this in Figma Make was already working from the real
brand tokens. That's the good news; the bad news is what needs fixing
before it can drop into your React app cleanly (below).

---

## Conflicts to resolve before/during porting

These aren't optional cleanup — they're things that will actively
break or clash if copy-pasted as-is into `MapsByFutaMig`:

1. **It's TypeScript (`.tsx`), your project is plain JSX.**
   `CLAUDE.md`'s non-negotiable rule: no TypeScript. Every type
   annotation (`: { size?: number; inverted?: boolean }` etc.) needs
   stripping on the way in.
2. **Fonts loaded via Google Fonts CDN** (`@import
   url('https://fonts.googleapis.com/css2?family=...')` at the top of
   its `index.css`) instead of your project's self-hosted
   `@fontsource/*` packages. Drop that `@import` line entirely — your
   app's `src/index.css` already self-hosts Bricolage Grotesque,
   Poppins, Inter, Montserrat via `@fontsource`. Reuse that, don't load
   fonts twice from two sources.
3. **Duplicate design tokens.** Its `index.css` redeclares `--purple-light`,
   `--teal`, `--bg-darkest`, etc. as fresh `:root` variables instead of
   using your existing `src/styles/tokens.css` (which has the *same*
   colors under Material-3-style names: `--primary`, `--secondary`,
   `--surface`, etc.). Don't ship two token systems — map the landing
   page's variable names to your existing ones, or add its friendlier
   aliases (`--purple-light` etc.) into `tokens.css` once, as a single
   source of truth.
4. **Images imported as raw `.jpg` via ES imports**
   (`import mapsFlyerImg from './imports/MAPSBYFUTA.jpg'`). These need
   to move into your project — `src/assets/` looks like the right spot
   based on your existing folder structure — and get re-imported from
   there.
5. **Everything is inline `style={{...}}` objects**, not CSS Modules.
   Your `CLAUDE.md` convention is CSS Modules per component. For a
   marketing page this dense with one-off styling, a full CSS-Modules
   rewrite is a lot of churn for little benefit — my suggestion:
   **keep inline styles for this page specifically** (it's a
   self-contained landing page, not part of the shared app shell) and
   note the deliberate deviation in a comment at the top of
   `LandingPage.jsx`, same way other deliberate deviations are flagged
   elsewhere in this codebase. Flag this to whoever owns the final
   integration call.
6. **All "Open Maps" CTAs link externally** to `https://mapsbyfuta.xyz`
   (8 occurrences) instead of an internal route. **Decided:** these
   become internal `<Link to="/map">` (from `react-router-dom`, already
   a dependency), not external links — see Task 0 below, now settled
   and already implemented in `App.jsx`.
7. **`package.json` deps are minimal** (react, react-dom, tailwind,
   vite) — no `lucide-react`, no `react-router-dom`. Your target repo
   already has both; nothing to add there, just don't reintroduce a
   separate package.json for this page.

---

## Fixes from your notes — exact locations

### 1. "100+" → "475+ campus locations"
Five occurrences in `App.tsx`, all needing an update (some are
"100+ locations", one is a stat counter, one is prose):

| Line | Context |
|---|---|
| ~256 | Floating stat card in `PhoneMockup` — `100+` / "Locations" |
| ~355 | Hero mini-stats row — `['100+', 'Campus Locations']` |
| ~453 | `DiscoverSection` bullet copy — "...100+ places mapped" |
| ~679 | `ProductFeatures` bullet — "100+ mapped locations" |
| ~905 | `StatsSection` — `{ value: 100, suffix: '+', label: 'Campus Locations' }` (this one **animates as a counter** via `useCounter` — 475 will count up fine, no logic change needed) |
| ~1030 | FAQ answer — "...100+ verified locations" |

Simple find-all-`100+`-and-replace-with-`475+` across the file covers
it, but read each one in context since two are "100+" used generically
("100+ mapped locations" reads fine as "475+ mapped locations" — check
none of the surrounding copy assumes a smaller/rounder number).

### 2. No emoji — replace every one with lucide-react (or a custom SVG matching Lucide's spec)

Full inventory, scanned from the file (54 distinct emoji, deduped
below by icon needed). This is the actual checklist — hand this
directly to whichever model does the icon-swap pass:

| Emoji | Used for | Suggested lucide-react icon | Notes |
|---|---|---|---|
| Map emoji | Map / "Explore the Map" | `Map` | |
| Magnifier | Search | `Search` | already in `legacyIconMap.js` |
| Pin | Location pin | `MapPin` | already in `legacyIconMap.js` |
| Star | Reviews / ratings | `Star` | |
| Bust | Profile/account | `User` | already in `legacyIconMap.js` |
| Satellite/antenna | Live GPS | `Satellite` or `RadioTower` | verify visually |
| Building/columns | "Built for FUTA" badge | `Landmark` | already in `legacyIconMap.js` (used for `bank2`) — if reused here, pick a distinct icon for ATM/bank below to avoid duplicate meaning |
| Phone | Mobile-first | `Smartphone` | |
| Globe | Responsive | `Globe` | |
| Checkmark box | Verified | `BadgeCheck` | |
| Lightning | Fast | `Zap` | |
| Compass | Navigation | `Compass` | |
| Lock | Trusted | `Lock` | |
| Checkmark | Checklist bullet | `Check` | |
| Arrow | Inline arrow | `ArrowRight` | |
| Hospital | Clinic | `Hospital` | already in `legacyIconMap.js` |
| Food | Food/restaurant | `UtensilsCrossed` | already in `legacyIconMap.js` |
| House | Hostel | `House` | already in `legacyIconMap.js` |
| Target | Destination pin | `Target` | |
| Walking | Walking route | `PersonStanding` | already in `legacyIconMap.js` |
| Car | Driving route | `CarFront` | already in `legacyIconMap.js` |
| Frown | "Freshers get lost" card | `Frown` or `MapPinOff` | |
| Clock | "Time lost" card | `Clock` | |
| People | Visitors / contributions | `Users` | |
| Grad cap | Lecture halls | `GraduationCap` | |
| ATM/Bank | ATM / Bank | `Landmark` or `CreditCard` | pick one distinct from "Built for FUTA" badge above |
| Books | Library | `BookOpen` | |
| Printer | Printing shop | `Printer` | already in `legacyIconMap.js` |
| Shirt | Laundry | `Shirt` | |
| Bus | Bus stop | `BusFront` | already in `legacyIconMap.js` |
| Backpack | Student affairs | `Backpack` | |
| Shopping bag | Shopping | `ShoppingBag` | |
| Flask | Laboratories | `FlaskConical` | |
| Ball | Sports | **use existing `src/lib/FootballIcon.jsx`** | already built, don't recreate |
| Mosque | Mosque | **use existing `src/lib/MosqueIcon.jsx`** | already built, don't recreate |
| Church | Church | `Church` | already in `legacyIconMap.js` |
| Fuel pump | Fuel station | `Fuel` | |
| Parking | Parking | `ParkingSquare` or reuse `CarFront` | |
| Brain | "Smarter navigation" (roadmap) | `BrainCircuit` | |
| Building crane | "More campus services" (roadmap) | `Construction` or `HardHat` | |
| Signal bars | Offline mode (roadmap) | `WifiOff` | |
| Heart | Support/heart | `Heart` | |
| Send/paper plane | Send/submit (in phone mockup) | `Send` | already in `legacyIconMap.js` |
| X / hamburger | Mobile menu close/open | `X` / `Menu` | `X` already in `legacyIconMap.js` |
| Diagonal arrow | External link | `ArrowUpRight` | |
| Brand marks (X/Twitter, LinkedIn, Instagram, WhatsApp) | Social links | **flag, don't guess** | Lucide doesn't ship brand/logo marks (licensing). Options: a small brand-icon set like `simple-icons` (check license terms before adding a new dependency), or hand-drawn custom SVGs matching Lucide's 24×24/2px-stroke spec — same pattern as `MosqueIcon.jsx`. Decide before this task starts; don't let the model improvise mismatched brand marks. |

Rule for whichever model does this pass: check `src/lib/legacyIconMap.js`
**first** for every icon — many are already resolved there. Only reach
for a new Lucide import or custom SVG when it's genuinely not present.

### 3. Commercial video placeholder
`VideoSection` component, roughly lines 733–791. Currently a fully
styled placeholder (gradient box, play button, decorative route lines,
text reading "Commercial Coming Soon / Video placeholder — replace
with the commercial"). Task: swap the placeholder box for a real
`<video>` element (or a thin wrapper component) that takes a
src/poster prop, so dropping in your final video file is a one-line
change, not a layout rebuild. Keep the play-button-styled poster state
for before playback starts if you want the same polish.

### 4. Support section → live Crowdr preview
`SupportSection` component, roughly lines 975–1020. Currently: a
static glass card with a heart emoji, copy, a row of static pill
badges, and one button linking out to
`https://www.oncrowdr.com/explore/c/fund-mapsbyfuta`. No live data at
all right now.

As covered earlier: **no public Crowdr API or embed widget exists.**
Recommended approach, in order of effort:
- **v1 (do this first):** replace the static button with an `<iframe
  src="https://www.oncrowdr.com/explore/c/fund-mapsbyfuta">` sized to
  look native inside the existing glass card — test in a real browser
  whether Crowdr sets `X-Frame-Options`/`frame-ancestors` blocking
  this before committing to it.
- **v2 (upgrade later):** a small serverless function (Vercel, since
  you're already on Vercel per `vercel.json`) that server-side-fetches
  the campaign page, parses its embedded `__NEXT_DATA__` JSON for
  amount raised / donor count, and the landing page polls that
  function for real numbers styled to match your brand instead of
  Crowdr's. Build this as an isolated `CrowdrCampaignCard.jsx` so it's
  swappable without touching the rest of `SupportSection`.

---

## Task breakdown (updated)

### Task 0 — Routing & CTA decision — ✅ DONE
Decided and already implemented in `App.jsx`:
- `LandingPage` now mounts at `/` (the site root).
- The existing map experience (`HomeRoute` — mounts `MapPage`
  immediately and overlays `LoadingScreen` until every readiness flag
  flips, exactly the boot sequence that used to live at `/`) moved to
  `/map`.
- `/loadingscreen` (standalone `LoadingScreen`, no readiness wiring)
  and the `*` → `NotFoundPage` catch-all are unchanged.
- **All CTA links must be internal `<Link to="/map">`** (from
  `react-router-dom`, already a project dependency), replacing every
  `<a href="https://mapsbyfuta.xyz" target="_blank" ...>` in the
  ported source (8 occurrences — see conflict #6 above for the exact
  pattern to swap). Clicking through lands the person on the loading
  screen immediately, same as a fresh visit to the old root did.

Every other task inherits this — Task 2 (the TS→JSX port) should apply
the `Link to="/map"` swap as part of the port itself, not as a
separate pass.

### Task 1 — Token & asset migration
- Merge the landing page's color/spacing variables into
  `src/styles/tokens.css` (they already match — this is aliasing, not
  redesigning).
- Move `MAPSBYFUTA.jpg` (flyer) and `MapssByFuta.jpg` (logo) into
  `src/assets/`, update imports.
- Strip the Google Fonts `@import` line; confirm Bricolage Grotesque,
  Poppins, Inter, Montserrat are all already loaded via `@fontsource`
  in the main app (they are, per `package.json`).
- Output: assets in place, tokens merged, no page content changed yet.

### Task 2 — TS → JSX port + component split
- Convert `App.tsx` to plain JSX, split into one file per section
  under `src/pages/landing/` (`Nav.jsx`, `Hero.jsx`, `TrustBar.jsx`,
  `DiscoverSection.jsx`, `ProductFeatures.jsx`, `VideoSection.jsx`,
  `WhySection.jsx`, `ExploreSection.jsx`, `StatsSection.jsx`,
  `RoadmapSection.jsx`, `SupportSection.jsx`, `FinalCTA.jsx`,
  `FAQ.jsx`, `Footer.jsx`) matching the granularity already present in
  the source — don't re-merge them into one file.
- `LandingPage.jsx` becomes the thin assembler importing all of the
  above, replacing the current placeholder.
- While porting, replace every `<a href="https://mapsbyfuta.xyz"
  target="_blank" rel="noreferrer">` with `<Link to="/map">` (import
  `Link` from `react-router-dom`) — this is the one behavior change
  bundled into this task rather than deferred, since it's mechanical
  and touches the exact same lines the port is already rewriting.
- No other copy/behavior changes in this task — pure mechanical port
  otherwise. The remaining fixes below happen in dedicated passes so
  review stays easy.

### Task 3 — "475+" fix
Apply the 6-location fix from above. Quick, isolated, safe for any
model to do as a fast pass after Task 2 lands.

### Task 4 — Emoji → icon replacement
Apply the full table above across all section files. Cross-check
`legacyIconMap.js` first every time. Flag the social/brand icon
question (Twitter/X, LinkedIn, Instagram, WhatsApp in the footer) back
to you rather than guessing a solution.

### Task 5 — Video placeholder swap
Build the swappable `<video>`/poster component in `VideoSection.jsx`
per the spec above.

### Task 6 — Crowdr live support section
Build `CrowdrCampaignCard.jsx` (iframe v1) inside `SupportSection.jsx`.

### Task 7 — Integration & QA (last, full context)
- Wire `LandingPage.jsx` into `App.jsx` per the Task 0 routing
  decision.
- Confirm zero emoji remain (grep the whole `src/pages/landing/`
  folder for emoji ranges as a final check).
- Confirm "475+" everywhere, no leftover "100+".
- Confirm fonts render correctly with no duplicate/conflicting
  `@import`.
- `npm run lint`, `npm run build`.

---

## Suggested model assignment (unchanged from v1, still applies)
- Strongest/most careful model → Task 0, Task 1, Task 7.
- Any capable model → Tasks 2–6, each given this doc + `About.md` +
  the relevant slice of `App.tsx`.
