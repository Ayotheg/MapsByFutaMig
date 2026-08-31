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
| Modal | Set this session (Waypoint suggestion, Figma node 1:253): `var(--v2-surface)` body, `var(--v2-track)` borders, `var(--font-display)` title, fade+scale-in per Section 6. See `Modal.module.css`. |
| Button — Outlined | Set this session: white fill, `var(--v2-track)` border, `var(--v2-neutral)` text — confirmed against the "Cancel" button on node 1:253. New `.btnOutlined` class in `Modal.module.css`. |
| Panel / card | *(not yet defined — TBD)* |
| Input field | Set this session: floating label overlapping a `var(--v2-track)`-bordered, `var(--v2-hud-upnext-bg)`-filled field — see `SuggestWaypointModal.module.css`'s `.floatWrap`. |
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
| Search (mobile) | `src/features/search/MobileSearchBar.*`, `MobileSearchOverlay.*` | Mobile | Inter (already bundled) | Done — `MobileSearchOverlay` redesigned this session, see flag below |
| Search (desktop) | `src/features/search/DesktopSearchBar.*`, `SearchDropdownList.jsx`, `SearchResultItem.*` | Desktop | Inter (already bundled) | Done — `.dropdown`/`SearchDropdownList`/`SearchResultItem` redesigned this session (paired with the mobile overlay), see flag below |
| Quick chips | `src/features/search/QuickChips.*`, `ChipResultsPanel.*`, `ChipResultRow.*` | Both — single component, internal `@media` queries, not split files | Bricolage Grotesque (headings) + Inter (body) for the results dropdown; chip row itself stays Inter-only, see flag | Chip row (`QuickChips`) done; `ChipResultsPanel`/`ChipResultRow` (the dropdown a chip opens into) done this session |
| Filter/legend content | `src/features/legend/LayersPanel.*`, `PlaceTypeFilter.*` | Desktop only now — mobile's Layers entry point removed this session, see Explore Panel flag below | — | Not started |
| Explore panel | `src/features/explore/*`, `src/features/admin/AdminEditModal.jsx` (Explore fields), `supabase/explore_fields.sql` | Both — mobile navbar's "Explore" tab body + new desktop rail button | Bricolage Grotesque + Inter (v2 tokens) | Done |
| Layers panel — mobile shell | `src/features/legend/MobileSheet.*` | Mobile — drag handle, peek/half/full sheet states | Inter (already bundled) | Tab strip done; 'layers'-keyed tab body now Explore Panel (see flag) |
| Layers panel — desktop shell | `src/features/legend/Sidebar.*` | Desktop — rail + fixed-width panel | Inter (already bundled) | Rail icons done; Explore panel added this session, Layers panel body still pending
| Place card | `src/features/waypoints/PlaceCard.*` | Mobile (drag-to-dismiss sheet) + desktop float, single component | Bricolage Grotesque + Inter (v2 tokens) | Done |
| Nav/GPS HUD | `src/features/navigation/NavHud.*`, ~~`NavPanel.*`~~ (dead, see flag below), `NavDestPanel.*`, `GpsPanel.*`, `NavArrivedBanner.*`, `MobFabCluster.*` | Mobile | Inter (labels) + Bricolage Grotesque (headline/distance) — matches the rest of the v2 pass | Partially done, see flags below — `NavHud` fully redesigned to v2 against Figma node 4:429 (confirmed via the Figma MCP connection) + the mobile navbar's nav-active color state landed (in `MobileSheet.*`, not this row's own files); `NavDestPanel` redesigned to v2 against Figma node 1:311; `GpsPanel` redesigned to v2 against Figma node 31:52 this session, see flag below; `NavArrivedBanner` redesigned to v2 against Figma node 67:130 this session, see flag below; every nav entry point (mobile search bar, mobile navbar, desktop rail, desktop search bar) now routes straight to `NavigationController`/`NavDestPanel` instead of `NavPanel`, which is now unreachable/dead — see flag below; `MobFabCluster` still on v1 dark tokens — no reference yet |
| Auth modal | `src/features/auth/AuthModal.*` | Both | Bricolage Grotesque (brand/buttons) + Inter (v2 tokens) | Done — see flag below |
| Review modal | `src/features/reviews/ReviewModal.*` | Both | Bricolage Grotesque (question) + Inter (v2 tokens) | Done — see flag below for why it no longer uses the shared `Modal` shell |
| Waypoint suggestion | `src/features/waypoint-submissions/SuggestWaypointModal.*`, `MyWaypointSubmissionsPanel.*`, `SubmissionToast.*` | Both | Bricolage Grotesque (title) + Inter (v2 tokens) | Done — this session also redesigned the shared `components/ui/Modal.*` shell (first modal screen, see flag) |
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
- Quick chips — chip row only (this session, on explicit user
  instruction after they flagged the row still looking v1): restyled
  `QuickChips.jsx`/`.module.css` to v2 tokens per Figma node 29:23's
  Category Chips — white/`--v2-border`-bordered by default, teal-green
  (`--v2-chip-active-bg/-border/-text`, new tokens this session — the
  design's teal-green didn't match `--v2-secondary` closely enough to
  reuse) when a chip is active. Removed the old backdrop-blur glass
  treatment to match the design's flat/opaque chip. Motion: existing
  hover/press transitions moved onto `--v2-duration-quick`/`--v2-ease-
  standard`; the per-chip staggered entrance animation was kept as-is
  (already CSS-only, already subtle).
  - **Follow-up session — dropdown done:** `ChipResultsPanel.*`/
    `ChipResultRow.*` (the results list/panel a chip opens into)
    restyled to v2 light tokens per Figma node 4:323 ("Place List
    Redesign"). Header consolidated into one shared layout for both
    platforms: icon badge (`--v2-primary-glow` circle, `--v2-primary`
    icon), title, a count badge + status line under it, close/back
    button — matches the Figma reference exactly for the mobile card;
    desktop's panel reuses the same look per the pairing rule (its
    existing `ArrowLeft` "back" button, unchanged, just restyled to the
    same light circular button — no separate desktop Figma frame was
    given here).
    - **Copy consolidated, not new:** the old desktop-only "Sorted
      alphabetically" subtitle and the list-embedded "Showing N places
      · nearest first" bar (previously shown in two places on desktop,
      one on mobile) are now one status line under the title: `Loading…`
      / `No places found` / `Showing N places[ · nearest first]` —
      exact same three states and exact same existing strings, just
      picking one of the two pre-existing copies per state instead of
      showing both. No new copy was written and no logic changed
      (`subtitle` is still computed inline in `ChipResultsPanel.jsx`
      from the same `loading`/`results.length`/`isMobile` values).
    - Row card (`ChipResultRow`): thumbnail is either the place photo
      or, per Figma's icon-tile fallback, a flat `--v2-thumb-bg` (new
      token, `#d9e0fb` — a literal, not a clean alpha step of
      `--v2-primary`) square with a `--v2-primary` icon. Name switched
      to `var(--font-display)` (Bricolage) to match the Figma headings,
      body/meta text stays `var(--font-ui)` (Inter) — same split
      Loading Screen/Place card/Explore panel already use.
    - **Type tag:** Figma's reference shows one row ("TOWNHALL") with an
      outlined/translucent tag and four rows ("HOSTEL") with a filled
      violet tag + white text — not two competing components needing a
      new rule, just each row rendering its own real `result.type`
      (already varies per item; only two types happen to appear in this
      screenshot). One consistent filled treatment
      (`background: dotColor(type)`, white text) covers it: the tag's
      color and label already differentiate by type through the
      existing `dotColor()`/`result.type` data, unchanged from before
      this session.
    - Motion: kept the existing row/card/panel entrance animations,
      retimed onto `--v2-duration-standard`/`--v2-ease-standard`, and
      added `@media (prefers-reduced-motion: no-preference)` wrapping
      around every entrance/hover-transform animation in both files —
      neither file had that guard before this session (Section 6,
      principle 3).
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
- Nav/GPS HUD (this session, started on explicit user instruction — not
  picked up per the "wait for explicit instruction" rule on its own):
  scope was three specific, user-named things, not a full reskin of every
  file in this row.
  - **Note on this session's process:** initially told the user Figma
    couldn't be reached at all (true for the `figma.com` web fetch, which
    is robots-blocked — same limitation as the Explore panel's flag
    above) without checking whether a Figma MCP connection was available
    in this session. One was. Once that was pointed out and checked, node
    4:429 was pulled directly and the HUD below reflects the real design,
    not a guess. Worth remembering for future sessions: check for a
    connected Figma MCP tool before concluding a node can't be fetched at
    all — the `figma.com` block only rules out the plain web-fetch path.
  - **Navbar nav-active color state** (Figma node 4:488, the bar itself,
    within the 4:429 frame — confirmed via the Figma MCP connection):
    added `navActive`-driven styling to `MobileSheet.jsx`'s `.navbar` (the
    tab strip, not this row's own files). The real design is a solid blue
    fill (`--v2-nav-active-bg`, `#325ece` — not `--v2-primary`, a genuinely
    distinct color, confirmed from the frame, not a derivation), inactive
    tab labels go to `--v2-nav-active-tab-text` (`#ccc3d8`), and the
    always-accented Nav tab keeps its normal `--v2-primary-outline` pill
    unchanged, just swapping its label to a teal-mint
    `--v2-nav-active-accent` (`#6bd8cb`) instead of violet. This replaced
    an earlier guess in this same session (solid `--v2-primary` fill,
    white tab text) made before the Figma connection was checked — see
    the note above. No new prop: `navActive` was already threaded into
    `MobileSheet` from `MapPage` (previously only consumed by the
    embedded `NavPanel`), just not used on the bar itself yet.
  - **`NavHud` redesigned to v2** (`NavHud.jsx`/`.module.css`, Figma nodes
    4:437 top instruction card, 4:459 "up next" strip, 4:475/4:476 bottom
    distance card): split from one edge-to-edge dark bar into two floating
    cards — matches the Figma frame's own split, and is this session's
    real answer to "give the map room to pinch-zoom": a top card (turn
    icon, instruction, voice/end buttons, up-next strip) and a bottom card
    (distance remaining + destination) that sits just above the tab bar
    via `--mob-sheet-peek`, the same var `MobileSheet.module.css` already
    uses for its own panel. Same props in, same props out — no data or
    behavior change, purely layout/visual. Color substitutions per
    Section 3: the frame's icon/button fills use `#630ed4` (the original,
    superseded Loading-Screen primary) — mapped to `var(--v2-primary)`
    throughout instead of the literal hex. New tokens added to
    `tokens-v2.css`, all confirmed from this frame rather than guessed:
    `--v2-error`/`--v2-error-container` (previously flagged "confirm
    before tokenizing" with no hex — now confirmed from the HUD's "End"
    button), `--v2-icon-btn-bg`, `--v2-hud-upnext-bg`. Figma's "Floating
    Controls" (a recenter button + a second FAB, node 4:466) were **not**
    built — no existing "recenter" action to wire up (the map already
    auto-recenters via `panTo` when the person isn't mid-gesture), and the
    second FAB would duplicate `MobFabCluster`'s existing locate button;
    revisit as its own decision rather than guessing new interaction here.
  - **Stale "Start Navigation" card behind the HUD** (reported directly,
    with a screenshot showing it still visible above the new distance
    card and below the nav-active navbar) — pre-existing bug, not
    introduced this session, just now visible/reported: `NavPanel.jsx`
    (the "Nav" tab's pre-launch body — the launch button + hint text)
    already received a `navActive` prop but only used it for a cosmetic
    class on the button; it never stopped rendering once navigation
    actually started. Separately, `MobileSheet.jsx`'s sheet open/closed
    state was never tied to `navActive` either — `handleNavLaunch` in
    `MapPage.jsx` only sets `navOpen`, never touches the sheet — so
    whichever tab's panel happened to be open when nav launched (Nav's
    or any other tab's) just stayed open, sitting behind NavHud instead
    of being replaced by it. Two-part fix: `MobileSheet.jsx` now
    collapses the sheet to `'peek'` the instant `navActive` flips true
    (handles the general case, any tab), and `NavPanel.jsx` also returns
    `null` while `navActive` is true as a second line of defense (covers
    manually reopening the Nav tab mid-navigation, which the sheet
    auto-collapse alone wouldn't catch). Removed `NavPanel.module.css`'s
    now-unreachable `.launchBtn.active` variant along with it.
  - **All other open cards, not just the sheet, minimized on nav start**
    (reported directly, as a follow-up to the fix above): the person's
    ask was broader than just `NavPanel`/the sheet — "only the HUD screen
    should be up" once navigation starts, full stop. Added a
    `MapPage.jsx` effect, keyed the same way as the existing
    `navActive`-driven view-mode effect right above it, that clears a
    selected waypoint's `PlaceCard` (`selected`), an open route-segment
    `DetailModal` (`selectedSegmentId`), an expanded `ChipResultsPanel`
    (`activeChip`), and the full-screen `MobileSearchOverlay`
    (`mobileSearchOpen`) the instant `navActive` flips true — none of
    those were ever tied to `navActive` before. Notably this also covers
    the case where nav is launched *from* a `PlaceCard`'s "Navigate"
    button (`handlePlaceCardNavigate`) — that never closed the card it
    was launched from. Deliberately left alone: `authModalOpen`,
    `adminPanelOpen`, `suggestModalOpen`, `mySubmissionsOpen`,
    `reviewTarget` — these are blocking modals for a task the person is
    mid-way through, not ambient cards, and nav can't start while auth
    is what's blocking it in the first place. Flag this if it turns out
    wrong rather than have silently guessed either way.
  - **Mobile zoom-stuck bug** (`NavigationController.jsx`,
    `gpsConstants.js`) — **real functionality change, flagged per Rule 7,
    made on direct, explicit user instruction, not guessed:** on
    `startNavigation()`, `map.fitBounds()` on the *entire route* has been
    replaced with `map.setView([lat, lng], NAV_START_ZOOM, ...)`, a fixed
    close zoom (18, new `gpsConstants.js` constant) centered on the user.
    `fitBounds` over a full route usually landed near `minZoom` (14) and
    then just sat there — nothing else in this file ever re-zooms, only
    `panTo`s to recenter (`updateHUD`/`useGpsTracking.js`) — which on
    mobile read as the map being stuck zoomed out for the whole nav
    session. `minZoom`/`maxZoom` and Leaflet's default pinch/scroll zoom
    were never actually disabled anywhere in this codebase; the bug was
    purely the wide starting framing having nothing to bring it back in
    from. Same `setView` call added to the persisted-session-restore
    effect for consistency (a resumed nav session hit the identical
    ambiguity). This does change nav's default starting zoom versus
    before — that's the point of the fix — but doesn't touch, lock, or
    disable any interaction: the person can still pinch in/out at any
    time, same as before.
- **`NavDestPanel` — the "Where to?" panel (this session, Figma node
  1:311, "Navigation Mode"; started on explicit user instruction, not
  picked up on its own):** redesigned to v2 light tokens, plus two real
  functionality changes, both made on direct, explicit user instruction
  and flagged per Rule 7, not guessed.
  - **Mode picker removed — walk mode hardcoded.** The Figma frame
    shows no Walk/Moto/Drive control at all. `NavDestPanel.jsx`'s
    `MODES` array and `.modeRow` were deleted; `mode`/`onModeChange`
    are no longer passed down from `NavigationController.jsx`. Rather
    than touch `fetchRoute`/`navModeRef` (functionality files, out of
    scope for this pass), `mode` state was left exactly as-is — it
    already defaulted to `'foot-walking'` and nothing calls `setMode`
    anymore, so it now simply never changes. Net effect: walking is
    the only mode, with zero changes to the routing logic itself.
  - **"Popular places on campus" added — shares data with Explore, not
    a separate list.** `MapPage.jsx` now passes `explorePicks={
    explorePicksState.picks}` into `<NavigationController>` — the
    *same* `useExplorePicks(waypoints)` result the Explore panel
    already renders from (no second call to the hook, no new fetch).
    `NavigationController.jsx` takes the first two entries of that
    array as `popularPlaces`, adding a one-shot-location-based "X away"
    label (`useOneShotLocation` + `fmtDist`, both reused from the
    Explore feature — same non-blocking, no-permission-prompt-gate
    approach Explore's own cards use, not reimplemented). Tapping a
    popular-place card calls the panel's existing `setNavDest` (the
    same function the destination-search dropdown already uses), so
    picking one just sets it as the nav destination — no new selection
    logic. Because "popular" here always reads off Explore's own
    `picks` array, an admin featuring/un-featuring a place in
    `AdminEditModal.jsx` updates both sections at once.
  - **Static "from/to" route rows dropped.** The old header ("Where
    to?" title + close button) and the "Your current location" /
    destination two-row layout (with connecting line) had no props
    tied to them — pure markup — and don't appear in the Figma frame,
    which shows a single "Where to?" search bar instead. Folded into
    one `.searchRow` reusing the exact same `destInputValue`/
    `onDestInputChange`/`dropdownResults`/`onPickResult` props as
    before (same data in, same data out) — only the container markup
    changed. The hint text (`hint` prop — several dynamic states, e.g.
    "Destination set: X", routing-failure messages) is still rendered
    verbatim, just inside a restyled icon+card container instead of
    plain centered text; no hardcoded copy was added to replace it.
  - Desktop keeps the v1 fixed-left-panel mechanics (position, slide-in
    animation) — no separate desktop Figma frame was given, so per the
    pairing rule this reuses the same v2 token decisions as the mobile
    bottom sheet rather than reinventing them, same precedent as the
    Search bar and Nav HUD passes.
  - Colors: reused existing v2 tokens wherever a hex was within a hair
    of one already defined — `--v2-hud-upnext-bg` (#f2f3ff) for the
    search row and hint card fills, `--v2-primary` in place of the
    frame's literal `#630ed4`/`#7c3aed` (same "map the literal to the
    token" call as the Nav HUD pass), `--v2-neutral` for card-name text
    (frame's `#131b2e` is a hair off `--v2-neutral`'s `#0f172a`, same
    tolerance already used for the Search Results pass). `#dae2fd`
    used as a literal border color (not a new token) since it's already
    used the same way, untokenized, in `NavHud.module.css`. Popular-card
    icon badges use `dotColor(type)` from `chipConfig.js` — the same
    per-type color function `ExploreCard` uses — rather than the
    frame's two one-off swatches, so a card's color means the same
    thing here as it does in Explore.
  - Motion: hover/press transforms added to the popular-place cards and
    the Start Navigation button (existing button already had them,
    kept), wrapped in `@media (prefers-reduced-motion: no-preference)`
    per Section 6.

---

- **`GpsPanel` — the GPS Signal screen (this session, Figma node 31:52
  "GPS Screen", pulled via the Figma MCP connection):** redesigned to v2
  light tokens. UI/CSS only — no functionality changes; `gps` still
  carries every value from `useGpsTracking.js` unchanged.
  - **Header shown in both embedded and non-embedded now, superseding
    the earlier "hide title when embedded" behavior** (set back when
    `LayersPanel` was the only precedent and no GPS-specific reference
    existed): the Figma frame *is* the mobile/embedded view and shows
    the full title ("GPS Status") + subtitle + badge, so that's now
    rendered in both contexts; `embedded` still exists as a prop and
    still governs content padding/density (mobile vs. desktop Sidebar),
    just no longer toggles the header's visibility.
  - **Subtitle line is new copy, computed inline from data already
    passed in** (`gpsBtnDisabled`/`isTracking`/`tier`/`warning`) — no
    new prop or state, same precedent as `ChipResultsPanel`'s status-
    line consolidation. The frame's exact copy, "Acquiring high-accuracy
    lock," is used for the tracking-but-not-`good` case.
  - **Kept, not in the frame:** the 5-bar signal-strength meter. Unlike
    the from/to rows dropped from `NavDestPanel`, these bars are bound
    to real live data (`activeBars`/`tier`), not unbound decorative
    markup, so removing a real data visualization wasn't assumed without
    an explicit instruction — restyled to v2 tokens (bars use
    `--v2-secondary`/`--v2-tertiary`/`--v2-error` by tier, track color
    reuses the already-defined `--v2-track`) and kept as a compact strip
    under the header instead.
  - **Not built: the "Altitude" stat cell the frame shows.**
    `useGpsTracking.js` has no altitude field — inventing a static value
    would misrepresent live GPS data, so the stat grid keeps the three
    real fields (Accuracy, Speed, Heading) with Heading spanning the
    second row, rather than a fabricated fourth cell.
  - Value strings (`accuracyText`/`speedText`/`headingText`) render as
    the single already-formatted string the hook returns (handles edge
    cases like "GPS unavailable"/"Warming up…") rather than split into a
    big-number + small-unit pair like the frame — splitting would mean
    parsing that string's format here, reaching into `.js`-owned
    formatting logic, out of scope for a markup/CSS-only pass.
  - Colors: the frame's `#630ed4` (LIVE badge) maps to `var(--v2-primary)`
    per Section 3's established substitution, not the literal hex; the
    frame's `rgba(204,195,216,*)` card borders reuse the same
    near-duplicate-of-`--v2-border` plain-rgba treatment `NavHud` already
    set; stat-value text (`#131b2e`) reuses `--v2-neutral`, same
    tolerance already used for the Search Results pass. One genuinely new
    token: `--v2-error-text` (`#ba1a1a`), the "End Session" button's
    outlined-state text/icon color — distinct from `--v2-error`
    (`#93000a`), not a tint step of it.
  - `MobileSheet.jsx`'s `.panelLight` override (previously only applied
    to the `layers`/Explore tab) now also applies to the `gps` tab, same
    precedent — `GpsPanel` is real v2 light content now, not a
    placeholder that needs the sheet's v1 dark background showing
    through. Desktop's `Sidebar.jsx` needed no wrapper change: `GpsPanel`
    owns its own light card (`--v2-surface`, rounded), same "self-
    contained card floating in the still-dark rail panel" pattern
    `ExplorePanel` already uses there.
  - Icons: stat-cell icons (`Crosshair`/`Gauge`/`Compass`) and the
    start/stop button icons (`LocateFixed`/`CircleStop`) are new
    `lucide-react` additions — markup only, matching Section 5's icon
    contract and this row's existing icon language (`LocateFixed`
    already used by `MobFabCluster`'s locate button).
  - **Follow-up (this session), Figma node 64:2:** the bar section was
    restyled into a full "Visualization Card" (soft violet card, taller
    bars, decorative blurred orb, big number + caption underneath) per
    this second frame. Per explicit instruction, the frame's own readout
    — "8/12 Satellites in view" — was dropped (no satellite data exists
    anywhere in this app) and replaced with a real one built from the
    same `activeBars`/`tier` values already driving the bars:
    `{activeBars}/5` + a tier-derived caption ("Strong/Fair/Weak
    signal"). Bar count stayed at 5 (real `activeBars` granularity)
    rather than the frame's 15 decorative bars, so as not to fake
    precision the app doesn't have. Card shadow reuses `NavHud`'s
    `.topCard` spec verbatim for continuity across this row; card
    background is an exact match for the already-defined
    `--v2-hud-upnext-bg`, no new token needed.
  - Motion: the "End Session" (tracking) button gets a slow breathing
    pulse (`--v2-duration-breathe`/`--v2-ease-standard`, wrapped in
    `@media (prefers-reduced-motion: reduce)`) rather than the old sharp
    1.5s `btnPulse` — matches Section 6's "calm, not urgent" guidance;
    the idle/primary button gets the standard press-scale feedback.

---

- Search results — mobile overlay + shared dropdown list (this session,
  Figma node 4:249, "Search Results Redesign"): completes both
  previously-pending Search rows in one pass, since `MobileSearchOverlay`
  and `DesktopSearchBar`'s `.dropdown` both render the same shared
  `SearchDropdownList`/`SearchResultItem` content — redesigning that
  shared file necessarily finishes both, and the pairing rule calls for
  doing them together anyway.
  - **Font/color gap, flagged rather than silently reconciled:** this
    frame comes back in plain Tailwind slate colors and a "Nimbus Sans"
    font, not the "Lumina Campus Utility" style guide's lavender-tinted
    neutrals or Bricolage/Inter pairing every other screen has matched.
    Nimbus Sans isn't in Section 4's shortlist and isn't bundled, so
    text still maps to `var(--font-display)`/`var(--font-ui)` as usual.
    For color, reused an existing v2 token wherever this frame's hex was
    within a hair of one already defined (same call as the Quick Chips
    chip-border precedent): `#0f172a` heading/input text is an exact
    match for `--v2-neutral`; `#64748b` subtext/section-label is close
    enough to `--v2-text-variant` to reuse; the `#f5f3ff` icon-badge fill
    is a near-exact tint step of `--v2-primary-glow`, badge icon color
    reuses `--v2-primary` — the same 40×40 icon-badge pattern
    `ChipResultsPanel`'s header already uses, just at this frame's own
    `var(--r-md)` corner instead of a full circle. Two genuinely new
    grays got their own tokens (`--v2-divider`, `--v2-input-surface` —
    see `tokens-v2.css`) since nothing close already existed. If this
    frame turns out to be an intentional break from the style guide
    (not just an export/font-substitution artifact), the reused
    text/label tokens above should be revisited.
  - Icons: unchanged — the app's per-waypoint-type icon already resolves
    through `LEGACY_ICON_MAP`/`icon(entry)` data-driven, not a literal
    asset per result; only the icon badge's size/shape/fill moved
    (16px→20px icon in a new 40×40 `var(--r-md)` tile, was a bare
    16px glyph with no badge before).
  - Desktop's `.dropdown` shell (surface/border/radius/shadow) reuses
    `ChipResultsPanel`'s desktop panel treatment — no separate desktop
    Figma frame exists for the dropdown container itself, so this
    follows the same pairing-rule reuse the collapsed pill already used.
  - Badges (`.badge`/`.badgeOsm`/`.badgeSeg`, desktop-only —
    `showBadge={false}` on mobile, matching Figma's badge-less rows)
    recolored to the existing primary/secondary/tertiary three-tier
    accent split rather than guessed at individually; no Figma reference
    showed OSM/segment badge colors specifically.
  - Motion added: the overlay's open/close now fades + slides instead of
    an instant `display` cut (Section 6's modal guidance), and hover
    tints on rows/back/clear buttons — `visibility`/`pointer-events` on
    the closed state keep it exactly as unreachable as `display: none`
    was, no behavior change.
- **Every nav entry point now routes to `NavDestPanel`, not `NavPanel`**
  (reported directly: "all navigation buttons should lead to the newly
  built one, not the old card... one navigation logo at the search bar
  and one on the navbar so both should have the new one") — real
  functionality change (what a tap does), flagged per Rule 7, made on
  direct explicit instruction, not guessed. Root cause: `NavPanel.jsx`
  (a plain "START NAVIGATION" card + hint text, still v1 dark tokens) was
  never actually the same thing as `NavDestPanel.jsx` (the redesigned
  "Where to?" panel, Figma node 1:311, flagged above) — it was a separate,
  older pre-launch screen that sat *in front of* it. Every nav trigger
  used to open `NavPanel` first and require a second tap on its own
  button to reach `NavigationController` (whose `destPanelOpen` already
  defaults to `true` — i.e. `NavDestPanel` was always one extra,
  redundant tap away). Fixed at all four entry points to call
  `onNavLaunch` (`MapPage.jsx`'s `handleNavLaunch`) directly instead:
  - **Mobile navbar's "Nav" tab** (`MobileSheet.jsx`): `handleTabClick`
    special-cases `tab.key === 'navigate'` now — collapses the sheet and
    calls `onNavLaunch` directly, the same way the `isAction` tabs
    (Suggest/Profile) already hand off to a callback instead of opening
    a panel body.
  - **Mobile search bar's nav icon** (`MapPage.jsx`): its `onNavigate`
    prop was `handleMobNavTrigger`, a function whose *entire job* was
    opening the sheet to the 'navigate' tab (i.e., to `NavPanel`) — now
    points at `handleNavLaunch` directly instead; `handleMobNavTrigger`
    itself deleted, no longer serves any purpose.
  - **Desktop rail's "Nav" item** (`Sidebar.jsx`): identical bug, same
    fix — `handleRailClick` special-cases `item.key === 'navigate'` to
    collapse the rail and call `onNavLaunch` directly rather than opening
    its own panel body.
  - **Desktop search bar's nav button** (`DesktopSearchBar.jsx`): already
    correct before this session (`onNavigateClick={handleNavLaunch}`
    directly) — untouched, included here only to confirm all four were
    checked, not just the two the report named.

  `NavPanel.jsx`/`.module.css` are consequently **dead code** — no
  import anywhere renders them anymore (confirmed by grepping the whole
  `src` tree post-fix). Left in place rather than deleted: removing a
  whole component file is a bigger call than this session's brief, and
  someone may want to know how the old pre-launch flow worked. Flagging
  here rather than deleting silently — worth an explicit decision (and a
  follow-up pass to delete + drop `NavPanel.jsx`'s import list) once
  confirmed nothing else needs it. `Sidebar.module.css`'s
  `.panelHeaderGeneric`/`.panelTitleGeneric` are now similarly unused
  (only consumer was the deleted `Sidebar.jsx` navigate-panel block) —
  left in place for the same reason.

- **Three cross-app mobile bugs, reported directly, not scoped to one
  screen** — real functionality changes, flagged per Rule 7, made on
  direct explicit instruction, not guessed.
  - **Page zooms when a keyboard opens (search bar, suggest-a-place,
    etc.).** Root cause confirmed as suspected: mobile Safari/Chrome
    auto-zoom the whole page on focusing any `input`/`textarea`/`select`
    whose computed font-size is under 16px. Rather than hunt down and
    patch every input's own component CSS individually (17 files have
    at least one), added one global rule (`src/index.css`) that floors
    `input, textarea, select` to `16px !important` under
    `max-width: 768px` (this codebase's own mobile breakpoint) — desktop
    untouched, since this browser behavior is mobile-only.
  - **"Elements clash — I can open three things at once and they won't
    give room for each other."** `MapPage.jsx` owned roughly ten
    independent open/closed booleans (`selected`, `selectedSegmentId`,
    `activeChip`, `mobileSearchOpen`, `sheetState`, `suggestModalOpen`,
    `mySubmissionsOpen`, `reviewTarget`, `adminPanelOpen`,
    `authModalOpen`) and none of them closed any of the others — each
    was only ever opened or closed on its own, so any combination could
    end up stacked on screen simultaneously. Added one
    `closeOtherOverlays(keep)` helper that closes every surface except
    the one about to open, called at every place that actually opens one
    (`handleSelectPlace`, `handleViewSegment`, `handleChipClick`,
    `handleSheetStateChange`, the search bar's open/toggle handlers,
    `openAuthModal`, `handleSuggestPlaceClick`, the admin-panel-open
    success callback, `onArrival`'s auto-opened review modal, and
    "view my submissions"). `handleSheetStateChange` wraps
    `onSheetStateChange` specifically so every way of opening the mobile
    sheet (tab taps inside `MobileSheet.jsx`, the search bar's toggle
    button) is covered by wrapping that one prop, rather than editing
    each call site inside that file individually. This is the same
    principle as this session's earlier `navActive`-triggered overlay
    close (still in place, untouched) — generalized from "clear
    everything when nav starts" to "clear everything whenever anything
    else opens."
  - **Pinching to zoom the map sometimes zooms/moves the whole page
    instead, requiring a refresh.** `index.html`'s `<meta
    name="viewport">` only ever set `initial-scale=1`, with no
    `maximum-scale`/`user-scalable` — nothing stopped the browser's own
    page-level pinch-zoom from competing with Leaflet's own zoom
    handling on `.map` (which already sets `touch-action: none`,
    `MapShell.module.css`, specifically so the browser hands raw touch
    events to Leaflet instead of handling them itself — which only
    works if the page beneath it isn't *also* zoomable). Rather than
    change the global, SEO-facing `index.html` meta tag (which would
    also lock pinch-zoom on the landing page — an accessibility
    regression, WCAG 1.4.4, for a normal scrollable content page that
    has no reason to disable it), `HomeRoute.jsx` now swaps the meta
    tag's `content` to add `maximum-scale=1, user-scalable=no,
    viewport-fit=cover` only while the `/map` route is mounted, restoring
    the original on unmount — same scoping pattern as the
    `map-viewport` body class right below it in that same file, added
    in an earlier slice for the identical "only this route needs this"
    reason. Not airtight on every browser (recent Safari/Chrome versions
    deliberately ignore `user-scalable=no` for that same accessibility
    reason) but removes the page-level zoom as a competing gesture
    handler on the browsers that do respect it — the actual mechanism
    behind the "interface moves/gets stuck" symptom.

- **Review modal / rating screen (this session):** redesigned
  `ReviewModal.jsx`/`.module.css` against Figma node 59:2 ("Rating
  Screen"), pulled via the Figma MCP connection. Same props (`dest`,
  `onClose`, `onSubmitted`, `user`), same state variables, same
  `handleSubmit`/`submitReview` call, same reset-on-`dest`-change
  effect — no functionality changes. `MapPage.jsx`'s
  `<ReviewModal dest={reviewTarget} onClose={...} onSubmitted={...}
  user={auth.user} />` call site untouched and confirmed compatible.
  - **Structural decision, flagged:** the frame is a bottom sheet
    (rounded top corners only, anchored to the viewport bottom,
    grabber handle, `max-width: 672px` staying bottom-anchored even at
    that width) — not the shared `Modal` component's centered card
    that `Modal.module.css` established on the Waypoint suggestion
    session. Adding a variant prop to `Modal.jsx` to support this
    would be a shared-component change touching
    `AuthModal`/`SaveModal`/`DetailModal`/`AdminEditModal` (all still
    "Not started") — out of scope per Rule 1. Instead, `ReviewModal`
    now builds its own overlay/sheet markup and no longer imports
    `Modal`/`Modal.module.css` at all. Externally-visible behavior is
    unchanged from before: X-button close, backdrop-click-to-close
    (this modal already had `closeOnBackdrop` on — same behavior, just
    now implemented locally instead of via that prop), same
    Skip/Submit Review footer buttons and disabled states. No other
    modal is affected by this change.
  - **Grabber handle omitted, not just left decorative:** the frame
    shows one, but a static handle with no drag-to-dismiss behind it
    reads as a broken affordance — and wiring up real swipe-to-dismiss
    would be new interaction behavior, out of scope per Rule 1/7. Left
    off entirely (confirmed by direct instruction this session, after
    initially shipping it decorative); top of the sheet is plain.
    Flag if a future session is asked to add the real gesture as an
    explicit, separate instruction.
  - One literal override, same precedent as the Destination Arrived
    and Waypoint suggestion sessions: the frame's destination-name
    accent and "Submit Review" button are a flat `#630ed4` — used the
    authoritative `--v2-primary` (`#7c3aed`) instead.
  - Star color: kept the app's existing literal `#ffc857` for a
    *filled* star (same precedent this file already documented
    pre-redesign, matching `PlaceCard.module.css`'s `.ratingFilled`) —
    no Figma reference showed a different filled-star color. The
    frame's *unfilled* stars are a pale lavender-gray with no exact
    hex confirmable from the exported node (vector fill wasn't
    inspectable via the MCP connection) — used the closest existing
    token, `--v2-muted`, rather than inventing a new one. Flag if an
    exact literal surfaces later.
  - Motion: overlay fade + sheet slide-up-in on open
    (`var(--v2-duration-standard)`/`var(--v2-ease-standard)`), guarded
    by `prefers-reduced-motion: reduce`; Submit button gets the
    standard hover lift + `:active` scale-down, no idle motion, same
    as every other v2 primary button in this guide.

- **Destination Arrived banner (this session):** redesigned
  `NavArrivedBanner.jsx`/`.module.css` against Figma node 67:130
  ("Destination Arrived"), pulled via the Figma MCP connection. Same
  props (`destName`, `onDismiss`) and the same 8s auto-dismiss
  `useEffect`/`setTimeout` — no functionality changes.
  - Reused the shared v2 Modal contract (`.overlay`'s `var(--v2-scrim)`
    backdrop + blur, `.banner`'s `var(--v2-surface)`/`var(--v2-track)`
    card, both animation curves) that `Modal.module.css` set on the
    Waypoint suggestion session, even though this component doesn't
    render through `Modal.jsx` — it never has (standalone fixed
    banner, not a dismiss-on-backdrop-click modal), and adding that
    wiring now would be a functionality change per Rule 1/7, so kept
    as its own component with matching v2 visual language instead.
  - **Content decision, flagged:** the Figma frame's subtitle is the
    literal static string "Destination Reached" with no destination
    name shown. Rule 3 ("same data in, same data out") means
    `destName` still needed to render somewhere real — kept it in the
    subtitle's position, just restyled to the frame's subtitle
    typography (`var(--font-ui)`, 16px, `var(--v2-text-variant)`)
    instead of adopting the frame's literal copy.
  - **New content, per explicit instruction:** added a "Support FUTA
    Maps" link (heart icon, `lucide-react`) above the Done button,
    pointing at the same Crowdr campaign URL the landing page's donate
    CTA already uses (`CrowdrCampaignCard.jsx`/`Footer.jsx`) — kept as
    a local `CROWDR_CAMPAIGN_URL` const in this file rather than
    importing from `src/pages/landing/`, since Rule 5 keeps this
    in-app surface decoupled from that (separately redesigned)
    directory. Plain `<a target="_blank" rel="noopener noreferrer">`,
    doesn't touch `onDismiss` or any existing handler.
  - **One literal override:** the frame's "DONE" button and the
    support link are both a flat `#630ed4` — per `tokens-v2.css`'s own
    note (and the same call the Waypoint suggestion session made on
    its "Submit for Review" button), that's the superseded
    pre-style-guide violet, not the authoritative `--v2-primary`
    (`#7c3aed`). Used the token.
  - Icon ring background reuses the existing `--v2-primary-outline`
    token (`rgba(124,58,237,0.2)`) — an exact match for the frame's
    literal, no new token needed.
  - Motion: overlay/banner reuse the Modal shell's fade+scale-in
    (`var(--v2-duration-standard)`/`var(--v2-ease-standard)`, guarded
    by `prefers-reduced-motion: reduce`); added a slow breathing pulse
    (`var(--v2-duration-breathe)`) on the icon ring per Section 6's
    loading-indicator guidance — this card doesn't have a spinner, but
    the confetti icon is the equivalent "something is actively
    happening" moment, guarded by
    `prefers-reduced-motion: no-preference`; Done button gets the
    standard hover lift + `:active` scale-down (0.97), no idle motion.
  - Kept the existing `PartyPopper` icon (already used pre-redesign)
    for the "Confetti / Flair" icon slot rather than sourcing a new
    icon for the frame's custom cursor-sparkle artwork — same
    `lucide-react`-stays-as-is precedent as every other icon swap in
    this guide, and conceptually the closest match already in the
    library.

- **Waypoint suggestion (this session):** redesigned `SuggestWaypointModal`,
  `MyWaypointSubmissionsPanel`, and `SubmissionToast` against Figma node
  1:253 ("Suggest a Place"), pulled via the Figma MCP connection. No
  functionality changes — same props, state, handlers, and data flow on
  all three components; the file-input element for photos is unchanged
  (just relabeled/hidden behind a styled `<label>`, same `onChange`).
  - **This is the first modal screen redesigned**, so per Section 5's
    "Modal — not yet defined, TBD by first modal screen," this session
    also redesigned the **shared** `src/components/ui/Modal.jsx`'s
    `Modal.module.css` (overlay/header/title/close/body/footer/`.btn*`
    variants) to v2 — same "first session sets the contract" precedent
    the Loading Screen established for the palette. `Modal.jsx` itself
    (the JSX/props) is untouched, only its CSS module.
  - **Real consequence, flagged explicitly:** `Modal.module.css` is also
    imported by `AuthModal`, `ReviewModal`, `SaveModal` (kml),
    `DetailModal` (segments), and `AdminEditModal` — all still "Not
    started" in this table. Their overlay/header/footer chrome will now
    render in the v2 light theme immediately, while their own body
    content (each screen's own `.module.css`) is still v1 dark-styled,
    until each of those screens gets its own session. This mismatch is
    expected and temporary, not a bug — same tradeoff as any shared
    token/component the guide's "first session sets it" pattern
    produces, just more visually obvious here than a color token would
    be. Whoever runs Auth modal / Review modal / Admin panel next should
    expect the shell to already look right and only need to redo the
    body.
  - Added one new button variant, `.btnOutlined` (white fill, thin
    `var(--v2-track)` border, `var(--v2-neutral)` text) rather than
    repurposing `.btnSecondary` — the frame's "Cancel" button matches
    Section 5's "Outlined" contract description, not "Secondary"'s
    lavender-tint fill. Left `.btnSecondary`/`.btnDanger` on v1 styling
    since no Figma reference has shown those variants yet (Rule 7: don't
    guess a fill color nothing in this screen needed).
  - `SuggestWaypointModal` switched to passing its Cancel/Submit buttons
    through `Modal`'s existing (already-supported, previously unused by
    this component) `footer` prop instead of rendering them inline in
    the body — matches the grid footer the Figma frame shows (1fr/2fr
    split) and is a purely structural JSX change, no new props on
    `Modal` itself.
  - `MyWaypointSubmissionsPanel.jsx` needed **no JSX changes at all** —
    same class names throughout, only its CSS module moved to v2 tokens.
  - No Figma frame was supplied for `MyWaypointSubmissionsPanel` or
    `SubmissionToast` specifically (only "Suggest a Place," node 1:253)
    — both restyled to the v2 tokens/contracts that frame set (borders,
    type, badge shapes already established elsewhere in the app) rather
    than left on v1 dark styling, which would have looked broken inside
    the now-light modal shell. Flag if a real reference for either
    surfaces later.
  - One deliberate override of the frame's literal pixel value: the
    "Submit for Review" button in the Figma export is a flat `#630ed4`
    fill — per `tokens-v2.css`'s own existing note, that's the
    superseded pre-style-guide violet, not the authoritative
    `--v2-primary` (`#7c3aed`). Used the token, not the frame's literal
    hex.
  - Motion added: modal fade+scale-in/out (Section 6's modal guidance,
    this shell had none before), coordinates-confirmed banner fades in
    on appearance, and the submission toast now fades+slides up instead
    of an instant appear — all wrapped in
    `prefers-reduced-motion: reduce` guards.

- **Auth modal (this session):** redesigned `AuthModal.jsx`/`.module.css`
  against Figma nodes 82:2 ("Sign In") and 82:58 ("Create Account"),
  pulled via the Figma MCP connection. No functionality changes — same
  props, state, handlers, and data flow (login/signup/profile tabs,
  Google auth, forgot-password, sign-out, guest-limit message, live
  profile stats) as before. Does not adopt the shared `Modal.jsx` shell —
  same "AuthModal has always had its own namespace" precedent the
  component's own header comment already documented pre-redesign.
  - **Shell reconciliation, flagged:** the two frames disagree on layout
    — 82:2 has no tab switcher (just a "Welcome Back" heading + a bottom
    "Sign up" text link) while 82:58 has the segmented Sign In/Create
    Account control the app's `tab` state already drives. Since this is
    one real shared component, 82:58's shell (brand block → segmented
    tabs → Google button → divider → form) was used as the authoritative
    structure for **both** tabs; 82:2's field set/copy (the "Forgot?"
    link, Sign In field placeholders) was dropped into that shell rather
    than building a second layout. 82:2's redundant bottom "Sign up" link
    was dropped since the segmented control above already switches tabs.
  - **Per explicit instruction:** the placeholder inline location-pin SVG
    in the brand block was swapped for the real app logo
    (`public/android-chrome-512x512.png`), plain `<img>`, no new asset
    pipeline.
  - **Font gap, same call as the Search Results session:** both frames'
    exported reference code shows "Liberation Serif" (82:2 — a Figma
    export fallback for missing font data, not a real pick) and "Geist"
    (82:58 — in Section 4's shortlist, but not bundled anywhere else in
    the app yet). Neither treated as a deliberate new pick for this
    screen; mapped to the already-bundled `var(--font-display)`
    (headings/buttons) and `var(--font-ui)` (labels/body) instead, same
    as every other v2 screen. Flag if Geist is explicitly requested.
  - **One literal override, same precedent as every other v2 screen:**
    both frames' primary button/link color is a flat `#630ed4` — used
    the authoritative `--v2-primary` (`#7c3aed`) instead.
  - **New content, per explicit instruction:** added a "By signing up,
    you agree to our Terms and Privacy Policy." line under the signup
    form (82:58 shows this copy) as real `react-router-dom` `Link`s to
    the app's existing `/terms` and `/privacy` routes
    (`src/pages/legal/*`, already wired in `App.jsx`) — same same-tab
    in-app navigation pattern the landing page's `Footer.jsx` already
    uses for those routes. Plain links, no new props/handlers; clicking
    one also calls the existing `onClose` so the modal doesn't sit open
    behind the legal page.
  - Field inputs got leading icons (`Mail`/`Lock`/`User` from
    `lucide-react`, matching both frames) and the password field's
    custom show/hide eye SVGs were swapped for `lucide-react`'s
    `Eye`/`EyeOff` — same "icons stay lucide-react" contract as every
    other v2 screen. The sign-out button's inline SVG was swapped for
    `lucide-react`'s `LogOut` for the same reason; profile-tab layout
    itself (avatar, stats, sign-out) had no Figma reference this
    session, so it was restyled to v2 tokens only, not restructured.
  - Motion: overlay fade + modal pop-in reused from the pre-redesign
    keyframes, retimed to `var(--v2-duration-standard)`/
    `var(--v2-ease-standard)`, guarded by `prefers-reduced-motion:
    reduce` — same treatment as every other v2 modal-style surface.

## 8. Open decisions (fill in as they're made)

- **v2 palette**: set (Section 3) — primary/secondary/tertiary/neutral defined
- **Component contracts**: partially set (Section 5) — buttons/search bar defined; modal/panel/input still TBD
- **Fonts per screen**: not yet assigned beyond Loading Screen — Section 7 table
- **Motion tokens** (`--v2-ease-standard`, `--v2-duration-*`): not yet added to `tokens-v2.css` — add on first screen that uses them (Section 6)