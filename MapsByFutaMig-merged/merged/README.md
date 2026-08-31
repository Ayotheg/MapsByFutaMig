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

- Node.js
- npm

## Setup

```bash
git clone <this-repo-url>
cd MapsByFutaMig
npm install
```

This repo already declares the app dependencies in `package.json`, including Leaflet, Supabase, React, React Router, Tailwind, and the branding/font packages.

## Run locally

```bash
npm run dev
```

The app is a Vite + React SPA. Current routes include:

- `/` — landing page
- `/map` — the real campus map view behind launch gating
- `/gearlify` — direct access route used for special launch flow
- `/reset-password` — password recovery flow
- `/privacy`, `/terms`, `/cookies` — legal pages

## Other scripts

```bash
npm run build
npm run build:client-only
npm run preview
npm run lint
```

> Important: a fresh build was attempted in this environment and it failed before Vite could compile because the local PowerShell execution policy blocked the command with a `PSSecurityException` / `UnauthorizedAccess` error. That is an environment issue, not a clean app-level success signal.

## Project docs

| File | What it's for |
|---|---|
| `CLAUDE.md` | The project rules, architecture guardrails, and current-state working notes. Read this first. |
| `MIGRATION_PLAN.md` | Historical migration roadmap and progress tracker. Use it as context, not as a literal live checklist. |
| `BRAND_GUIDELINES.md` | Design tokens and brand system source of truth. |
| `FIREBASE_TO_SUPABASE_MIGRATION.md` | Supabase schema/RLS notes and migration design docs. |
| This README | Local setup and current app-state context. |

## Current status

This repo is no longer just a “base map shell” migration. The actual code in `src/` already includes real implementations for the map shell, waypoints, legend, segments, KML/OSM layers, search, GPS/navigation, auth, admin, and analytics surfaces.

The migration docs are historical context. The code in `src/` is the source of truth for what is currently implemented, while live Supabase schema/RLS verification and a clean build on a non-blocked environment are still required before claiming full production readiness.
