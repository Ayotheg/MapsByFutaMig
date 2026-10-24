-- ════════════════════════════════════════════════════════════════════════
-- Remove learned shortcuts
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor, once the app version
-- without learned shortcuts is live (older clients would get errors
-- calling the dropped functions). Safe to re-run.
--
-- Routing now uses a walking router that follows every path already on
-- OpenStreetMap, so the app no longer learns shortcuts from users' trips.
-- Admin-imported footpath/shortcut segments (the `segments` table) are not
-- touched, and neither is geo_distance_m(): other SQL may call it.
-- ════════════════════════════════════════════════════════════════════════

drop function if exists public.submit_shortcut_walk(uuid, integer, jsonb, double precision, boolean);
drop function if exists public.report_shortcut_outcome(bigint, uuid, boolean);
drop function if exists public.learned_shortcuts_status_change() cascade;

drop table if exists public.shortcut_outcomes;
drop table if exists public.shortcut_walks;
drop table if exists public.learned_shortcuts;

-- Verification — expect 0 rows:
--   select table_name from information_schema.tables
--   where table_schema = 'public' and table_name in ('learned_shortcuts', 'shortcut_walks', 'shortcut_outcomes');
