# Maps By FUTA — Landing Page Redesign: Slice Plan

This document is a self-contained handoff spec. Each slice below can be
given to a separate LLM/session with just that slice's section pasted in,
plus the "Global Context" section every slice needs regardless of which
one it's doing. Slices are ordered **simplest → hardest**, which roughly
tracks lowest → highest token usage per slice — do them in order if one
model is doing all of them; hand out in parallel across models if not
(note the "Depends on" field — anything depending on Slice 0 needs it
merged first).

**Important distinction:** `BRAND_GUIDELINES.md` in this repo governs the
**in-app map tool** (dark theme, `--surface: #0b1326`, violet/teal/amber
tokens) and is explicitly "pixel-identical continuity, not a redesign" —
**do not touch it, and do not touch anything under `src/pages/MapPage.jsx`
or the map UI.** Everything in this plan is scoped to the **marketing
landing page only** (`src/pages/LandingPage.jsx` and everything under
`src/pages/landing/`), which is getting a deliberate light-mode
redesign, separate from the app's dark theme.

---

## Global Context (paste into every slice)

### What this project is
Maps By FUTA is a free campus-navigation web app for the Federal
University of Technology, Akure (FUTA) — search any building/place, see
a recent photo of it, get walking/route directions. The React app lives
at `src/`, routes are `/` (marketing landing page), `/map` (the actual
tool), `/loadingscreen`. The landing page is the only thing this plan
touches.

### Why this redesign is happening
The current landing page (13 sections, ~1,800 lines) carries the dark,
violet-glow, blurred-glass theme built for the in-app map tool over onto
the marketing page too. That's wrong for a marketing page: it should
feel like a light, minimal, confident startup landing page (references:
provolo.org, skillswapafrica.com), not a dark tool UI. Color should be
used deliberately and sparingly — as an accent, not a wash.

### Target audience (for any copy decisions)
Three groups, and no single piece of copy should exclude or "other" any
of them:
1. Incoming/100-level freshers, first week of a new semester — highest
   pain, but self-conscious about visibly looking like a fresher by
   asking for directions.
2. Complete strangers/visitors passing through campus.
3. Existing students, even 2–3 years in, who still don't know every
   corner of a large campus.

Real, specific behavior to keep in mind (don't contradict this in any
visual or copy): people get dropped by the campus shuttle and then trek
on foot to their actual destination; people ask a stranger nearby
(sometimes literally inside the shuttle) "please, where is...?" and the
person asked often doesn't know either and gives wrong directions with
confidence; freshers specifically avoid asking because it marks them as
new. Users get around by foot, bicycle/"ladies-bike", car, or
shuttle-then-walk — never assume "walking" is the only mode in copy.

Real product differentiators to lean on (specific, verifiable — not
generic marketing fluff): the map shows a **recent photo** of each
destination, and routes/paths are **more current** than this area's
~6-year-stale Google Maps data.

### Locked-in copy for the Hero (do not rewrite unless the slice says so)
- **Badge/eyebrow:** `Built for FUTA`
- **Headline:** `Know exactly where you're going before you get there.`
  (accent-violet color applied to "before you get there.")
- **Subhead:** `Search any building, hostel, or campus service, see a
  recent photo before you arrive, and follow up-to-date campus
  directions designed specifically for FUTA — not outdated Google Maps
  data.`
- **Primary CTA:** `Open the Map` (solid violet pill, links to `/map`)
- **Secondary CTA:** `See how it works` (outline pill, scrolls to Video
  section)
- **Trust line under CTAs:** `475+ locations mapped · free · no
  download`

This copy went through several rounds against real copywriting research
(headline clarity > cleverness, single verifiable outcome claims, single
clear CTA, customer's-own-language over brand-speak, ~80% of visitors
only read the headline). Don't "improve" it without being asked —
if a slice's job is implementation, implement this copy verbatim.

### Brand tokens for the LANDING PAGE ONLY (new — do not confuse with BRAND_GUIDELINES.md)

