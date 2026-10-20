# Maps By FUTA — Design System

**This is the design system for all Maps By FUTA work: screen designs, motion, graphics and code.** Every new screen and every redesign uses the colours and type below.

- Live design system (brand book, swatches, type specimens, logos, icons, font files): https://claude.ai/code/artifact/de468ae6-c64e-4a96-a762-475bc9b67917
- Machine-readable copy: [`design-system/tokens.json`](design-system/tokens.json)
- In code, the colours are CSS variables in `src/styles/tokens-v2.css`.

## Colour — 17 brand colours

Violet `#7c3aed` is the brand. Never invent a hex; if a Figma frame shows a colour close to one of these, use the token.

| Brand name | Hex | CSS variable | Use |
| --- | --- | --- | --- |
| `primary` | `#7c3aed` | `--v2-primary` | Primary buttons, active tabs, links, icon badges |
| `primary-hover` | `#6d28d9` | `--v2-primary-hover` | Hover/pressed on primary; violet text on `primary-tint` |
| `primary-tint` | `#ede9fe` | `--v2-primary-tint` | Pale violet fills: badges, pills, selected rows |
| `white` | `#ffffff` | `--v2-on-primary` | Text on primary/secondary/ink/error; cards and modals |
| `ink` | `#0f172a` | `--v2-neutral` | Headings, inverted button fill |
| `text` | `#4a4455` | `--v2-text` | Body text |
| `text-muted` | `#6b6478` | `--v2-text-muted` | Captions, placeholders, secondary text |
| `surface` | `#f8f9ff` | — (see below) | Page / app background |
| `surface-alt` | `#f2f3ff` | `--v2-hud-upnext-bg` | Inputs, dropzones, banners, HUD strips |
| `border` | `#e2e8f0` | `--v2-divider` | Borders and dividers |
| `scrim` | `rgba(15, 23, 42, 0.4)` | `--v2-scrim` | Modal/sheet backdrop |
| `secondary` | `#0d9488` | `--v2-secondary` | Brand teal: secondary actions, switches, success, destination pins |
| `secondary-light` | `#6bd8cb` | `--v2-nav-active-accent` | Light teal accent fill (never text on white) |
| `secondary-tint` | `#e6f6f4` | `--v2-secondary-tint` | Pale teal fill |
| `error` | `#ba1a1a` | `--v2-error-text` | Destructive buttons, error text/icons |
| `error-tint` | `#fff8f7` | `--v2-error-tint` | Destructive hover, error banners |
| `star` | `#ffc857` | `--v2-star` | Rating star icons (filled). Icon fill only, never text |

Rules:

- Pages `surface`; cards and modals `white` with a `border` edge; body `text`, headings `ink`, captions `text-muted`.
- Primary button: `primary` fill, white text, `primary-hover` on hover. Secondary button: `primary-tint` fill, `primary-hover` text. Inverted: `ink` fill, white text. Outlined: white, `border` edge, `ink` text.
- Contrast: white on `secondary` is ~3.7:1 and teal on `secondary-tint` ~3.4:1 — bold 19px+ text only.
- For new work use `--v2-text-muted`, not `--v2-text-variant` (#7b7487, under 4.5:1).

**Not yet switched in code** (changing these alters existing screens, so it's a separate decision): `--v2-surface` is still `#faf8ff` (brand `surface` is `#f8f9ff`), `--v2-text-variant` is still `#7b7487`, and older one-off variables (`--v2-track`, `--v2-border`, `--v2-chip-*`, `--v2-nav-active-bg`, `--v2-tertiary*`, `--v2-icon-btn-bg`, `--v2-thumb-bg`, the v1 dark set in `tokens.css`, the `--land-*` set) still exist for the screens that use them. Don't use them in new work.

## Type

| Role | Family | CSS variable |
| --- | --- | --- |
| Headlines | Bricolage Grotesque | `--font-display` |
| UI, body, labels, inputs, buttons | Inter | `--font-ui` |
| Numbers, coordinates, distances, ETAs, status pills | DM Mono | `--font-mono` |

Styles in use: modal title 24/32 600 (display) · panel title 17 / 1.2 700 (display) · button 14 600, 0.14px tracking (ui) · item title 14 600 (ui) · body 16/24 (ui) · small body 12 / 1.35 (ui) · overline 11 500, 0.1em, uppercase (ui) · mono value 12 (mono).

Approved alternates for new design and motion work: Satoshi, Plus Jakarta Sans, Geist, Manrope. They are **not bundled in the app**. Any other font is not allowed without the user's approval.

### Adding a font (only when a screen uses it, after the user approves)
1. Plus Jakarta Sans, Geist, Manrope: `npm i @fontsource-variable/<name>`, then `@import` it in `src/index.css`.
   Satoshi (no npm package): put its `.woff2` files in `src/assets/fonts/satoshi/` and declare `@font-face` with `font-display: swap`.
2. Add a variable with a fallback in `tokens-v2.css`, e.g. `--v2-font-geist: 'Geist Variable', var(--font-ui);`.
3. Components use the variable, never the font name.

## Icons and logos

- Icons: `lucide-react` (24×24, 2px stroke, round caps/joins), looked up through `src/lib/legacyIconMap.js`. Custom icons drawn to the same spec: `MosqueIcon`, `FootballIcon`, `GateIcon` in `src/lib/`.
- Logos: `public/android-chrome-512x512.png` (app icon, used in-app), `src/assets/mapsLogo.png` (white lockup, dark grounds only), `public/og-image.png` (black mark).
