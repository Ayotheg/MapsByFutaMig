# Maps By FUTA — About

## What it is

**Maps By FUTA** is an interactive campus navigation web app for the
**Federal University of Technology, Akure (FUTA)**. Think "Google Maps,
but built specifically for one campus" — it helps students, staff, and
visitors find buildings, services, and facilities on campus, get
turn-by-turn walking/driving directions, and discover what's around them.

It's a Leaflet.js-powered web map (React 19 + Vite front end, Supabase
backend) that's mobile-first but fully responsive, with distinct
desktop and mobile UI treatments throughout.

Tagline (from the page title): **"Your go-to guide on FUTA Campus."**

---

## Core functionality

### 🗺️ Interactive campus map
- A full-screen Leaflet map scoped to FUTA's campus bounding box, with
  custom-styled markers (not default Leaflet pins) for every place on
  campus.
- Two-tier marker rendering (canvas circle-markers that upgrade to
  richer CSS-styled dots) for performance with many points on screen
  at once.
- Toggleable **map layers/legend** — filter what's visible by place
  type (academic buildings, hostels, food, services, etc.) via a
  sidebar (desktop) or bottom sheet (mobile).

### 📍 Places / Points of Interest
Every location on campus is tagged with a type, icon, and color. Categories include:
- **Academic**: lecture halls, faculty buildings, laboratories, workshops/studios, library, senate building, auditoriums
- **Administration**: admin/registry, bursary/finance, student affairs
- **Housing**: student hostels, staff quarters
- **Food & Commerce**: kiosks/canteens, restaurants/eateries, cafés/snack bars, shopping complexes, printing shops/business centres
- **Services**: banks/ATMs, pharmacies/chemists, barbers/salons, laundry, fuel stations, clinics/health centres
- **Religious**: mosque, chapel/church
- **Recreation**: sports facilities, multipurpose halls
- **Infrastructure & wayfinding**: gates/entrances, bus stops, garages/car parks, utilities, security posts, junctions, landmarks, hazards

Each place has a **place card** with details, and rateable service
points (kiosks, restaurants, banks, pharmacies, etc.) support **user
reviews and star ratings**, prompted automatically after you navigate
there.

### 🔍 Search
- Smart search bar (desktop floating bar / mobile bottom-sheet search)
  with autocomplete against an indexed list of every campus place.
- **Quick category chips** — one-tap shortcuts (food, ATM, printing,
  pharmacy, etc.) that surface nearby matches sorted by distance, each
  with a colored dot and emoji per category.
- Distance-aware results ("Very close", "120m away", "1.4km away").
- Falls back to OpenStreetMap/Nominatim search for locations beyond
  the indexed campus places.

### 🧭 Turn-by-turn navigation
- "Where to?" destination picker → real walking/driving routes via
  **OSRM**, drawn on the map.
- Live turn-by-turn HUD with distance/ETA, next-turn icon and
  instructions, and **voice announcements**.
- **Live GPS tracking**: a smooth, animated location dot with heading
  arrow (speed-adaptive smoothing for walking vs. vehicle pace), plus
  a breadcrumb trail.
- Arrival detection, with an automatic review prompt when you arrive
  at a rateable point of interest.

### 🛣️ Paths & Segments
- Named campus routes/paths ("segments") rendered as lines on the map,
  each with its own detail popup/modal.

### 🕶️ View modes
- A raw/annotated view toggle for switching between the styled campus
  map and an OpenStreetMap-annotation view.

### 👤 Accounts, admin & data management
- Auth system (sign in / profile) integrated with review counts and
  saved activity.
- PIN-gated **admin panel** for maintaining the map itself: adding/
  editing points and routes, and **importing KML/KMZ map data** (with
  a save/export pipeline) — this is how the map's underlying place and
  path data gets curated and kept current.

### 📱 Mobile-tuned experience
Nearly every feature has a purpose-built mobile counterpart rather
than a squeezed-down desktop view: a bottom search overlay, a
draggable bottom sheet (peek / half / full states) for the legend and
panels, a floating action button cluster (locate me, view toggle,
account) that repositions itself around the sheet, and safe-area-aware
spacing for notches/home indicators.

