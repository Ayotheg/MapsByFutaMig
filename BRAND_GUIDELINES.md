# Maps By FUTA — Brand & Design Tokens

Extracted verbatim from `style.css` on `feature/login2`. These values are the
single source of truth — copy them into `src/styles/tokens.css` in the new
React app unchanged. Do not reinterpret or "improve" any of these; the goal
is pixel-identical continuity, not a redesign.

## Color system (Material-3-style token naming)

```css
:root {
  /* Surface (backgrounds by elevation) */
  --surface:           #0b1326;
  --surface-dim:       #0b1326;
  --surface-bright:    #31394d;
  --surface-low:       #131b2e;
  --surface-container: #171f33;
  --surface-high:      #222a3d;
  --surface-highest:   #2d3449;

  /* On-surface (text) */
  --text:              #dae2fd;
  --text-variant:      #cfc2d6;
  --muted:             rgba(218, 226, 253, 0.45);

  /* Outline */
  --outline:           #988d9f;
  --outline-dim:       #4d4354;
  --border:            rgba(77, 67, 84, 0.6);

  /* Primary — Electric Violet */
  --primary:              #ddb7ff;
  --primary-container:    #b76dff;
  --on-primary:           #490080;
  --primary-glow:         rgba(221, 183, 255, 0.22);
  --primary-glow-strong:  rgba(183, 109, 255, 0.35);

  /* Secondary — Cyan/Teal */
  --secondary:            #44e2cd;
  --secondary-container:  #03c6b2;
  --on-secondary:         #003731;

  /* Tertiary — Amber */
  --tertiary:             #ffb95f;
  --tertiary-container:   #ca8100;

  /* Status */
  --error:             #ffb4ab;
  --error-container:   #93000a;

  /* Legacy aliases (used in JS-injected content — keep these too,
     several inline styles reference them directly) */
  --green:   #44e2cd;
  --yellow:  #ffb95f;
  --red:     #ffb4ab;
  --blue:    #ddb7ff;
  --dark:    #0b1326;
  --panel:     rgba(11, 19, 38, 0.92);
  --input-bg:  rgba(255, 255, 255, 0.04);
}
```

## Radii

```css
--r-sm:   0.25rem;
--r-md:   0.5rem;
--r-lg:   0.75rem;
--r-xl:   1rem;
--r-2xl:  1.5rem;
--r-full: 9999px;
```

## Spacing / layout

```css
--gap:              0.75rem;
--pad:               1rem;
--pad-lg:            1.5rem;
--header-h:          72px;
--sidebar-rail-w:    64px;
--sidebar-panel-w:   240px;
--sidebar-total-w:   304px;
```

## Mobile-specific layout tokens

```css
--mob-search-h:      56px;
--mob-sheet-peek:    76px;   /* collapsed: handle + tab strip + breathing room */
--mob-sheet-half:    50vh;
--mob-sheet-full:    92vh;
--mob-sheet-radius:  20px;
--mob-safe-bottom:   env(safe-area-inset-bottom, 0px);
--mob-safe-top:      env(safe-area-inset-top, 0px);
```

## Typography

```css
--font-display: 'Bricolage Grotesque', 'Poppins', sans-serif;
--font-ui:      'Inter', system-ui, -apple-system, sans-serif;
--font-label:   'Montserrat', 'Poppins', sans-serif;
--font-body:    'Poppins', 'Inter', sans-serif;
--font-mono:    'DM Mono', 'Courier New', monospace;
```

**Usage pattern observed in the legacy app** (preserve this mapping when
porting components):
- `--font-ui` → panel titles, layer names/stats, nav placeholders, tab
  labels, all form inputs/buttons/selects/textareas — this is the dominant
  UI font, applied globally to `html, body`
- `--font-mono` → coordinates, status pills, brand text, counts, GPS
  values, distance/ETA values — anything numeric/technical-looking
- Place-card name is force-set to `--font-ui`, weight 700

**Packages — use the variable-font versions, not per-weight static ones.**
A variable font ships every weight of a family in a single file, instead of
downloading a separate static file per weight — same visual result,
meaningfully smaller payload and fewer network requests. **Not yet applied
as of Slice 3** — the app currently self-hosts via the static per-weight
`@fontsource/*` packages; switch to the following next time `index.css`'s
font imports are touched:

