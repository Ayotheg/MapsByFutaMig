# Maps By FUTA — In-App UI/UX Redesign Guide (v1)

This is the **single doc every model session reads before touching a
screen**. The redesign is being executed screen-by-screen, likely by
different LLM sessions/models, from Figma references. This guide is
what keeps 10 separate sessions producing UI that looks like one
designer did it, without anyone touching app logic.

Scope: **in-app map tool only** (dark theme — `MapPage` and everything
mounted under it: map shell, search, layers/filter panel, place card,
nav/GPS HUD, auth modal, admin panel, review modal, waypoint
submission flow). The landing page is a separate, already-redesigned
surface — do not touch anything under `src/pages/landing/`.

**Mobile-first sequencing.** This is majority a mobile redesign — the
Loading Screen reference was a 390px mobile frame, and that's the
default target viewport unless a screen is explicitly desktop-only.

**Pairing rule, for screens with both a mobile and desktop version**
(Search, Layers panel): redesign them **back-to-back in the same
session**, mobile first — not in two separate sessions weeks apart.
The desktop pass should reuse the just-made mobile decisions (spacing
feel, icon treatment, motion) while they're still fresh in that
session's context, not reconstruct them cold from this guide's text.
Screens that only exist on one platform (Nav/GPS HUD, Admin panel)
don't need pairing — just do them once. Screens marked "Both" in
Section 7 (Loading Screen, Auth modal, Review modal, Waypoint
suggestion) are a single responsive component already, not a pairing
question — one session covers both breakpoints naturally.

**UX is not optional.** A screen that's visually redesigned but still
feels static/flat isn't done — see Section 6. Every screen should
leave with at least one deliberate, subtle motion cue, not just new
colors and fonts.

---

## 1. Non-negotiable rules (read this first)

1. **UI and UX only. Zero functionality changes.** Do not rename,
   remove, or add: props, state variables, hooks, event handler
   names, function signatures, context values, or anything a parent
   component depends on. If a redesign seems to require a behavior
   change (e.g. a new interaction pattern), stop and flag it in your
   handoff notes instead of implementing it.
2. **Touch only `.jsx` markup/structure and `.module.css` / CSS
   files.** If a change would require editing a plain `.js` file
   (hooks, API calls, utils), stop — that's a functionality file, out
   of scope for this pass.
3. **Don't rewire data flow.** Same data in, same data out. You're
   changing how it looks and how it's arranged, not what it does.
4. **CSS Modules stay CSS Modules.** This app is CSS Modules primary
   with Tailwind v4 available for quick utility tweaks — don't
   introduce a new styling system (styled-components, CSS-in-JS,
   etc.) for a redesigned screen.
5. **Don't touch `src/pages/landing/`** — separate, already-redesigned
   surface, out of scope here.
6. **Motion is part of the deliverable, not a nice-to-have.** CSS-only
   transitions/animations are always in scope (they're styling, not
   logic) — see Section 6 before calling a screen finished.
7. **When in doubt, don't guess — flag it** in your session's handoff
   notes at the bottom of this file's status table (Section 7).

---

## 1a. Scope per session — wait for explicit instruction

**Do not pick the next "Not started" screen on your own.** Finish only
the screen you were asked to do, update this file's status table for
that screen, and stop there — even if another row is sitting at "Not
started" and would logically come next per Section 7 or the pairing
rule. The person runs one screen per session on purpose (review time,
context budget, different models per session); starting an unrequested
screen wastes their review cycle and can produce work they didn't ask
for. Only move on to another screen when the person's message names it
or clearly says "continue"/"next screen" for that purpose.

---

## 2. How to start a screen session

Paste this at the top of a new model session, filled in:

```
I'm redesigning one screen of an existing React app (UI/UX only, per
UI_REDESIGN_GUIDE.md in this repo — read it first, follow it exactly).

Screen: <name from Section 7 table>
Files: <file paths from Section 7 table>
Platform: <Mobile / Desktop / Both, from Section 7's Platform column>
Figma reference: <pasted screenshot or Figma frame link>
Font(s) for this screen: <picked from Section 4's shortlist>

Rules: no functionality changes (see Section 1 of the guide). Only
JSX structure/classNames and CSS. Reuse --v2-* tokens from
src/styles/tokens-v2.css wherever possible instead of inventing new
values — if this screen is the first one redesigned, define the v2
palette there per Section 3, and every later screen must reuse it.
Also add at least one subtle motion cue per Section 6 — this isn't
done as a static mockup.
```

---

