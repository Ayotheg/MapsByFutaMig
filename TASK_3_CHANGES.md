# Task 3 — "475+" fix — Changes

Scope: the 6-location `100+` → `475+` fix from
`LANDING_PAGE_BUILD_PLAN.md`, applied on top of the Task 2 delivery
(`src/pages/landing/*`). No other copy or behavior touched.

## 1. Locations fixed

| File | What changed |
|---|---|
| `Hero.jsx` (line ~132) | Floating stat card in `PhoneMockup`: `100+` → `475+` |
| `Hero.jsx` (line ~231) | Hero mini-stats row: `['100+', 'Campus Locations']` → `['475+', 'Campus Locations']` |
| `DiscoverSection.jsx` (line ~58) | Bullet copy: "...100+ places mapped" → "...475+ places mapped" |
| `ProductFeatures.jsx` (line ~196) | Bullet: `'100+ mapped locations'` → `'475+ mapped locations'` |
| `StatsSection.jsx` (line ~19) | Counter stat: `{ value: 100, suffix: '+', ... }` → `{ value: 475, suffix: '+', ... }` — no `useCounter` logic changes needed, it counts up fine |
| `FAQ.jsx` (line ~12) | Answer copy: "...100+ verified locations" → "...475+ verified locations" |

Checked surrounding copy at every site per the build plan's caution —
none of it assumes a smaller/rounder number, so a straight swap was
safe everywhere. Confirmed via grep: zero `100+` remaining in
`src/pages/landing/`, all 6 sites now read `475+`.

## 2. Task 0 fix (flagged by you, not from the build plan's numbered
   tasks — build plan assigns full routing wire-in to Task 7, but
   you asked for the specific "LandingPage commented out" issue
   fixed now)

`src/App.jsx`:
- Uncommented `import LandingPage from './pages/LandingPage'`.
- `<Route path="/" element={<LandingPage />} />` (was `<HomeRoute />`).
- Added `<Route path="/map" element={<HomeRoute />} />` — this is
  where the map boot experience (readiness tracking + `LoadingScreen`
  overlay) now lives.
- `/loadingscreen` and the `*` catch-all untouched.

This matches the Task 0 decision already documented in the build plan
(`LandingPage` at `/`, map moved to `/map`) — it just hadn't actually
been applied to `App.jsx` yet, only planned.

## 3. Scroll-lock conflict (TASK_2_CHANGES.md #5) — resolved, ahead
   of Task 7

The build plan assigns this decision to Task 7 ("scope the fixed/
overflow-hidden rule to the `/map` route specifically, or override it
for the landing route"). Since the routing fix above is what actually
triggers the bug, fixing it here too rather than shipping a known-
broken root route. Went with the first option:

- `src/index.css`: removed `overflow: hidden`, `position: fixed`,
  `overscroll-behavior: none`, `-webkit-overflow-scrolling: auto` from
  the global `html, body` rule (kept `width`/`height`/font/color
  there). Added a new scoped rule, `body.map-viewport { ... }`, with
  those same four properties.
- `src/App.jsx`: `HomeRoute` (the `/map` route) now adds the
  `map-viewport` class to `document.body` on mount and removes it on
  unmount, via a `useEffect`. Landing page (`/`) and `NotFoundPage`
  never touch this class, so they get normal document scroll.
  `/loadingscreen` also doesn't get the class, but its own
  `LoadingScreen.module.css` root is already `position: fixed`
  independent of the body, so it still renders full-screen fine there.

This is a one-file-plus-one-hook change, not the rest of Task 7 (icon/
emoji audit, "475+" full-repo sweep, lint, build) — those are still
open.

## Files in this delivery
`MapsByFutaMig-task3-475-fix.zip` — full project, with the 6 copy
fixes, the `App.jsx` routing fix, and the scroll-lock fix above.
Everything else untouched.
