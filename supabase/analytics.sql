-- ── Slice 14: Analytics / "Insights" admin feature ──────────────────────
--
-- File-per-feature convention (same as supabase/quick_chips.sql /
-- supabase/waypoint_submissions.sql) — NOT appended to
-- FIREBASE_TO_SUPABASE_MIGRATION.md, whose own "Step" numbering was
-- already abandoned after Slice 10 (see Slice 13's tracker row).
--
-- **NOT YET RUN AGAINST A LIVE DATABASE** — designed only, same "designed,
-- not applied" flag every prior slice's SQL file carries until a human
-- actually runs it. Before trusting the RLS below: confirm live, with a
-- real non-admin authenticated client, that `analytics_get_rollup` /
-- `analytics_get_events` / `analytics_table_counts` genuinely return
-- empty/error rather than data — same "flag before trusting live data"
-- discipline as every other schema addition in this repo's history.

-- ── analytics_events ────────────────────────────────────────────────────
-- Raw event log. Insert-only from the client. Never readable by the
-- client directly — only by the admin dashboard via a SECURITY DEFINER
-- RPC gated on is_admin() (Slice 13's profiles.is_admin / is_admin(uid),
-- reused verbatim — no second admin-check mechanism).
create table analytics_events (
  id           bigint generated always as identity primary key,
  event_name   text not null,
  props        jsonb not null default '{}'::jsonb,
  session_id   text not null,        -- per-tab-session random id (sessionStorage)
  anon_id      text not null,        -- persistent per-browser id (localStorage) — "unique user" counts against this for anonymous visitors
  user_id      uuid references auth.users(id),  -- null unless logged in
  path         text,
  device_type  text,                 -- 'mobile' | 'desktop', derived client-side
  created_at   timestamptz not null default now()
);

create index analytics_events_created_at_idx on analytics_events (created_at);
create index analytics_events_event_name_idx on analytics_events (event_name);
create index analytics_events_anon_id_idx on analytics_events (anon_id);
create index analytics_events_user_id_idx on analytics_events (user_id) where user_id is not null;

alter table analytics_events enable row level security;

-- Anyone (anon or authenticated) can insert their own events. No one can
-- select/update/delete directly — reads only go through the admin RPCs
-- below.
create policy analytics_events_insert on analytics_events
  for insert
  to anon, authenticated
  with check (true);

-- ── analytics_daily_rollup ──────────────────────────────────────────────
-- Pre-aggregated per-day stats so the dashboard reads a small table, not
-- the raw firehose. Populated by analytics_get_rollup's own lazy-compute
-- fallback below (§ rollup). Raw table stays around for the Journeys/
-- session-detail view — it is NOT pruned or rolled-up-and-deleted. A
-- future session should not "clean up" analytics_events; that would break
-- session drill-down in JourneysTab.jsx.
create table analytics_daily_rollup (
  day               date primary key,
  unique_visitors   integer not null default 0,   -- distinct anon_id + distinct user_id combined, deduped
  unique_logged_in  integer not null default 0,
  total_sessions    integer not null default 0,
  total_events      integer not null default 0,
  new_users         integer not null default 0,
  returning_users   integer not null default 0,
  top_events        jsonb not null default '[]'::jsonb,   -- [{event_name, count}], top 10
  top_searches      jsonb not null default '[]'::jsonb,   -- [{query, count}], top 10
  top_routes        jsonb not null default '[]'::jsonb,   -- [{from, to, count}], top 10
  computed_at       timestamptz not null default now()
);

alter table analytics_daily_rollup enable row level security;
-- No public policies at all — only readable via the admin RPC below
-- (SECURITY DEFINER) or the service role.

-- ── is_admin() reused verbatim ──────────────────────────────────────────
-- Slice 13 already added profiles.is_admin + is_admin(uid) — not
-- redefined here.

-- ── Rollup compute helper ───────────────────────────────────────────────
-- Computes one day's rollup row from the raw analytics_events firehose.
-- Used by analytics_get_rollup's lazy-compute-on-read fallback (below) —
-- see this file's own "Rollup job" note at the bottom for why the
-- scheduled-function option (pg_cron / Edge Function) isn't wired here.
create or replace function analytics_compute_rollup_for_day(target_day date)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_unique_visitors int;
  v_unique_logged_in int;
  v_total_sessions int;
  v_total_events int;
  v_top_events jsonb;
  v_top_searches jsonb;
  v_top_routes jsonb;
begin
  select count(distinct coalesce(user_id::text, anon_id)),
         count(distinct user_id) filter (where user_id is not null),
         count(distinct session_id),
         count(*)
    into v_unique_visitors, v_unique_logged_in, v_total_sessions, v_total_events
  from analytics_events
  where created_at >= target_day and created_at < target_day + 1;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top_events from (
    select event_name, count(*) as count
    from analytics_events
    where created_at >= target_day and created_at < target_day + 1
    group by event_name
    order by count(*) desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top_searches from (
    select props->>'query' as query, count(*) as count
    from analytics_events
    where created_at >= target_day and created_at < target_day + 1
      and event_name = 'search_query'
      and props->>'query' is not null
    group by props->>'query'
    order by count(*) desc
    limit 10
  ) t;

  select coalesce(jsonb_agg(t), '[]'::jsonb) into v_top_routes from (
    select props->>'from' as "from", props->>'to' as "to", count(*) as count
    from analytics_events
    where created_at >= target_day and created_at < target_day + 1
      and event_name in ('nav_started', 'nav_completed')
      and props->>'from' is not null and props->>'to' is not null
    group by props->>'from', props->>'to'
    order by count(*) desc
    limit 10
  ) t;

  insert into analytics_daily_rollup (
    day, unique_visitors, unique_logged_in, total_sessions, total_events,
    new_users, returning_users, top_events, top_searches, top_routes, computed_at
  ) values (
    target_day, v_unique_visitors, v_unique_logged_in, v_total_sessions, v_total_events,
    -- new_users/returning_users: not computed in this fallback (would need
    -- a first-seen-date lookup per anon_id/user_id across all history,
    -- expensive to do inline on every read) — left at 0 and flagged rather
    -- than guessed. Fill in once the scheduled-function option lands.
    0, 0, v_top_events, v_top_searches, v_top_routes, now()
  )
  on conflict (day) do update set
    unique_visitors = excluded.unique_visitors,
    unique_logged_in = excluded.unique_logged_in,
    total_sessions = excluded.total_sessions,
    total_events = excluded.total_events,
    top_events = excluded.top_events,
    top_searches = excluded.top_searches,
    top_routes = excluded.top_routes,
    computed_at = excluded.computed_at;
end;
$$;

-- ── Admin read RPCs (SECURITY DEFINER, gated on is_admin()) ────────────

-- Fallback rollup strategy (see § "Daily rollup job" below): computes
-- today's and yesterday's rows on-demand if they're missing/stale
-- (>1h old), rather than requiring a Supabase Cron / Edge Function to be
-- configured on the project's plan. Older days are computed once and
-- then just read back from the table. This is a deliberate compromise,
-- not the ideal design — see the note at the bottom of this file.
create or replace function analytics_get_rollup(days_back int default 30)
returns setof analytics_daily_rollup
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    return;
  end if;

  if not exists (select 1 from analytics_daily_rollup where day = current_date)
     or (select computed_at from analytics_daily_rollup where day = current_date) < now() - interval '1 hour' then
    perform analytics_compute_rollup_for_day(current_date);
  end if;
  if not exists (select 1 from analytics_daily_rollup where day = current_date - 1) then
    perform analytics_compute_rollup_for_day(current_date - 1);
  end if;

  return query
    select * from analytics_daily_rollup
    where day >= (current_date - days_back)
    order by day desc;
end;
$$;

create or replace function analytics_get_events(
  p_session_id text default null,
  p_user_id uuid default null,
  p_limit int default 200
)
returns setof analytics_events
language sql
security definer
set search_path = public
as $$
  select * from analytics_events
  where is_admin(auth.uid())
    and (p_session_id is null or session_id = p_session_id)
    and (p_user_id is null or user_id = p_user_id)
  order by created_at desc
  limit p_limit;
$$;

-- Recent distinct sessions, for JourneysTab.jsx's session picker — most
-- recently active first, with a cheap event-count/first-seen summary so
-- the picker doesn't need a separate query per row.
create or replace function analytics_get_recent_sessions(p_limit int default 50)
returns table(
  session_id text,
  anon_id text,
  user_id uuid,
  event_count bigint,
  first_event timestamptz,
  last_event timestamptz,
  last_path text
)
language sql
security definer
set search_path = public
as $$
  select session_id, anon_id, user_id, count(*), min(created_at), max(created_at),
         (array_agg(path order by created_at desc))[1]
  from analytics_events
  where is_admin(auth.uid())
  group by session_id, anon_id, user_id
  order by max(created_at) desc
  limit p_limit;
$$;

-- Table-health / row-count summary, for the "database at a glance" panel
-- so admins stop opening the Supabase table editor for this question.
create or replace function analytics_table_counts()
returns table(table_name text, row_count bigint)
language sql
security definer
set search_path = public
as $$
  select 'waypoints', count(*) from waypoints where is_admin(auth.uid())
  union all
  select 'segments', count(*) from segments where is_admin(auth.uid())
  union all
  select 'reviews', count(*) from reviews where is_admin(auth.uid())
  union all
  select 'profiles', count(*) from profiles where is_admin(auth.uid())
  union all
  select 'waypoint_submissions_pending', count(*) from waypoints
    where status = 'pending' and is_admin(auth.uid())
  union all
  select 'analytics_events', count(*) from analytics_events where is_admin(auth.uid());
$$;

-- Recent signups, for DatabaseTab.jsx's "recent signups" list. Flagged
-- per the build plan: confirm `profiles.created_at` actually exists
-- before trusting this — if the column is missing this RPC will fail to
-- create/error on call, not silently return nothing, so it'll surface
-- loudly rather than mask a real schema gap.
create or replace function analytics_recent_signups(p_limit int default 10)
returns table(id uuid, display_name text, created_at timestamptz)
language sql
security definer
set search_path = public
as $$
  select id, display_name, created_at
  from profiles
  where is_admin(auth.uid())
  order by created_at desc
  limit p_limit;
$$;

-- ── Daily rollup job — options, in order of preference ──────────────────
-- 1. Supabase Cron + Edge Function (if the project's Supabase plan
--    supports pg_cron / scheduled Edge Functions) — a function that runs
--    nightly and calls analytics_compute_rollup_for_day(current_date - 1).
--    NOT WIRED HERE — flag for the implementing session: confirm live
--    whether the project's plan actually supports pg_cron before setting
--    this up; this file does not assume it does.
-- 2. Fallback, WHICH IS WHAT analytics_get_rollup() ABOVE ACTUALLY DOES:
--    compute the rollup lazily/on-demand the first time a given (recent)
--    day is queried, cached in analytics_daily_rollup via
--    `on conflict (day) do update`. This is a deliberate compromise, not
--    the ideal design — `new_users`/`returning_users` are left at 0 in
--    this fallback (see analytics_compute_rollup_for_day's own comment)
--    and every OverviewTab.jsx load pays the cost of a fresh scan for
--    today's still-changing row (capped to once per hour via the
--    `computed_at` staleness check above, not on every single request).

-- ── Things flagged for the implementing/deploying session, not silently
-- guessed (same discipline as every other slice's SQL file) ─────────────
-- - Whether the Supabase project's plan actually supports pg_cron/
--   scheduled Edge Functions — confirm before replacing the lazy-compute
--   fallback above with the real nightly job.
-- - `profiles` table's actual columns — does it have `created_at`?
--   confirm before DatabaseTab.jsx's "recent signups" is trusted.
-- - RLS on every RPC above must be verified live with a non-admin
--   account actually returning nothing/erroring, not just assumed from
--   this SQL.
-- - `navigator.sendBeacon` isn't usable for authenticated Supabase
--   inserts — `src/lib/analytics.js`'s `pagehide` synchronous-flush
--   compromise may still occasionally lose the very last event on a hard
--   tab-close. Known, accepted limitation, not something this SQL can
--   fix.