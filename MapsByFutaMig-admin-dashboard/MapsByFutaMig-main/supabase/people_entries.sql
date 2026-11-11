-- ── People entries on `waypoints` ───────────────────────────────────────
--
-- Same precedent as explore_fields.sql: no new table, no new RLS to
-- manage. A "Person" is just a `waypoints` row with `is_person = true` —
-- it shares every policy, index, image table, and admin-write helper
-- that a normal place already has (see supabase/admin_waypoint_policies.sql,
-- adminSave.js). The only thing that makes it different is that it has
-- no map location, so `lat`/`lng` are left null for these rows.
--
-- Run once. Safe to re-run (every statement is guarded/idempotent).

alter table waypoints add column if not exists is_person boolean not null default false;

-- People rows never carry coordinates — the columns must accept null for
-- them. Harmless no-op if lat/lng are already nullable.
alter table waypoints alter column lat drop not null;
alter table waypoints alter column lng drop not null;

create index if not exists waypoints_is_person_idx on waypoints (is_person) where is_person = true;