```css
/* Landing-page-only light theme — scoped so it never leaks into the
   dark in-app map tool's tokens above. Suggested approach: a
   `.landing-light` class on the landing page's root wrapper, or a
   separate landing.css :root block scoped under a body class set only
   on the "/" route. */

--land-bg:            #ffffff;   /* page background */
--land-surface:       #ffffff;  /* card/section background, same as bg by default */
--land-surface-alt:   #faf6ff;  /* very light violet-tinted surface, used sparingly (stat strips, support pill bg) */
--land-border:        #ececec;  /* hairline borders throughout */
--land-border-strong: #2b2b2b;  /* outline-button borders */

--land-text-primary:   #1a1a1a;
--land-text-secondary: #5c5c66;
--land-text-muted:     #8a8a94;

--land-accent:          #6d3fc7;  /* primary violet accent — buttons, one highlighted phrase, badges */
--land-accent-tint-bg:  #f0e5ff;  /* badge/highlight backgrounds */
--land-accent-tint-border: #e3cfff;

--land-secondary-accent: #0f6e56;   /* teal/green, used ONLY in Explore section icon chips, for visual distinction from Hero's violet */
--land-secondary-tint-bg: #e1f5ee;

--land-radius-pill: 999px;
--land-radius-card: 16px;
```

Fonts (from the existing brand system, `@fontsource` packages already a
project dependency per `BRAND_GUIDELINES.md`):
- **Display/headlines:** Bricolage Grotesque, weight 800 (and 500 for
  sub-headers)
- **Body/buttons/nav:** Poppins, weights 400/500/600
- **Eyebrow/small-caps labels:** Montserrat, weight 700, uppercase,
  letter-spacing ~3px

Color usage rule: violet accent shows up in **deliberate blocks only** —
nav CTA button, hero button + one highlighted headline phrase + badge,
Explore's "+more" tile, footer's Crowdr pill. It never becomes a full
section background wash. The one exception, by design, is the FinalCTA
section (Slice 7) — see that slice for why.

### Motion/UX rules (apply throughout)
- Fade-up-on-load stagger for hero elements (badge → headline → subhead
  → CTA → trust line → preview card), ~80ms stagger, ease, translateY(10px)→0.
- Buttons: subtle hover lift + scale (`translateY(-2px) scale(1.03)`),
  scale-down on active (`scale(0.97)`), ~150ms ease. No bounce/spring
  overshoot — keep it crisp, not playful-to-the-point-of-slow.
- Any decorative line/route SVG should self-draw on load
  (`stroke-dasharray`/`stroke-dashoffset` animated to 0), not appear
  instantly — this is the one recurring motif tying sections together
  (a path/route completing itself).
- Respect `prefers-reduced-motion: reduce` — every animation above needs
  a reduced-motion fallback that shows the end state immediately with no
  transition.
- Reuse the existing `useReveal()` hook (`src/pages/landing/landingHooks.js`)
  for scroll-triggered reveals on sections below the fold, rather than
  writing new IntersectionObserver logic.

### Delivery format for every slice
Whoever implements a slice hands back **the entire codebase, zipped** —
not just the files that slice touched. Concretely:
- Zip the whole project root (everything needed to `npm install` and run
  it — so excluding `node_modules`, `.git`, and any stray non-project
  archive files that happen to be sitting in the repo), with this plan
  document (`LANDING_PAGE_REDESIGN_PLAN.md`) included at the root.
- Before zipping, update this plan document's "Slice status" table
  below to mark the slice(s) just completed, so the copy inside the zip
  always reflects current progress — the person should be able to
  unzip straight over their project directory and have both the code
  and the plan in sync, no separate changelog to cross-reference.
- Name the zip after the slice, e.g. `slice-5-explore.zip`, even though
  it contains the full codebase — the name just identifies what's new
  since the last one.
- This applies even to a slice that only touches one file — zip the
  whole codebase anyway, for consistency across slices handed to
  different sessions.

### Slice status
| Slice | Status |
|---|---|
| 1 — Delete dead weight | Done |
| 2 — Nav | Done |
| 3 — Footer | Done |
| 4 — TrustBar | Done |
| Routing fix (legal pages) | Done — bonus, found while doing Slice 3 |
| 5 — Explore | Not started |
| 6 — FAQ | Not started |
| 7 — FinalCTA | Not started |
| 8 — ProductFeatures | Not started |
| 9 — VideoSection | Not started |
| 10 — Hero | Not started |
| 11 — Integration & QA | Not started |

