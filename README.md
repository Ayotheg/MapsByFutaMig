# Maps By FUTA — React migration

Campus navigation web app for Federal University of Technology Akure,
being migrated from a monolithic vanilla JS app to React.

- **Legacy source of truth:** `github.com/Ayotheg/MapsByFuta` @ `feature/login2`
- **This repo:** Vite + React 19, plain JSX (no TypeScript), Tailwind v4, react-router-dom 7
- **Backend:** migrating in parallel from Firebase → Supabase (separate track, not covered here)

If you're an LLM picking up work on this repo, **read `CLAUDE.md` in
full before writing any code** — it has the non-negotiable rules,
folder structure convention, and how to work a slice. This README is
for a human getting the project running locally.

## Prerequisites

- Node.js (whatever version `vite` in `package.json` currently targets)
- npm

## Setup

```bash
git clone <this-repo-url>
cd MapsByFutaMig
npm install
```

`npm install` covers everything already in `package.json`. As of the
current state of this repo (Slice 1 — base map shell), that's still
missing a few packages the map shell needs — install those too:

```bash
npm install leaflet
npm install @fontsource/inter @fontsource/bricolage-grotesque @fontsource/poppins @fontsource/montserrat @fontsource/dm-mono
npm install lucide-react
```

(Each new slice may add its own dependencies going forward — check
`MIGRATION_PLAN.md`'s progress tracker for what's landed and whether
its notes mention a new package.)

## Run locally

```bash
npm run dev
```

Opens on Vite's default port (check terminal output). The app currently
mounts the map shell directly at `/`.

## Other scripts

```bash
npm run build     # production build
npm run preview   # preview the production build locally
npm run lint       # oxlint
```

## Project docs

| File | What it's for |
|---|---|
| `CLAUDE.md` | Rules, conventions, and workflow for whoever (human or LLM) works on a slice next. Read this first. |
| `MIGRATION_PLAN.md` | The full slice list, dependency order, and progress tracker. Check this before starting new work. |
| `BRAND_GUIDELINES.md` | Design tokens and the icon library decision — source of truth for anything visual. |
| This README | Clone-and-run instructions only. |

## Current status

Slice 1 (base map shell) is done. See the progress tracker in
`MIGRATION_PLAN.md` for what's landed and what's next.