## 3. Design tokens v2

The current palette (violet primary / cyan secondary / amber
tertiary, see `src/styles/tokens.css`) is **up for a full redesign**,
not just a refinement — direction is open.

**Rule: don't invent hex values per-screen.** New tokens live in a
new file, `src/styles/tokens-v2.css`, imported alongside (not
replacing) the existing `tokens.css` — the old file stays untouched
so any screen not yet redesigned keeps working unchanged. The
**first screen redesigned effectively sets the v2 palette**: whatever
colors/radii/spacing scale that session defines in `tokens-v2.css`
become the tokens every subsequent screen session must reuse, not
reinvent.

**Palette — authoritative from the "Lumina Campus Utility" style
guide** (supersedes the initial Loading-Screen-derived primary; live
in `src/styles/tokens-v2.css`):

```css
--v2-surface:              #faf8ff;  /* light theme direction, was dark in v1 */
--v2-text:                 #4a4455;
--v2-text-variant:         #7b7487;
--v2-muted:                rgba(123, 116, 135, 0.5);
--v2-primary:              #7c3aed;  /* style-guide value; NOT the #630ed4 first used on Loading Screen */
--v2-on-primary:           #ffffff;
--v2-primary-outline:      rgba(124, 58, 237, 0.2);
--v2-primary-glow:         rgba(124, 58, 237, 0.1);
--v2-primary-glow-strong:  rgba(124, 58, 237, 0.6);
--v2-secondary:            #0d9488;
--v2-on-secondary:         #ffffff;
--v2-tertiary:             #a15100;
--v2-on-tertiary:          #ffffff;
--v2-neutral:              #0f172a;
--v2-on-neutral:           #ffffff;
--v2-track:                #e2e7ff;  /* progress bar / meter background */
```

Because the Loading Screen only ever references `var(--v2-primary)`
etc. (never a hardcoded hex), the primary-color fix applies to it
automatically — no separate edit to that screen was needed.

Not yet defined (add when a screen actually needs them — don't
pre-invent): `--v2-error` (a destructive/delete red appears in the
style guide's icon cluster but its exact hex wasn't given — confirm
before tokenizing), `--v2-primary-container`/`--v2-secondary-container`
(light tint fills, needed for the "Secondary" button variant),
`--v2-surface-container`/`-high` for elevated panels.

Radii/spacing are **not** duplicated into v2 — reuse `var(--r-sm)`,
`var(--r-full)`, `var(--gap)`, `var(--pad)` etc. from `tokens.css`
directly; the scale itself isn't part of this redesign, only the
palette. Same for fonts: the Loading Screen uses Bricolage Grotesque
+ Inter, both already bundled and already tokenized as
`var(--font-display)` / `var(--font-ui)` — reuse those rather than
adding `--v2-font-*` duplicates unless a later screen introduces a
genuinely new font.

Once every screen in Section 7 is redesigned, a final cleanup pass
merges `tokens-v2.css` into `tokens.css` and deletes the old values —
not part of any individual screen session's job.

---

## 4. Fonts (self-hosted, bundled)

Candidate shortlist (final pick is per-screen, made by whoever's
running that session, matched to what the Figma reference actually
uses): Inter, Geist Sans, Roboto, Manrope, Figtree, Poppins, DM Sans,
Instrument Serif, Playfair Display, Roboto Flex, Source Sans 3.

**Only bundle a font once it's actually chosen for a screen** — don't
pre-load all 11 "just in case"; that's dead weight in the bundle.

### Bundling recipe (same steps regardless of which font is picked)

1. Add the font files under `src/assets/fonts/<font-name>/` — woff2
   only unless a screen needs legacy support (it doesn't; this is a
   modern PWA). Include the weights actually used, typically
   400/500/600/700.
