# Task 1 — Token & Asset Migration — Changes

Scope followed exactly as specced: assets moved, tokens merged, fonts
de-duplicated. No JSX port, no component split, no copy/behavior
changes. That's Task 2, next session.

## 1. `MapsByFutaMig-bug-fix-2/src/styles/tokens.css`
Added a new block of landing-page aliases at the bottom of the
existing `:root`, each pointing at the *existing* token via `var()`
(no raw hex duplicated):

- `--purple-light`, `--purple-mid`, `--purple-dark` → `--primary`,
  `--primary-container`, `--on-primary`
- `--teal-dark` → `--secondary-container`
- `--orange-dark` → `--tertiary-container`
- `--bg-darkest`, `--bg-dark`, `--bg-mid`, `--bg-light`, `--bg-lighter`
  → `--surface-dim`, `--surface-low`, `--surface-container`,
  `--surface-high`, `--surface-highest`

Skipped as redundant (values already byte-identical under the same
name): `--teal`, `--text`, `--border`.

**Flagged, not aliased:** the landing export's `--muted: #cfc2d6`
collides by *name* with this file's existing `--muted:
rgba(218,226,253,0.45)` — but the landing value is actually a
duplicate of `--text-variant`, not the existing `--muted`. Aliasing it
would've silently overwritten the existing token for every current
consumer in the app. Left untouched; the recommendation (in a comment
in the file) is for whoever ports the landing components in Task 2 to
reference `var(--text-variant)` directly instead of reintroducing
`--muted`. Flag if you want a different resolution.

## 2. Assets
`MAPSBYFUTA.jpg` (flyer) and `MapssByFuta.jpg` (logo) copied from the
Figma Make export into `MapsByFutaMig-bug-fix-2/src/assets/`.

## 3. `App.tsx` import paths
Updated the two image imports from `./imports/...` to
`../../assets/...`, matching the depth they'll be at once Task 2 lands
this file under `src/pages/landing/` per the build plan. If Task 2
ends up placing the split files somewhere else, these two lines need
their relative depth adjusted accordingly — flagged with a comment
in-file.

## 4. Google Fonts import removed
Stripped the `@import url('https://fonts.googleapis.com/css2?...')`
line from the landing page's `src/index.css`. Confirmed
`@fontsource/inter`, `@fontsource/bricolage-grotesque`,
`@fontsource/poppins`, and `@fontsource/montserrat` are all already
present in the target app's `package.json` and imported in its main
`src/index.css` — nothing else to add.

## Deliberately left untouched (out of scope for Task 1)
- The landing page's own duplicate `:root` color block in its
  `index.css` — still there for now. Removing it is bundled into
  Task 2 when that file gets split up anyway (noted in the tokens.css
  comment).
- All keyframes/utility classes (`.glass`, `.btn-primary`,
  `.nav-link`, etc.) in the landing `index.css` — not tokens, not
  asset paths, left exactly as exported.
- `App.tsx` JSX/logic, the TS→JSX conversion, component split,
  `<a href>` → `<Link>` swap, emoji, "100+", video placeholder, Crowdr
  section — all Task 2+ per the build plan.
- `package.json` — confirmed `lucide-react` and `react-router-dom`
  already present in the target app; no dependency changes needed.

## Files in this delivery
- `MapsByFutaMig-task1-tokens-assets.zip` — the migration project with
  the token merge and new assets applied.
- `MapsByFuta-LandingPage-task1-staged.zip` — the Figma Make export
  with only the font-import strip and image-import path fix applied,
  ready for Task 2's port.
