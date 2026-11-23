# About Maps By FUTA

Campus map and navigation web app for the Federal University of Technology, Akure (FUTA).
"Google Maps, built for one campus": find any building, service or lodge, get walking
directions, and discover places around you. Tagline: **"Your go-to guide on FUTA Campus."**

## Founders
Ayoola Omoniyi (https://x.com/AyotheGrapher_) and Gem Akinbo (https://x.com/Gem_Akinbo).
Built because students only knew their own corner of campus and freshers had no reliable way
to find anything. Covers the whole campus plus off-campus lodges and streets.

## Users
Students (especially freshers), staff, visitors, and local businesses that advertise.

## Features (`src/features/<folder>`)
- Map with custom pins, layers and place-type filter (`map`, `waypoints`, `legend`)
- Place cards; reviews and star ratings, prompted on arrival (`reviews`)
- Search with quick category chips and distance sorting (`search`)
- Turn-by-turn walking/driving directions, live GPS, voice (`navigation`)
- Named campus paths (`segments`); raw/annotated map view (`osm-annotations`)
- Explore: curated and promoted picks (`explore`)
- Promote: businesses pay to be featured, via BACHS (`promote`, see `docs/payments.md`)
- Suggest a place, track your suggestions (`waypoint-submissions`)
- Accounts: Google or email; welcome email; opt-in marketing emails (`auth`)
- Admin panel: edit places/paths, KML import, approve ads and suggestions (`admin`, `kml`)
- Usage analytics for admins (`analytics`); offline banner (`offline`)
- WhatsApp channel prompt (`whatsapp`); live chat via Tawk.to (`src/lib/tawk.js`)

## Place categories
Academic, administration, housing, food and shops, services (banks, pharmacies, barbers,
laundry, fuel, clinics), religious, recreation, gates/bus stops/car parks/landmarks.

## Messaging angles
- "Never get lost on campus again."
- "Everything on campus, mapped."
- "Built for FUTA, by FUTA."
- "Live and social": real-time GPS plus student reviews.

Brand colours, fonts and logos: `DESIGN_SYSTEM.md`.
