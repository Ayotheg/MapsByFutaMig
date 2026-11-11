-- ════════════════════════════════════════════════════════════════════════
-- Place area — e.g. "South Gate", "West Gate", "SUB area"
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Safe to re-run.
--
-- Shown on the place card's details line ("★ 5.0 (1) · Shop · South
-- Gate") and set by admins in the admin panel (edit form + "New point").
-- Optional: existing places stay blank until an admin fills them in.
--
-- No new policy needed: admins already update/insert waypoints through
-- supabase/admin_waypoint_policies.sql, which covers every column, and the
-- public map already reads approved waypoints.
--
-- Until this runs, the app loads without the column (useWaypoints.js
-- falls back) and the admin form saves everything except the area.
-- ════════════════════════════════════════════════════════════════════════

alter table public.waypoints
  add column if not exists area text;

-- Keep it a short label, not a second description.
do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'waypoints_area_length') then
    alter table public.waypoints
      add constraint waypoints_area_length check (area is null or char_length(area) <= 60);
  end if;
end $$;

-- Let the API see the new column straight away.
notify pgrst, 'reload schema';


-- ── Verification ─────────────────────────────────────────────────────────
-- 1. Column exists:
--      select column_name from information_schema.columns
--       where table_schema = 'public' and table_name = 'waypoints' and column_name = 'area';
-- 2. In the admin panel, edit a place, set Area to "South Gate", save, then
--    open its card on the map → "… · Shop · South Gate".