### ⏳ Boot / loading experience
A dedicated loading screen tracks real readiness milestones — map
shell init, waypoints loaded, segments loaded, session restored, fonts
loaded — rather than a fake progress bar, before revealing the map.

---

## Brand identity

### Visual character
Dark, glowing, "electric-campus-at-night" aesthetic — a near-black
navy surface with vivid violet/purple as the hero color, accented by
cyan and amber. The logo is a lightning-bolt / arrow "M" mark in violet
on a soft purple-glow blob.

### Color palette

**Primary — Electric Violet**
| Token | Hex |
|---|---|
| Primary | `#ddb7ff` |
| Primary container | `#b76dff` |
| On-primary | `#490080` |

**Secondary — Cyan/Teal**
| Token | Hex |
|---|---|
| Secondary | `#44e2cd` |
| Secondary container | `#03c6b2` |

**Tertiary — Amber**
| Token | Hex |
|---|---|
| Tertiary | `#ffb95f` |
| Tertiary container | `#ca8100` |

**Status**
| Token | Hex |
|---|---|
| Error | `#ffb4ab` |
| Error container | `#93000a` |

**Surfaces (dark theme, elevation scale)**
| Token | Hex |
|---|---|
| Surface / dim | `#0b1326` |
| Surface low | `#131b2e` |
| Surface container | `#171f33` |
| Surface high | `#222a3d` |
| Surface highest | `#2d3449` |
| Surface bright | `#31394d` |

**Text / outline**
| Token | Value |
|---|---|
| Text | `#dae2fd` |
| Text variant | `#cfc2d6` |
| Muted | `rgba(218, 226, 253, 0.45)` |
| Outline | `#988d9f` |
| Outline dim | `#4d4354` |
| Border | `rgba(77, 67, 84, 0.6)` |

**Logo mark colors** (from favicon): violet `#863bff` / deep violet
`#7e14ff`, light lavender highlight `#ede6ff`, and a cyan-blue accent
`#47bfff`.

The color system is named Material-3-style (surface/on-surface/primary/
secondary/tertiary tokens), all living as CSS custom properties so the
whole UI can theme consistently.

### Typography

| Role | Font stack | Used for |
|---|---|---|
| Display | `Bricolage Grotesque`, `Poppins`, sans-serif | Headlines / display type |
| UI | `Inter`, system-ui, sans-serif | Panel titles, nav, tabs, all form inputs/buttons — the dominant UI font |
| Label | `Montserrat`, `Poppins`, sans-serif | Labels |
| Body | `Poppins`, `Inter`, sans-serif | Body copy |
| Mono | `DM Mono`, Courier New, monospace | Coordinates, status pills, counts, GPS values, distance/ETA — anything numeric/technical |

Fonts are self-hosted via `@fontsource` (variable-font versions
preferred where available: Inter, Bricolage Grotesque, Montserrat;
Poppins and DM Mono are static-weight only).

### Shape language
Rounded, soft geometry throughout — radii range from `0.25rem` (small
controls) up to `1.5rem` (large panels) and fully pill-shaped
(`9999px`) chips/buttons.

### Iconography
[Lucide](https://lucide.dev) icon set — a strict 24×24 grid, fixed
2px stroke, rounded caps, giving a clean, minimal, consistent line-icon
look. A couple of campus-specific icons (football, mosque) are custom
SVGs matched to Lucide's stroke spec since no equivalent exists in the
library.

---

## Tech stack (for context, not necessarily landing-page copy)
React 19 + Vite, Tailwind CSS v4 (wired to the custom design tokens
above, not Tailwind's default palette), react-router-dom, Leaflet.js
for the map (raw Leaflet, not a React wrapper), Supabase (Postgres +
Auth + Storage) as the backend, OSRM for routing, and the browser
Geolocation API for live GPS.

---

## Suggested landing-page angles
- **"Never get lost on campus again"** — search, tap, walk: turn-by-turn
  directions to any building, hostel, or service on FUTA campus.
- **Everything on campus, mapped** — lecture halls to laundry services,
  ATMs to auditoriums.
- **Built for FUTA, by FUTA** — a purpose-built tool for one campus,
  not a generic map with pins dropped on it.
- **Live and social** — real-time GPS tracking plus student-submitted
  reviews and ratings of campus spots.
