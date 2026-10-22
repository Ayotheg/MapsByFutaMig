-- ════════════════════════════════════════════════════════════════════════
-- Learned shortcuts — shorter ways students actually walk
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Safe to re-run: every
-- statement is idempotent. Needs is_admin() from waypoint_submissions.sql.
--
-- How it works:
--   * When a user (guest or signed in) arrives after leaving the planned
--     route by a shorter way, the app sends just that stretch (never the
--     whole trip, and never its first 30 m) through `submit_shortcut_walk`.
--   * Walks with both ends within 20 m of an existing shortcut's ends
--     (either direction) and a similar length are grouped into it.
--   * Once 2 different contributors have walked it, its status becomes
--     'active' and the app routes everyone through it.
--   * A contributor is the signed-in account, otherwise the browser's
--     anonymous id (`futa_anon_id`, the same one analytics.sql counts
--     unique visitors by). A guest who clears their browser data gets a
--     new id, so one person CAN make a shortcut active alone — the admin
--     "hidden" status at the end of this file is the safety net.
--   * Hidden shortcuts stay hidden however many people walk them, so a
--     rejected path can't come back by itself.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. Schema ───────────────────────────────────────────────────────────

create table if not exists public.learned_shortcuts (
  id            bigint generated always as identity primary key,
  start_lat     double precision not null,
  start_lng     double precision not null,
  end_lat       double precision not null,
  end_lng       double precision not null,
  -- [[lat, lng], ...] of the first walk; later walks only add to the count.
  path          jsonb not null,
  length_m      double precision not null,
  walker_count  integer not null default 0,
  status        text not null default 'learning' check (status in ('learning', 'active', 'hidden')),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists learned_shortcuts_status_idx on public.learned_shortcuts (status);

-- One row per shared stretch. PK = idempotency: a retried upload of the
-- same trip's stretch is never counted twice.
create table if not exists public.shortcut_walks (
  -- 'u:<user id>' or 'a:<anon id>'
  contributor  text not null,
  user_id      uuid references auth.users(id) on delete cascade,
  trip_id      uuid not null,
  seq          smallint not null,
  shortcut_id  bigint not null references public.learned_shortcuts(id) on delete cascade,
  length_m     double precision not null,
  saved_m      double precision not null,
  created_at   timestamptz not null default now(),
  primary key (contributor, trip_id, seq)
);

create index if not exists shortcut_walks_shortcut_idx on public.shortcut_walks (shortcut_id);
create index if not exists shortcut_walks_contributor_created_idx on public.shortcut_walks (contributor, created_at desc);


-- ── 2. Helpers ──────────────────────────────────────────────────────────

-- Metres between two points (same formula as the app's lib/geoUtils.js).
create or replace function public.geo_distance_m(lat1 double precision, lng1 double precision,
                                                 lat2 double precision, lng2 double precision)
  returns double precision
  language sql immutable
as $$
  select 6371000 * 2 * asin(least(1, sqrt(
    sin(radians(lat2 - lat1) / 2) ^ 2
    + cos(radians(lat1)) * cos(radians(lat2)) * sin(radians(lng2 - lng1) / 2) ^ 2)));
$$;


-- ── 3. The only write path ──────────────────────────────────────────────
--
--   * Signed in: counted as the account (p_anon_id is ignored).
--     Guest: counted as p_anon_id, which must be a uuid.
--   * Validates the path: 2–300 points, all inside the campus box
--     (lib/campusBounds.js); its length is worked out here, not trusted.
--   * Throttled to 30 stretches per contributor per day.
--
-- Returns {"accepted": bool, "reason": text|null, "shortcut_id": bigint,
--          "walkers": int, "status": text}.
create or replace function public.submit_shortcut_walk(p_trip_id uuid, p_seq integer, p_path jsonb,
                                                       p_saved_m double precision, p_anon_id uuid default null)
  returns jsonb
  security definer
  set search_path = public
as $$
declare
  uid uuid := auth.uid();
  who text;
  n integer;
  pt jsonb;
  lat double precision;
  lng double precision;
  prev_lat double precision;
  prev_lng double precision;
  len double precision := 0;
  s_lat double precision;
  s_lng double precision;
  sid bigint;
  walkers integer;
  st text;
begin
  if uid is not null then
    who := 'u:' || uid;
  elsif p_anon_id is not null then
    who := 'a:' || p_anon_id;
  else
    raise exception 'anon id is required for guests' using errcode = '22023';
  end if;
  if p_trip_id is null or p_seq is null or p_seq < 0 or p_seq > 9 then
    raise exception 'trip id and seq 0-9 are required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_path) is distinct from 'array' then
    raise exception 'path must be an array' using errcode = '22023';
  end if;
  n := jsonb_array_length(p_path);
  if n < 2 or n > 300 then
    raise exception 'path must have 2-300 points' using errcode = '22023';
  end if;

  for pt in select value from jsonb_array_elements(p_path) loop
    if jsonb_typeof(pt) <> 'array' or jsonb_array_length(pt) <> 2
       or jsonb_typeof(pt -> 0) <> 'number' or jsonb_typeof(pt -> 1) <> 'number' then
      raise exception 'each point must be [lat, lng]' using errcode = '22023';
    end if;
    lat := (pt ->> 0)::double precision;
    lng := (pt ->> 1)::double precision;
    if lat not between 7.2820 and 7.3120 or lng not between 5.1080 and 5.1680 then
      raise exception 'path is outside campus' using errcode = '22023';
    end if;
    if prev_lat is not null then
      len := len + geo_distance_m(prev_lat, prev_lng, lat, lng);
    end if;
    prev_lat := lat;
    prev_lng := lng;
  end loop;
  -- prev_lat/prev_lng are now the path's end.
  s_lat := (p_path -> 0 ->> 0)::double precision;
  s_lng := (p_path -> 0 ->> 1)::double precision;

  -- One submission at a time, so two people walking the same new path at
  -- once can't create two separate shortcuts for it.
  perform pg_advisory_xact_lock(hashtextextended('learned_shortcuts', 0));

  if exists (select 1 from shortcut_walks where contributor = who and trip_id = p_trip_id and seq = p_seq) then
    return jsonb_build_object('accepted', false, 'reason', 'duplicate');
  end if;
  if (select count(*) from shortcut_walks
       where contributor = who and created_at > now() - interval '1 day') >= 30 then
    return jsonb_build_object('accepted', false, 'reason', 'throttled');
  end if;

  select s.id into sid
    from learned_shortcuts s
   where s.length_m between len * 0.75 and len * 1.25
     and ((geo_distance_m(s_lat, s_lng, s.start_lat, s.start_lng) <= 20
           and geo_distance_m(prev_lat, prev_lng, s.end_lat, s.end_lng) <= 20)
       or (geo_distance_m(s_lat, s_lng, s.end_lat, s.end_lng) <= 20
           and geo_distance_m(prev_lat, prev_lng, s.start_lat, s.start_lng) <= 20))
   order by least(
     geo_distance_m(s_lat, s_lng, s.start_lat, s.start_lng) + geo_distance_m(prev_lat, prev_lng, s.end_lat, s.end_lng),
     geo_distance_m(s_lat, s_lng, s.end_lat, s.end_lng) + geo_distance_m(prev_lat, prev_lng, s.start_lat, s.start_lng))
   limit 1;

  if sid is null then
    insert into learned_shortcuts (start_lat, start_lng, end_lat, end_lng, path, length_m)
    values (s_lat, s_lng, prev_lat, prev_lng, p_path, len)
    returning id into sid;
  end if;

  insert into shortcut_walks (contributor, user_id, trip_id, seq, shortcut_id, length_m, saved_m)
  values (who, uid, p_trip_id, p_seq, sid, len, greatest(coalesce(p_saved_m, 0), 0));

  select count(distinct contributor) into walkers from shortcut_walks where shortcut_id = sid;
  update learned_shortcuts
     set walker_count = walkers,
         status = case when status = 'learning' and walkers >= 2 then 'active' else status end,
         updated_at = now()
   where id = sid
  returning status into st;

  return jsonb_build_object('accepted', true, 'reason', null, 'shortcut_id', sid, 'walkers', walkers, 'status', st);
end;
$$ language plpgsql;

-- Replaces the signed-in-only first draft, if it was ever applied.
drop function if exists public.submit_shortcut_walk(uuid, integer, jsonb, double precision);

revoke all on function public.submit_shortcut_walk(uuid, integer, jsonb, double precision, uuid) from public;
grant execute on function public.submit_shortcut_walk(uuid, integer, jsonb, double precision, uuid) to anon, authenticated;


-- ── 4. Access ───────────────────────────────────────────────────────────
-- Everyone (guests too) can read ACTIVE shortcuts' paths — that's what
-- routing needs. Nobody can read who walked them. Admins can see and
-- hide any shortcut.

alter table public.learned_shortcuts enable row level security;
alter table public.shortcut_walks enable row level security;

drop policy if exists "learned_shortcuts_read_active" on public.learned_shortcuts;
create policy "learned_shortcuts_read_active" on public.learned_shortcuts
  for select to anon, authenticated
  using (status = 'active');

drop policy if exists "learned_shortcuts_admin_select" on public.learned_shortcuts;
create policy "learned_shortcuts_admin_select" on public.learned_shortcuts
  for select to authenticated
  using (is_admin(auth.uid()));

drop policy if exists "learned_shortcuts_admin_update" on public.learned_shortcuts;
create policy "learned_shortcuts_admin_update" on public.learned_shortcuts
  for update to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

revoke all on public.learned_shortcuts from anon, authenticated;
grant select (id, path, length_m, walker_count, status, created_at) on public.learned_shortcuts to anon, authenticated;
grant update (status) on public.learned_shortcuts to authenticated;

revoke all on public.shortcut_walks from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- Verification — run AFTER the script
-- ════════════════════════════════════════════════════════════════════════
--
-- a) Tables and function exist (expect 2 rows, then 1 row):
--      select table_name from information_schema.tables
--      where table_schema = 'public' and table_name in ('learned_shortcuts', 'shortcut_walks');
--      select oid::regprocedure from pg_proc where proname = 'submit_shortcut_walk';
--
-- b) Live behaviour (from the app or the API with the anon key):
--      - guest A: rpc('submit_shortcut_walk', {p_trip_id: <uuid>, p_seq: 0,
--        p_path: [[7.3000,5.1400],[7.3010,5.1410]], p_saved_m: 50, p_anon_id: <uuid A>})
--        -> accepted, walkers 1, status 'learning'
--      - same call again -> reason 'duplicate'
--      - guest B (another anon id), same path, new trip id -> walkers 2, status 'active'
--      - select from learned_shortcuts with the anon key -> only active rows
--      - a point outside campus -> error 22023
--      - select from shortcut_walks with the anon key -> permission denied
--
-- ════════════════════════════════════════════════════════════════════════
-- Admin: reviewing and hiding shortcuts
-- ════════════════════════════════════════════════════════════════════════
--
--   select id, status, walker_count, round(length_m) as metres, start_lat, start_lng, end_lat, end_lng
--   from learned_shortcuts order by updated_at desc;
--
--   update learned_shortcuts set status = 'hidden' where id = <id>;   -- stop using one
--   update learned_shortcuts set status = 'active' where id = <id>;   -- bring it back