### Repo structure you're working in
```
src/pages/LandingPage.jsx        — composes all sections in order
src/pages/landing/
  Nav.jsx, Hero.jsx, TrustBar.jsx, ProductFeatures.jsx, VideoSection.jsx,
  ExploreSection.jsx, FinalCTA.jsx, FAQ.jsx, Footer.jsx, shared.jsx,
  landingHooks.js, landing.css
  DiscoverSection.jsx, RoadmapSection.jsx, StatsSection.jsx,
  WhySection.jsx     — being DELETED, see Slice 1
  SupportSection.jsx, CrowdrCampaignCard.jsx
                      — dead code, not imported anywhere, being DELETED, see Slice 1
```

---

## Slice 1 — Delete dead weight (simplest, ~lowest tokens)

**Depends on:** nothing. Do this first.

**Delete these files entirely:**
- `src/pages/landing/DiscoverSection.jsx`
- `src/pages/landing/RoadmapSection.jsx`
- `src/pages/landing/StatsSection.jsx`
- `src/pages/landing/WhySection.jsx` (its message — the
  freshers/visitors/veteran-students problem — has been absorbed into
  the new Hero copy; it no longer needs to exist as its own section)
- `src/pages/landing/SupportSection.jsx` (dead code — not imported
  anywhere in the current `LandingPage.jsx`)
- `src/pages/landing/CrowdrCampaignCard.jsx` (dead code — only used by
  the file above)

**Edit `src/pages/LandingPage.jsx`:** remove the imports and JSX usages
of all six components above. New section order:
```jsx
<Nav />
<Hero />
<TrustBar />
<ProductFeatures />
<VideoSection />
<ExploreSection />
<FinalCTA />
<FAQ />
<Footer />
```

**Acceptance check:** app builds with zero unused-import warnings for
anything in this slice; `/` renders with no console errors about
missing components.

---

## Slice 2 — Nav.jsx (simple)

**Depends on:** Slice 1 (so its link list matches remaining sections).

Rebuild as a floating pill nav instead of the current full-width
bordered bar:
- Rounded-pill container (`border-radius: 999px`), light surface bg,
  hairline border, sits inset from the very top (not flush) —
  `margin: 20px 24px 0` or similar, not full-bleed.
