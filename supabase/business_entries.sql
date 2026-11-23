-- ── Business entries on `waypoints` ──────────────────────────────────────
--
-- Same precedent as people_entries.sql and channel_entries.sql: no new
-- table, no new RLS to manage. A "Business" (admin-added Online Store) is
-- just a `waypoints` row with `is_business = true` — it shares every
-- policy, index, image table (`waypoint_images`, same bucket/kind every
-- other waypoint photo uses — see adminSave.js's uploadImage/
-- reconcileImages, nothing new needed for images here), and admin-write
-- helper (adminSave.js's insertWaypoint/updateWaypoint) a normal Place
-- already has. Like a Channel, a Business has no map location, so
-- `lat`/`lng` stay null for these rows and it never renders as a pin —
-- only in search results and (if featured) the Explore panel.
--
-- Deliberately its own boolean + its own `business_link`/
-- `business_platform` pair, NOT a reuse of `is_channel`/`channel_link`/
-- `channel_platform` — a row is either a Channel or a Business, never
-- both, and separate columns keep `PointsTab.jsx`'s Places/People/
-- Channels/Business pills and any future "what kind of row is this" query
-- unambiguous without also checking a second boolean to disambiguate what
-- `channel_link` actually means on that row.
--
-- Run once. Safe to re-run (every statement is guarded/idempotent).

alter table waypoints add column if not exists is_business boolean not null default false;
alter table waypoints add column if not exists business_link text;
alter table waypoints add column if not exists business_platform text;

-- Business rows never carry coordinates either — belt-and-suspenders with
-- people_entries.sql's / channel_entries.sql's own version of this
-- statement (all three idempotent).
alter table waypoints alter column lat drop not null;
alter table waypoints alter column lng drop not null;

create index if not exists waypoints_is_business_idx on waypoints (is_business) where is_business = true;
