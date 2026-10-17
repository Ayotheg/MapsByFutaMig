# Maps By FUTA

Campus map and navigation web app for FUTA. Live at https://mapsbyfuta.xyz.
About the product: `docs/about.md`.

## Setup
Needs Node 22+.

```bash
git clone https://github.com/Ayotheg/MapsByFutaMig.git
cd MapsByFutaMig
npm install
cp .env.example .env.local   # fill in the values (ask a teammate)
npm run dev
```

## Scripts
| Command | Does |
|---|---|
| `npm run dev` | Local dev server |
| `npm test` | Unit tests (`scripts/*.test.mjs`) |
| `npm run lint` | oxlint |
| `npm run build` | Tests, client build, landing-page prerender |
| `npm run preview` | Serve the build |

## Docs
| File | For |
|---|---|
| `CLAUDE.md` | Rules for Claude Code and for us |
| `DESIGN_SYSTEM.md` | Colours, fonts, icons, logos for all UI |
| `docs/about.md` | Product, founders, features |
| `docs/payments.md` | Promote payments (BACHS) |
| `supabase/*.sql` | Database schema, one file per topic |