- Left: logo mark (reuse `Logo` from `shared.jsx`, but check it renders
  fine on white — `mapsLogo.png`/`favicon` mark; if it was
  designed for the dark navbar, verify contrast, don't just assume).
  Circular violet badge + wordmark also acceptable per the hero mockup
  if the raster logo doesn't read well on white.
- Center/right: text links for whatever sections remain after Slice 1
  (`Features`, `FAQ`, and any others still present — pull from the
  actual final section list, not the old `links` array which still
  references deleted sections like `Explore`/`Video` by old anchor
  names; verify anchor `id`s still exist on the target sections before
  wiring scroll-to).
- Right: solid violet pill CTA `Open the map` → `/map`.
- Keep the mobile menu behavior (hamburger/X toggle) but restyle to
  match light theme.
- Scroll behavior: keep the `scrolled` state (background/blur appears
  after 40px scroll) but adjust colors for light theme — no need for
  `rgba(11,19,38,...)` dark backdrop; use `var(--land-surface)` at
  reduced opacity + light border instead.

**Acceptance check:** nav is legible and has sufficient contrast on a
white page at both scroll states; all links scroll to a section that
actually exists post-Slice-1.

---

## Slice 3 — Footer.jsx (simple)

**Depends on:** nothing structurally, but keep the existing Crowdr
support pill content/link intact — read the current `Footer.jsx` before
rewriting, don't drop the Crowdr link, the person explicitly asked to
keep it.

Rebuild in light mode:
- Logo + one-line tagline (left column) — keep it to one sentence, not
  a pitch.
- Two short link columns max (e.g. **Product**: Open the map, Features,
  FAQ; **Legal**: Privacy policy, Terms) — do not restore the old
  footer's larger link sprawl if it had one; check the current file for
  what legal/product links actually exist and carry those over, just
  fewer of them if there were more than this.
- Social icons row (whatever the current footer actually links to —
  check before assuming X/Instagram/mail).
- **Keep the "Support us on Crowdr" pill** — same violet-tint pill
  treatment as the current dark version, just re-skinned for light
  background (`background: var(--land-accent-tint-bg); border: 1px
  solid var(--land-accent-tint-border)`), centered above the bottom
  bar.
- Single bottom bar: copyright left, one short line right (e.g. "Made
  for FUTA students"), thin top border, nothing else.

**Acceptance check:** Crowdr link/pill still present and functional;
footer is visibly lighter/shorter than before, not just recolored.

---

## Slice 4 — TrustBar.jsx (simple)

**Depends on:** nothing.

Read the current file first (only 33 lines) — likely a simple strip of
trust signals/logos/stats. Recolor for light theme:
background `var(--land-surface)` or `var(--land-surface-alt)`, text
colors from the token list above, keep whatever content it currently
shows unless it's redundant with the Hero's trust line
(`475+ locations mapped · free · no download`) — if it's just repeating
that same stat, consider whether TrustBar should be cut or should show
something the Hero doesn't (check content before deciding, don't
assume).

**Acceptance check:** no dark-theme colors (`--surface`, `--panel`,
`rgba(11,19,38,...)`, etc.) remain in this file.

---

## Slice 5 — ExploreSection.jsx (small–medium)

**Depends on:** Slice 1.

Reskin in light mode as a grid of category tiles, and **replace the
category list** with the most-visited student spots (this is a content
change, not just a style change):

Categories to show (in this order): Faculties, Lecture halls, Hostels,
Library, ATMs & banks, Printing shops, Student affairs, Church, Mosque,
then a final "+ more" tile linking into the map's full category list.
Church and mosque are both included, side by side, deliberately even.

Visual spec:
- Section header: small Montserrat eyebrow ("Explore", teal-colored per
  `--land-secondary-accent`), Bricolage Grotesque H2 ("The places
  students visit most"), one Poppins subline.
- Grid of rounded cards (`border-radius: 14px`, `var(--land-border)`
  hairline border, `var(--land-surface)` bg): each card has a small
  icon chip (teal-tinted bg `var(--land-secondary-tint-bg)`, teal icon
  `var(--land-secondary-accent)`) + label underneath, centered.
- The "+ more" tile uses the violet accent instead of teal (visually
  marks it as a different kind of action — a link out, not a category).
- Hover: subtle lift (`translateY(-2px)`) + border color shift to a
  light teal, ~150ms ease.
- Use `lucide-react` icons per `BRAND_GUIDELINES.md`'s icon system —
  check `src/lib/legacyIconMap.js` for the existing icon choices for
  these place types (church/mosque don't have confirmed Lucide
  equivalents per that file — may need a custom SVG or a decision here,
  don't just guess one).

**Acceptance check:** exactly these 9 categories + 1 "+more" tile, no
leftover dark-theme colors, `useReveal()` used for scroll-in if the
current file already had a reveal animation (preserve it, just retheme).

---

## Slice 6 — FAQ.jsx (simple)

**Depends on:** nothing.

Read current content first (52 lines — likely an accordion). Keep the
questions/answers as-is unless they reference a deleted section
(Discover/Roadmap/Stats/Why) — if any FAQ item references those, that
item needs rewriting or removal, check for this specifically. Restyle
accordion for light theme: white cards, hairline borders, violet accent
only on the expanded state's icon/indicator, not the whole card.

**Acceptance check:** no FAQ answer references a section that no longer
exists.

---

## Slice 7 — FinalCTA.jsx (simple–medium)

**Depends on:** nothing structurally.

This is the **one deliberate exception** to "light background
throughout" — both reference sites (Provolo, SkillSwap Africa) use one
saturated full-bleed color slab for their final CTA, and that contrast
is what makes it work as a closer. Keep this section as a solid violet
(or dark navy — pick one, be consistent with whichever reads better
against the violet-on-white used everywhere else) rounded full-bleed
card:
- Bold white/light headline (Bricolage Grotesque)
- One line of light-colored subtext
- One or two pill CTAs (solid light pill primary, outline pill
  secondary if two)
- Optional: subtle flat dot-grid texture in the background (like
  SkillSwap's reference) — flat repeated dots, not a gradient/glow.

Read the current file's actual copy first and decide whether to keep it
or tighten it — but keep this section short (this is a closer, not
another pitch).

**Acceptance check:** this is the only section on the page with a
saturated full-color background; everything else stays light.

---

## Slice 8 — ProductFeatures.jsx (medium–hard)

**Depends on:** Slice 1.

This is currently 260 lines: alternating left/right feature blocks
(icon + title + tagline + bullet list + a hand-drawn custom SVG
"visual" mockup per feature), all in the dark glass-card style. This is
one of the sections driving the "endless list" complaint. Two things
need to happen, not just a recolor:

1. **Trim.** Read the current file to see exactly how many features it
   has and what each claims. Cut to the fewest features that actually
   differentiate the product (the recent-photo + up-to-date-routes
   angle from the Hero subhead should show up here as one of them, not
   be hero-only). If there are more than 3, that's a strong signal to
   cut or merge — check with whoever's coordinating slices if unsure
   which to drop, rather than guessing silently.
2. **Simplify the visual style.** Replace the custom hand-drawn SVG
   mockups (map-block diagrams, fake search bars, etc. — all currently
   built for the dark theme and non-trivial to re-theme faithfully)
   with something lighter-weight: a simple icon-led card, or a real
   screenshot placeholder, rather than porting 5 different bespoke SVG
   illustrations pixel-for-pixel into light mode. Use the light-theme
   card style established in Slice 5 (white bg, hairline border,
   rounded) for consistency across sections.

Bullet lists: keep bullets short (this is a place the "endless list"
feeling compounds if each feature has 4+ bullets — 2–3 max per feature).

**Acceptance check:** section is visibly shorter than the original 260
lines' worth of content; no custom dark-theme SVG illustrations remain;
consistent card language with Explore section.

---

## Slice 9 — VideoSection.jsx (hard)

**Depends on:** nothing structurally, but coordinate with whoever has
the actual commercial/video asset and its YouTube ID.

**Replace the current implementation, don't just retheme it.** The
current file (230 lines) implements: full YouTube IFrame API loading,
an IntersectionObserver that auto-plays/pauses/rewinds the video based
on scroll position, a mute toggle, and error-state handling for a bad
video ID — all wrapped in a dark, heavily-padded dedicated section.
That's a lot of moving parts for something that should feel like a
lightweight, optional "see it in action" moment.

**New approach — facade/lite embed pattern:**
- Show a static poster/thumbnail image (a still frame from the actual
  commercial, or a placeholder if not yet available) inside a rounded
  card, with a centered circular play button on top (violet fill,
  white play icon, subtle CSS pulse-ring animation to invite the
  click — `box-shadow` ring expanding + fading on a ~2.2s loop).
  Draw the same dotted-route SVG motif from the Hero in the background
  of this card, low-opacity, for visual continuity between sections.
- **Only inject the real `<iframe>` on click** (`autoplay=1` is fine
  here since the click itself is the required user gesture for
  unmuted autoplay in every major browser) — don't load the YouTube
  IFrame API or any JS SDK until the user actually clicks play. This
  removes the entire IntersectionObserver play/pause/rewind/mute-toggle
  logic — none of it is needed once loading is click-triggered.
- Section chrome: small Montserrat eyebrow ("The story"), Bricolage
  Grotesque H2 ("See it in action"), one Poppins subline, all
  light-themed.
- Optional: 2–3 small pill "chapter" labels below the video card
  (e.g. "0:05 Search a building · 0:20 Get directions · 0:45 Explore
  campus") — these are just static labels, not real scrubbing/seeking
  controls, so no extra engineering beyond rendering text.
- Keep the actual video ID/embed URL wiring the current file already
  has — only replace the *loading strategy and section chrome*, not
  necessarily the underlying video source itself.

**Acceptance check:** no YouTube IFrame API script loads on initial page
load — only after the play button is clicked; no IntersectionObserver
tied to this section remains; section visually matches the light theme
and reuses the dotted-route motif.

---

## Slice 10 — Hero.jsx (hardest, highest token usage)

**Depends on:** Slice 1 (anchor targets), ideally done after Slice 2
(Nav) so spacing/overlap between the floating nav and hero top padding
can be checked together, though it can be built in isolation and
integrated after.

**This is a near-total rebuild, not a retheme.** The current file is
~230 lines built around a `PhoneMockup` component — an elaborate fake
phone frame with a hand-drawn SVG map, animated route line, floating
glass stat cards, ambient blurred glow orbs, and particle dots, all in
the dark theme. **Delete `PhoneMockup` and the glow-orb/particle-dot
background elements entirely.** None of that fits the light-minimal
direction or the specific "this should look like a map" decorative
request — replace with the spec below.

**Structure (top to bottom):**
1. Section background: `var(--land-bg)` (white/near-white), positioned
   relative, overflow hidden for the decorative SVG.
2. Decorative background SVG (behind the copy, low z-index): a single
   dotted/dashed route path with two endpoint markers — a small filled
   violet circle with a soft outer ring at the start ("you are here"),
   and a teardrop map-pin shape in teal at the end (destination). Path
   should self-draw on load via animated `stroke-dashoffset` (see
   Motion/UX rules above). This is the one explicit "yes, it's a map"
   visual cue — don't substitute generic rotated squares/circles for
   this.
3. Copy block, centered, max-width ~600–620px:
   - Badge (violet-tint pill, map-pin icon): `Built for FUTA`
   - H1 (Bricolage Grotesque 800, ~40px, line-height ~1.15–1.18):
     `Know exactly where you're going before you get there.` — the
     phrase "before you get there." in `var(--land-accent)`, rest in
     `var(--land-text-primary)`.
   - Subhead (Poppins, ~15px, `var(--land-text-secondary)`, line-height
     ~1.7): `Search any building, hostel, or campus service, see a
     recent photo before you arrive, and follow up-to-date campus
     directions designed specifically for FUTA — not outdated Google
     Maps data.`
   - CTA row: solid violet pill `Open the Map` (→ `/map`) + outline pill
     `See how it works` (→ scrolls to Video section's anchor).
   - Trust line (Poppins, ~12px, muted): `475+ locations mapped · free
     · no download`
4. Floating preview card bleeding out of the bottom of the hero section
   (rounded top corners only, `16px 16px 0 0`, light surface, hairline
   border): a real screenshot of the map tool (or, if not available
   yet, a clearly-labeled placeholder) — this is the equivalent of
   Provolo's floating app-screenshot card and replaces the old phone
   mockup entirely.

**Apply the fade-up stagger + hover-bounce rules from Motion/UX rules
above** — badge → headline → subhead → CTA → trust line → preview card,
~80ms stagger.

**Do not reintroduce:** any `rgba(183,109,255,...)` glow/blur effects,
the particle dots, the phone-frame mockup, or "Never Get Lost on Campus
Again" as headline copy — that copy was explicitly superseded (see
Global Context's locked-in copy).

**Acceptance check:** page is functional and legible with JS animations
disabled (progressive enhancement — nothing should be invisible/broken
without the fade-up classes firing); Lighthouse/axe shows no obvious
contrast failures on the violet-on-white text; headline copy matches
the locked-in copy exactly, character for character.

---

## Slice 11 — Integration & QA pass (do last, regardless of token cost)

**Depends on:** all previous slices merged.

- Confirm final `LandingPage.jsx` section order matches Slice 1's list.
- Grep `landing.css` for now-orphaned classes tied to deleted sections/
  components (`.roadmap-card`, any `Discover`/`Stats`/`Why`-specific
  classes, the old `.category-card` if Explore's new tiles don't reuse
  it, `gradientShift`/`shimmer-bg` if nothing uses them anymore) and
  remove them — don't leave dead CSS behind.
- Full responsive pass at mobile/tablet/desktop breakpoints for every
  touched section.
- Verify `prefers-reduced-motion` fallback actually works (test with OS
  setting or `matchMedia` override), not just present in code.
- Verify every internal nav-scroll anchor (`Nav.jsx`'s `scrollTo`) still
  resolves to a real `id` on a real section after all the deletions.
- Confirm the PWA `start_url` behavior (installed app → `/map`,
  browser → `/` landing page) is untouched by any of this — this plan
  never modifies `public/site.webmanifest`.
- Spot-check that nothing here touched `src/pages/MapPage.jsx`,
  `BRAND_GUIDELINES.md`, or any dark in-app-tool styling.

**Acceptance check:** build has zero unused-import/unused-CSS warnings
introduced by this redesign; manual click-through of every nav link,
both CTAs, and the video play button works end-to-end.
