-- ── Explore fields on `waypoints` ──────────────────────────────────────
--
-- Replaces the earlier explore_picks.sql design (a separate table) per
-- explicit instruction: no new table, no new RLS to manage — "just me
-- picking a name on the map and featuring it." Featuring a place is now
-- just a few more columns on the SAME `waypoints` row you already edit
-- by clicking a pin on the map and hitting Save in the existing admin
-- edit modal. Nothing new to run beyond this one ALTER TABLE, and no new
-- RLS policies: `waypoints` already has working read/write policies
-- (the same ones `adminSave.js`'s `updateWaypoint()` already relies on
-- for name/description/type), so featuring a place is authorized exactly
-- the same way editing its name already is.
--
-- All columns are optional/nullable-safe — a waypoint with none of this
-- set behaves exactly as it did before this file existed.

alter table waypoints add column if not exists is_explore boolean not null default false;
alter table waypoints add column if not exists explore_tags text[] not null default '{}';
alter table waypoints add column if not exists explore_priority integer not null default 0;

-- Promotion / "ad" fields — see AdminEditModal.jsx's Explore section for
-- how these are edited. `is_promoted` is the only thing that puts a
-- "Promoted"/"Ad" badge on a card — never inferred from anything else.
alter table waypoints add column if not exists is_promoted boolean not null default false;
alter table waypoints add column if not exists sponsor_name text;
alter table waypoints add column if not exists promo_label text not null default 'Promoted';

create index if not exists waypoints_is_explore_idx on waypoints (is_explore) where is_explore = true;
