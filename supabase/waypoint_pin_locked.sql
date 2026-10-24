-- ════════════════════════════════════════════════════════════════════════
-- Pin locked — an admin placed this pin by hand
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Safe to re-run.
--
-- The map moves a place onto a same-named OpenStreetMap place within 90 m
-- (useOSMAnnotations.js), so an admin's correction could look ignored.
-- Moving a pin in the admin edit form sets pin_locked, and a locked pin
-- always stays where the admin put it.
--
-- No new policy needed: admins already update waypoints through
-- supabase/admin_waypoint_policies.sql, which covers every column, and the
-- public map already reads approved waypoints.
--
-- Until this runs, the app loads without the column (useWaypoints.js
-- falls back) and moving a pin still saves the new position; it just
-- isn't locked against OpenStreetMap.
-- ════════════════════════════════════════════════════════════════════════

alter table public.waypoints
  add column if not exists pin_locked boolean not null default false;

-- Verification — expect one row, boolean, default false:
--   select column_name, data_type, column_default from information_schema.columns
--   where table_schema = 'public' and table_name = 'waypoints' and column_name = 'pin_locked';
