# Maps By FUTA

Campus map + walking navigation for FUTA (Akure). Live at mapsbyfuta.xyz (Vercel).
Product details: `docs/about.md`. Payments: `docs/payments.md`.

## Stack
React 19 + Vite 8, plain JSX (no TypeScript), React Router 7, raw Leaflet (no react-leaflet),
CSS Modules + Tailwind 4, Supabase (Postgres, Auth, Storage, Edge Functions), Resend for email.

## Commands
- `npm run dev` · `npm run lint` · `npm test`
- `npm run build` = tests + client build + SSR prerender of the landing page. Run before every PR.

## Layout
- `src/pages/` routes · `src/features/<area>/` feature code, flat (no subfolders) · `src/lib/` shared non-UI code
- `src/styles/tokens-v2.css` colour/size variables · `supabase/*.sql` schema · `supabase/functions/` Edge Functions

## Design (all UI)
- Follow `DESIGN_SYSTEM.md`. Read it before building or changing a screen.
- Colours: only its 16 brand colours, via `tokens-v2.css` variables. Never a new hex.
- Fonts: `var(--font-ui)` Inter, `var(--font-display)` Bricolage Grotesque, `var(--font-mono)` DM Mono.
  Any other font: stop and ask the user to approve installing it.
- Icons: `lucide-react`. Build desktop and mobile together.

## Frontend rules
- Lazy-load anything not needed for first paint (`React.lazy` + `<Suspense fallback={null}>`).
- One GPS watcher only: `features/navigation/gpsWatch.js` (`subscribeGps`).
- Map corner prompts must wait while MapPage's `blocked` is true (see `whatsapp/ChannelPrompt.jsx`).
- Landing page is prerendered: don't import the Supabase client into `src/pages/landing/`.
- Supabase `numeric` columns arrive as strings: wrap in `Number()`.

## Backend rules
- One live Supabase project `vzjlarvtssybglwzfrhi`. No staging, so changes hit real users.
- Schema change = idempotent file `supabase/<topic>.sql`, then apply via Supabase MCP. Confirm with the user first.
- Client writes go through `security definer` RPCs with `set search_path = ''`, granted to `authenticated` only.
- DB → Edge Function calls: pg_net + Vault secrets + `x-webhook-secret` header (pattern: `supabase/welcome_email.sql`).
- Triggers must never block signup: catch errors, `raise warning`.
- Webhook-style functions deploy with `verify_jwt = false` and check their own secret.
- Secrets only in Supabase secrets / Vault. Never in code, SQL files or commits.

## Workflow
- Branch per change → `npm run build` → PR with `gh pr create`.
- Comments: short, say why. No history or "legacy" notes.
- Skills: `/frontend-feature`, `/supabase-change`, `/ship`.