2. Declare it in `src/styles/fonts.css` (create this file if it
   doesn't exist yet):

   ```css
   @font-face {
     font-family: 'FontName';
     src: url('../assets/fonts/font-name/FontName-Regular.woff2') format('woff2');
     font-weight: 400;
     font-style: normal;
     font-display: swap;
   }
   /* repeat per weight */
   ```

3. Import `fonts.css` once, in `src/index.css` (or wherever the
   existing global stylesheet imports live) — not per-component.
4. Point a `--v2-font-*` token at it in `tokens-v2.css`, e.g.:

   ```css
   --v2-font-display: 'FontName', 'Inter', system-ui, sans-serif;
   ```

   Always keep a sane fallback stack — never a bare custom font name
   with nothing behind it.
5. Components reference `var(--v2-font-display)` etc., never the
   font-family string directly. This is what lets a font swap stay a
   one-line token change instead of a find-and-replace across every
   `.module.css`.

`font-display: swap` is mandatory (avoids invisible-text flash on a
slow campus connection, which this app needs to handle well).

---

## 5. Component contracts

Sourced from the "Lumina Campus Utility" style-guide reference —
later sessions should match these, not reinvent them:

| Component | Contract |
|---|---|
| Button — Primary | Filled `var(--v2-primary)` background, `var(--v2-on-primary)` (white) text, pill/rounded corners |
| Button — Secondary | Light lavender-tint fill (needs a `--v2-primary-container`-style light tint — not yet tokenized, define when first built), `var(--v2-primary)` text |
| Button — Inverted | Filled `var(--v2-neutral)` (dark navy) background, `var(--v2-on-neutral)` (white) text |
| Button — Outlined | Transparent/white fill, thin border, dark text — border color not yet tokenized, define when first built |
| Search bar | Light rounded-pill container, muted placeholder + leading search icon, no heavy border |
| Icon action cluster | Small filled circular buttons, one per accent color (primary/secondary/tertiary + a destructive variant) — pattern used for grouped quick-actions |
| Modal | *(not yet defined — TBD by first modal screen)* |
| Panel / card | *(not yet defined — TBD)* |
| Input field | *(not yet defined — TBD)* |
| Icons | `lucide-react`, stays as-is — confirm consistent stroke width/size across redesigned screens |

---

## 6. Motion & micro-interactions (UX layer)

A screen that's visually restyled but doesn't move at all still reads
as a static mockup, not a product — this section exists so "redesign
the UI" doesn't quietly become "redesign the colors." Motion here
means CSS-only transitions/animations (transform, opacity) — always
in scope under Rule 6 in Section 1, since it's styling, not logic.

**Principles:**
1. **Motion signals state, not decoration.** Every animation should
   map to something real (loading, a hover, a change) — never motion
   for its own sake.
2. **Subtle over showy.** Small opacity/scale/translate shifts, calm
   easing. The user should feel it more than consciously notice it —
   no bounce, no elastic overshoot, nothing that competes for
   attention with the content.
3. **Respect `prefers-reduced-motion`.** Wrap non-essential animation
   in `@media (prefers-reduced-motion: no-preference) { ... }` so it
   simply doesn't run for users who've asked for less motion.
4. **Consistent timing.** Add these to `tokens-v2.css` the first time
   a screen actually uses them (don't pre-declare unused tokens):

   ```css
   --v2-ease-standard:     cubic-bezier(0.4, 0, 0.2, 1);
   --v2-duration-quick:    150ms;  /* hover/press feedback */
   --v2-duration-standard: 250ms;  /* panel/modal enter-exit */
   --v2-duration-breathe:  2200ms; /* slow ambient pulses */
   ```

**Per-component guidance:**

| Component | Motion |
|---|---|
| Loading indicators | A slow "breathing" pulse — scale ~1 → ~1.05 and a soft opacity fade on a ring/glow, on a ~2–2.4s loop. Calm and rhythmic, like a heartbeat, not a spinner or flash. |
| Buttons | Subtle scale-down (~0.97) or opacity dip on `:active`; no idle animation. |
| Modals | Fade + slight scale-in (~0.96 → 1) on open, reverse on close. |
| Panels / bottom sheets | Slide with `--v2-ease-standard`, never linear or instant. |
| Progress bars | Width/value changes should ease (already the case on the Loading Screen: `transition: width 0.35s ease`), never snap. |
| Icons | Don't spin/rotate unless the icon is literally representing a spinner or refresh action. |

**Flag from the Loading Screen:** it shipped with a static ring
around the icon (matching the Figma reference exactly), but a
loading screen is exactly the kind of place Section 6 applies to —
add a slow breathing pulse per the table above (animate the existing
`.ringOuter` element's `transform`/`opacity`; no new markup, no
JSX/logic change).

---

## 7. Screen manifest & status

| Screen | Files | Platform | Font picked | Status |
|---|---|---|---|---|
| Loading screen | `src/pages/LoadingScreen.*` | Both (viewport-agnostic overlay) | Bricolage Grotesque + Inter (already bundled) | Done |
| Search (mobile) | `src/features/search/MobileSearchBar.*`, `MobileSearchOverlay.*` | Mobile | Inter (already bundled) | Collapsed bar (`MobileSearchBar`) done; `MobileSearchOverlay` still pending, see flag below |
| Search (desktop) | `src/features/search/DesktopSearchBar.*`, `SearchDropdownList.jsx`, `SearchResultItem.*` | Desktop | Inter (already bundled) | Collapsed pill (`DesktopSearchBar`'s `.bar`/`.pill`) done; `SearchDropdownList`/`SearchResultItem` and `.dropdown` still pending, see flag below |
| Quick chips | `src/features/search/QuickChips.*`, `ChipResultsPanel.*`, `ChipResultRow.*` | Both — single component, internal `@media` queries, not split files | — | Not started |
| Filter/legend content | `src/features/legend/LayersPanel.*`, `PlaceTypeFilter.*` | Desktop only now — mobile's Layers entry point removed this session, see Explore Panel flag below | — | Not started |
| Explore panel | `src/features/explore/*`, `src/features/admin/AdminEditModal.jsx` (Explore fields), `supabase/explore_fields.sql` | Both — mobile navbar's "Explore" tab body + new desktop rail button | Bricolage Grotesque + Inter (v2 tokens) | Done |
| Layers panel — mobile shell | `src/features/legend/MobileSheet.*` | Mobile — drag handle, peek/half/full sheet states | Inter (already bundled) | Tab strip done; 'layers'-keyed tab body now Explore Panel (see flag) |
| Layers panel — desktop shell | `src/features/legend/Sidebar.*` | Desktop — rail + fixed-width panel | Inter (already bundled) | Rail icons done; Explore panel added this session, Layers panel body still pending
| Place card | `src/features/waypoints/PlaceCard.*` | Mobile (drag-to-dismiss sheet) + desktop float, single component | Bricolage Grotesque + Inter (v2 tokens) | Done |
| Nav/GPS HUD | `src/features/navigation/NavHud.*`, `NavPanel.*`, `NavDestPanel.*`, `GpsPanel.*`, `NavArrivedBanner.*`, `MobFabCluster.*` | Mobile | — | Not started |
| Auth modal | `src/features/auth/AuthModal.*` | Both | — | Not started |
| Review modal | `src/features/reviews/ReviewModal.*` | Both | — | Not started |
| Waypoint suggestion | `src/features/waypoint-submissions/SuggestWaypointModal.*`, `MyWaypointSubmissionsPanel.*`, `SubmissionToast.*` | Both | — | Not started |
| Map shell | `src/features/map/MapShell.jsx`, `.module.css` | Both | — | Not started |
| Admin panel | `src/features/admin/AdminPanel.*`, `AdminEditModal.*`, tabs (`KmlTab`, `PendingTab`, `PointsTab`, `RoutesTab`, `QuickChipsTab`) | Desktop | — | Not started |

Update the **Status** and **Font picked** columns as each session
completes a screen, and append any flags (Rule 7) as a note under the
table. Deliverable per session: full repo zip (matching the existing
migration-slice convention), with this table updated.

**Flags from completed screens:**
- Explore panel (this session): **real functionality added, not a
  reskin — an explicit, deliberate exception to Rule 1/2 above, made on
  direct user instruction in-session, not assumed.** Figma node 1:3
  (screenshot supplied in-session, `figma.com` itself is robots-blocked
  for automated fetching) is the "Explore Campus" card: a header + "View
  All" + a couple of rotating place cards (image/colored icon, name,
  distance, promoted badge), reached by tapping the mobile navbar's
  existing "Explore" tab (previously mislabeled — it opened
  `LayersPanel`, flagged as a leftover in the entry below).
  - **Revised mid-session, per explicit follow-up instruction:** the
    first pass built a separate `explore_picks` table + a 7th admin tab
    (`ExploreTab.jsx`) — mirroring `QuickChipsTab.jsx`'s "curation layer
    over an existing table" shape. That table needing its own migration
    run before use is exactly what the person hit
    (`Could not find the table 'public.explore_picks'`), and they then
    said plainly they didn't want a separate database concept at all —
    just picking a place on the map and featuring it. **Replaced with:**
    `supabase/explore_fields.sql` adds a handful of plain columns
    directly onto the existing `waypoints` table (`is_explore`,
    `explore_tags`, `explore_priority`, `is_promoted`, `sponsor_name`,
    `promo_label`) instead of a new table. Featuring a place is now just
    a checkbox + a couple of fields inside the *same* waypoint edit form
    (`AdminEditModal.jsx`, opened by clicking a pin on the map) already
    used to edit its name/description/type — no new admin tab, no new
    RLS policies (reuses `waypoints`' existing ones, the same ones
    `updateWaypoint()` already relied on). `ExploreTab.jsx`/
    `explorePicksApi.js`/`explore_picks.sql` were deleted, not kept
    alongside. `useWaypoints.js`'s initial select also degrades
    gracefully (retries without the Explore columns, logs a note) if
    `explore_fields.sql` hasn't been run yet, so a missing migration
    can't break waypoint loading for the whole map the way the first
    version's missing table broke Explore specifically.
  - New feature folder `src/features/explore/`: `useExplorePicks.js`
    filters/sorts the `waypoints` array `MapPage` already loads for
    `isExplore: true` rows — no fetch of its own at all now. Falls back
    to an auto-generated top-rated list (rating x log(reviews)) when
    nothing's been featured yet, so the panel is never empty
    pre-admin-setup — same contract as `useQuickChips()` falling back to
    `DEFAULT_CHIPS`. `ExplorePanel.jsx` renders a `compact` variant
    (rotates every 7s; a promoted pick, if any, stays pinned first — an
    ad slot doesn't roll dice on visibility) and a `full` variant
    (stable scrollable list, used for "View All" and always on desktop).
    `useOneShotLocation.js` is a single cheap `getCurrentPosition()` call
    for "X mins away" labels — deliberately not `useGpsTracking.js`'s
    live-tracking machinery, see that file's own header comment for why.
  - **Repurposed, not added:** mobile's "Explore" tab (`MobileSheet.jsx`,
    key `'layers'`) previously rendered `LayersPanel` — now renders
    `ExplorePanel`. Mobile has **no Layers/legend entry point at all**
    after this change; confirmed explicitly in-session rather than
    assumed, since it's a real capability removal (same flagging
    standard as the Admin-tab removal below).
  - **Added, not repurposed:** `Sidebar.jsx` (desktop) keeps its
    existing Layers rail button untouched and gets a new one alongside
    it (`Sparkles` icon — `Compass` was already taken by Layers here),
    per explicit instruction that desktop's two features stay separate
    while mobile's single tab gets repurposed. This is why mobile and
    desktop now disagree about whether Explore replaces or supplements
    Layers — both were direct instructions, not an inconsistency to
    "fix."
- Search bar — mobile collapsed bar + desktop collapsed pill (this
  session, paired per Section 1a/pairing rule): Figma node 29:23
  ("Group 2") is a 390px mobile frame showing the floating search
  pill plus the Category Chips row beneath it. Scoped this session to
  the search pill only (`MobileSearchBar.jsx`/`.module.css`) —
  Category Chips is `QuickChips`, its own "Not started" row in this
  table, not guessed at here even though it appears in the same
  screenshot.
  - Initial pass restyled to v2 light tokens: a `rgba(250,248,255,0.9)`
    glass background with `backdrop-filter: blur(6px)`, `--v2-primary`
    nav button, `--v2-text-variant` placeholder — matched the Figma
    frame for the menu button, input, and placeholder text.
  - **Flag resolved via follow-up node 31:243** (a cleaner pass at the
    same bar, supplied in-session): confirmed the rightmost button is
    a plain navigation/send arrow in a solid `--v2-primary` circle, not
    a profile/avatar element — the existing `Navigation` icon and
    unchanged `onNavigate`/`onNavigateClick` prop were correct all
    along, no behavior change needed. Node 31:243 also showed a
    different pill treatment (opaque white, `1px solid #d1d5db`
    border, no blur) superseding the initial glass background — both
    bars switched to it, and a new `--v2-border: #d1d5db` token was
    added to `tokens-v2.css` since it's a plain neutral gray with no
    existing accent-token match.
  - Desktop's collapsed pill (`DesktopSearchBar.jsx`'s `.bar`/`.pill`
    and its logo/divider/input/clear/nav buttons) restyled to the
    same v2 tokens per the pairing rule — no separate Figma frame was
    given for desktop, so this reuses the mobile session's decisions
    (now the opaque white/bordered pill, `--v2-primary` nav button)
    rather than reinventing them, consistent with how the pairing rule
    describes the desktop pass working.
  - **Deliberately left v1/dark, not part of this session:**
    `MobileSearchOverlay.*` (no Figma reference yet) and
    `SearchDropdownList.jsx`/`SearchResultItem.*` and
    `DesktopSearchBar`'s own `.dropdown`/`.noResults` — that list
    component is shared verbatim between the desktop dropdown and the
    still-dark mobile overlay, so restyling it now would put
    light-on-dark text on the unredesigned overlay. Same shared-
    component precedent as the Layers panel tab-strip pass (see that
    flag above). Motion: existing hover/press transitions on both
    bars' buttons were moved onto `--v2-duration-*`/`--v2-ease-
    standard` tokens, satisfying Section 6 without adding new idle
    animation (Section 6's own guidance: buttons get press feedback,
    not idle motion).
- Loading Screen: icon swapped from `MapPin` to `Navigation`
  (lucide-react) to match the Figma reference — a component swap, not
  a logic change, no props/behavior affected. Subtitle copy also
  updated to match the design's text ("Your personal guide to campus
  navigation.") — a content edit, not a functional one. Breathing
  pulse animation added to the icon ring per Section 6.
- Layers panel — mobile shell + desktop shell (this session): the
  Figma "Layers Panel" node (5:746) turned out to be the bottom
  **tab strip** only (a rounded white bar, `Explore`/`Signal`/`Nav`/
  `Suggest`/`Profile`), not the sheet body — scoped this session's
  redesign to `MobileSheet.jsx`'s tab strip and `Sidebar.jsx`'s rail
  + footer icons, not the `.body`/`.panel` content those wrap (that's
  `LayersPanel`/`PlaceTypeFilter`, still its own "Not started" row
  above — no Figma reference for it yet, not guessed at here).
  **Update (see Explore panel flag above):** the 'layers'-keyed tab's
  body is no longer `LayersPanel` on mobile — it's `ExplorePanel` now.
  This note is left as-is for history; don't take "no Figma reference"
  as still true for that specific tab.
  - `.header`/`.tabs` restyled to the v2 light palette (matches
    Figma exactly: white rounded-top bar, elevation shadow, pill
    active state on `var(--v2-primary-glow)`). Deliberately did
    **not** flip the whole `.sheet` (and `Sidebar`'s rail/`.panel`)
    to the v2 light surface, since the still-unredesigned body
    content assumes light-on-dark text — that would go illegible
    on a light background. `.sheet` and the rail stay on v1 dark
    tokens for now; only the self-contained tab strip goes v2.
  - Labels renamed `Layers`→`Explore` (mobile only) and icons
    swapped from hand-drawn inline SVG to `lucide-react`
    (`Compass`/`Rss`/`Navigation`/`CirclePlus`, plus `Shield` for
    Sidebar's Admin button and `CircleUser` for Sign In) to match
    the Figma glyphs and Section 5's icon contract — component/copy
    swaps only, no behavior change, same precedent as the Loading
    Screen's icon swap above.
  - **Explicit user instruction, not a redesign-guide default:**
    Admin access removed from `MobileSheet`'s tab strip entirely
    (the `admin` tab Slice 11 added) so it's only reachable from
    desktop's `Sidebar`. Sidebar already only mounts when
    `MapPage`'s `isMobile` (`window.innerWidth <= 768`) is false, so
    this closes the one path that exposed Admin under 768px;
    `Sidebar.module.css` also adds an `@media (max-width: 768px)`
    rule hiding `.adminBtn` as a defensive second layer. This is a
    real capability removal on mobile, flagged per Rule 7 even
    though it was directly requested rather than guessed.
  - Figma's 5th tab, "Profile" (rightmost, person icon), has no
    wired feature in this codebase to attach it to — mobile already
    has a separate auth entry point (the FAB `MapPage` mentions,
    `MobFabCluster`'s `User` icon), so nothing was invented here.
    Flagging for whoever picks up "Filter/legend content" or a
    future account/profile screen, in case a dedicated tab is
    wanted later — would need a new prop threaded from `MapPage`,
    out of scope for a UI-only pass. **Update:** confirmed this is
    the login/sign-up + account entry point (where the signed-in
    username/profile would show) — intentionally left unbuilt this
    session because Google auth itself is under reconsideration
    (there's a plan to remove it later), so wiring a Profile tab
    now risks building against auth that's about to change. Revisit
    once the auth direction is settled.

---

## 8. Open decisions (fill in as they're made)

- **v2 palette**: set (Section 3) — primary/secondary/tertiary/neutral defined
- **Component contracts**: partially set (Section 5) — buttons/search bar defined; modal/panel/input still TBD
- **Fonts per screen**: not yet assigned beyond Loading Screen — Section 7 table
- **Motion tokens** (`--v2-ease-standard`, `--v2-duration-*`): not yet added to `tokens-v2.css` — add on first screen that uses them (Section 6)