```bash
npm install @fontsource-variable/inter
npm install @fontsource-variable/bricolage-grotesque
npm install @fontsource-variable/montserrat
# Poppins and DM Mono don't ship variable-font versions on @fontsource —
# use the standard static packages for just the weights actually used:
npm install @fontsource/poppins    # weights: 300 400 500 600 700 800
npm install @fontsource/dm-mono    # weights: 400 500 600
```

Import only the weight range actually needed, e.g.
`import '@fontsource-variable/inter/wght.css'` rather than importing every
static style file individually — check the package's own docs for the exact
import path, since this differs slightly per package.

**Full weight range needed per family** (for reference/verification against
whatever's imported):
- Inter: 300–800 (variable, opsz 14–32)
- Bricolage Grotesque: 400–800 (variable, opsz 12–96)
- Montserrat: 400–900 (variable)
- Poppins: 300, 400, 500, 600, 700, 800 (static — no variable version)
- DM Mono: 400, 500, 600 (static — no variable version)

## Icons

~~Bootstrap Icons v1.13.1~~ — **superseded.** Legacy used Bootstrap Icons
(`<i class="bi bi-...">`) via CDN; the migration uses `lucide-react`
instead (React components, not CSS classes). Reasoning: the legacy app
only actually uses 26 unique icons total, so the "no renaming needed"
convenience of staying on Bootstrap Icons wasn't worth much, and Lucide
is a better fit for the brand's minimal/consistent aesthetic (it's the
spiritual successor to Feather Icons — strict 24×24 grid, fixed 2px
stroke, round caps — enforced across ~1,700 icons) while also covering
more of the campus-specific place-type icons (church, mosque, scooter,
football, bank) than Heroicons' smaller generic set would. It's also the
better choice for bundle size specifically: `lucide-react` is tree-shaken,
so only the ~26 icons actually imported ship in the final bundle, versus
an icon-font approach shipping every icon in the library regardless of
how many are used.

See `src/lib/legacyIconMap.js` in the new repo for the full `bi-name →
LucideIcon` table. Two icons (`football`, `mosque`) have no confirmed
Lucide equivalent and need a custom SVG matching Lucide's stroke spec,
or a decision before they're used in a slice.

**Note from Slice 3:** legend swatch colors and actual marker pin colors
diverge for several place types (`printing_shop`, `cafe`, `restaurant`,
`pharmacy`, `barber`, `laundry`, `fuel`, `security_post`) — this is a
pre-existing legacy inconsistency (distinct legend swatch color, but the
map pin itself falls back to default teal), not a porting error. Two
separate color maps exist to preserve this faithfully: `placeTypeGroups.js`
(legend) vs `wpTypeMeta.js` (map pins).

## Recurring structural patterns (for shared components, once you hit a second usage)

**Modal shell**, used identically across `saveModal`, `detailModal`,
`adminEditModal`, `reviewModal`:
```
.modal-overlay > .modal > .modal-header (.modal-title + .modal-close "✕")
                        > .modal-body
                        > .modal-footer (.modal-btn.primary/.secondary/.danger)
```

**Sidebar panel shell**, used across the legend, GPS, search, navigate, and
category-results panels:
```
.sidebar-panel > .panel-header (.panel-title + .panel-subtitle)
               > .panel-body
```

## Tailwind v4 integration

Wire these tokens into Tailwind via `@theme` in `index.css` so Tailwind
utilities resolve to the same values instead of Tailwind's own default
palette:

```css
@import "tailwindcss";

@theme {
  --color-surface: var(--surface);
  --color-primary: var(--primary);
  --color-secondary: var(--secondary);
  --color-tertiary: var(--tertiary);
  --color-text: var(--text);
  --radius-sm: var(--r-sm);
  --radius-lg: var(--r-lg);
  --radius-xl: var(--r-xl);
  /* extend with the rest of the token list above as needed */
}
```

This makes `bg-primary`, `rounded-lg`, etc. resolve to the exact brand
values — never Tailwind's built-in `blue-500`/`p-4`-style defaults.