-- ════════════════════════════════════════════════════════════════════════
-- Learned shortcuts — shorter ways people actually take
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Safe to re-run: every
-- statement is idempotent, and it upgrades an earlier version of this file
-- in place. Needs is_admin() from waypoint_submissions.sql.
--
-- How it works:
--   * When a signed-in user arrives after leaving the planned route by a
--     way at least 50 m shorter — walking, or in any vehicle —
--     the app (with their permission) sends just that stretch: never the
--     whole trip, never its first or last 30 m.
--   * Stretches with both ends within 20 m of an existing shortcut's ends
--     (either direction) and a similar length are grouped into it.
--   * Once 2 different users have taken it, it becomes 'active' and the
--     app routes everyone (guests too) through it when it's shorter.
--   * When people are routed through an active shortcut, the app reports
--     whether they took it or went around it. If the last 3 different
--     people all went around it, it's hidden automatically.
--   * Admins manage everything in the admin panel's Shortcuts tab. One an
--     admin switches on is "locked": only an admin can switch it off.
--
-- Only signed-in users can contribute (guests get 3 free navigations, then
-- must sign in — see useGuestUsage.js), so every count is a real account.
-- ════════════════════════════════════════════════════════════════════════


-- ── 1. Schema ───────────────────────────────────────────────────────────

create table if not exists public.learned_shortcuts (
  id                 bigint generated always as identity primary key,
  start_lat          double precision not null,
  start_lng          double precision not null,
  end_lat            double precision not null,
  end_lng            double precision not null,
  -- [[lat, lng], ...] of the first walk; later walks only add to the count.
  path               jsonb not null,
  length_m           double precision not null,
  walker_count       integer not null default 0,
  status             text not null default 'learning' check (status in ('learning', 'active', 'hidden')),
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

alter table public.learned_shortcuts
  add column if not exists by_vehicle         boolean not null default false,  -- first found from a vehicle (any kind)
  add column if not exists used_count         integer not null default 0,
  add column if not exists avoided_count      integer not null default 0,
  add column if not exists hidden_by          text check (hidden_by in ('admin', 'auto')),
  add column if not exists locked             boolean not null default false,  -- switched on by an admin
  add column if not exists status_changed_at  timestamptz not null default now();

create index if not exists learned_shortcuts_status_idx on public.learned_shortcuts (status);

-- One row per shared stretch. PK = idempotency: a retried upload of the
-- same trip's stretch is never counted twice.
create table if not exists public.shortcut_walks (
  contributor  text not null,  -- 'u:<user id>'
  user_id      uuid references auth.users(id) on delete cascade,
  trip_id      uuid not null,
  seq          smallint not null,
  shortcut_id  bigint not null references public.learned_shortcuts(id) on delete cascade,
  length_m     double precision not null,
  saved_m      double precision not null,
  created_at   timestamptz not null default now(),
  primary key (contributor, trip_id, seq)
);

alter table public.shortcut_walks
  add column if not exists by_vehicle boolean not null default false;

create index if not exists shortcut_walks_shortcut_idx on public.shortcut_walks (shortcut_id);
create index if not exists shortcut_walks_contributor_created_idx on public.shortcut_walks (contributor, created_at desc);

-- One row per (user, trip, shortcut) they were routed through.
create table if not exists public.shortcut_outcomes (
  contributor  text not null,
  user_id      uuid references auth.users(id) on delete cascade,
  trip_id      uuid not null,
  shortcut_id  bigint not null references public.learned_shortcuts(id) on delete cascade,
  used         boolean not null,
  created_at   timestamptz not null default now(),
  primary key (contributor, trip_id, shortcut_id)
);

create index if not exists shortcut_outcomes_shortcut_created_idx on public.shortcut_outcomes (shortcut_id, created_at desc);
create index if not exists shortcut_outcomes_contributor_created_idx on public.shortcut_outcomes (contributor, created_at desc);

-- Upgrading an earlier draft that also accepted guests: make sure the
-- account column exists, drop the guest-only columns and helpers (columns
-- first, in case anything on them used the helpers), and remove guest
-- rows so every count is a real account.
alter table public.shortcut_walks add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.shortcut_outcomes add column if not exists user_id uuid references auth.users(id) on delete cascade;
alter table public.shortcut_walks drop column if exists ip_hash;
alter table public.shortcut_outcomes drop column if exists ip_hash;
drop function if exists public.shortcut_request_ip_hash();
drop function if exists public.shortcut_contributor(uuid);

-- Signed-in rows from a draft without the user_id column: fill it in from
-- 'u:<id>' before removing the guest ('a:…') rows.
-- (Accounts deleted since then are left null, and removed below.)
update public.shortcut_walks w set user_id = u.id
  from auth.users u
 where w.user_id is null and w.contributor = 'u:' || u.id;
update public.shortcut_outcomes o set user_id = u.id
  from auth.users u
 where o.user_id is null and o.contributor = 'u:' || u.id;
delete from public.shortcut_walks where user_id is null;
delete from public.shortcut_outcomes where user_id is null;
-- Shortcuts that only guests had taken have nothing left behind them
-- (an admin's locked ones stay).
delete from public.learned_shortcuts s
 where not s.locked
   and not exists (select 1 from public.shortcut_walks w where w.shortcut_id = s.id);
update public.learned_shortcuts s
   set walker_count = (select count(distinct w.contributor) from public.shortcut_walks w where w.shortcut_id = s.id);
-- Active only because of guests: back to learning (an admin's locked ones stay).
update public.learned_shortcuts
   set status = 'learning'
 where status = 'active' and not locked and walker_count < 2;


-- ── 2. Helper ───────────────────────────────────────────────────────────

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


-- ── 3. Sharing a stretch ────────────────────────────────────────────────
--
--   * Signed-in users only.
--   * Path checks: 3–300 points, all inside the campus box
--     (lib/campusBounds.js), no jump over 200 m between points, 20 m–5 km
--     long. The length is worked out here, not trusted.
--   * At most 30 per user per day.
--
-- Returns {"accepted": bool, "reason": text|null, "shortcut_id": bigint,
--          "walkers": int, "status": text}.
drop function if exists public.submit_shortcut_walk(uuid, integer, jsonb, double precision);
drop function if exists public.submit_shortcut_walk(uuid, integer, jsonb, double precision, uuid);
drop function if exists public.submit_shortcut_walk(uuid, integer, jsonb, double precision, uuid, boolean);

create or replace function public.submit_shortcut_walk(p_trip_id uuid, p_seq integer, p_path jsonb,
                                                       p_saved_m double precision, p_by_vehicle boolean default false)
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
  hop double precision;
  len double precision := 0;
  s_lat double precision;
  s_lng double precision;
  sid bigint;
  walkers integer;
  st text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  who := 'u:' || uid;
  if p_trip_id is null or p_seq is null or p_seq < 0 or p_seq > 9 then
    raise exception 'trip id and seq 0-9 are required' using errcode = '22023';
  end if;
  if jsonb_typeof(p_path) is distinct from 'array' then
    raise exception 'path must be an array' using errcode = '22023';
  end if;
  n := jsonb_array_length(p_path);
  if n < 3 or n > 300 then
    raise exception 'path must have 3-300 points' using errcode = '22023';
  end if;

  for pt in select value from jsonb_array_elements(p_path) loop
    if jsonb_typeof(pt) <> 'array' or jsonb_array_length(pt) <> 2
       or jsonb_typeof(pt -> 0) <> 'number' or jsonb_typeof(pt -> 1) <> 'number' then
      raise exception 'each point must be [lat, lng]' using errcode = '22023';
    end if;
    lat := (pt ->> 0)::double precision;
    lng := (pt ->> 1)::double precision;
    if lat not between 7.2820 and 7.3120 or lng not between 5.1080 and 5.1680 then
      raise exception 'path is outside the campus area' using errcode = '22023';
    end if;
    if prev_lat is not null then
      hop := geo_distance_m(prev_lat, prev_lng, lat, lng);
      if hop > 200 then
        raise exception 'path has a gap over 200 m' using errcode = '22023';
      end if;
      len := len + hop;
    end if;
    prev_lat := lat;
    prev_lng := lng;
  end loop;
  if len < 20 or len > 5000 then
    raise exception 'path must be 20 m to 5 km long' using errcode = '22023';
  end if;
  -- prev_lat/prev_lng are now the path's end.
  s_lat := (p_path -> 0 ->> 0)::double precision;
  s_lng := (p_path -> 0 ->> 1)::double precision;

  -- One submission at a time, so two people taking the same new path at
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
    insert into learned_shortcuts (start_lat, start_lng, end_lat, end_lng, path, length_m, by_vehicle)
    values (s_lat, s_lng, prev_lat, prev_lng, p_path, len, coalesce(p_by_vehicle, false))
    returning id into sid;
  end if;

  insert into shortcut_walks (contributor, user_id, trip_id, seq, shortcut_id, length_m, saved_m, by_vehicle)
  values (who, uid, p_trip_id, p_seq, sid, len, greatest(coalesce(p_saved_m, 0), 0), coalesce(p_by_vehicle, false));

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

revoke all on function public.submit_shortcut_walk(uuid, integer, jsonb, double precision, boolean) from public, anon;
grant execute on function public.submit_shortcut_walk(uuid, integer, jsonb, double precision, boolean) to authenticated;


-- ── 4. Status changes ───────────────────────────────────────────────────
--
-- Switching a shortcut on restarts its took-it / went-around counts, so it
-- gets a fresh chance; a hidden one keeps its counts so the admin can see
-- why. hidden_by records who hid it: report_shortcut_outcome sets 'auto';
-- an admin changing only `status` gets 'admin'. An admin (an API request,
-- current_user 'authenticated') switching one on locks it on; the
-- definer-rights functions here run as the table owner, so their own
-- activations never lock.
create or replace function public.learned_shortcuts_status_change() returns trigger as $$
begin
  if new.status is distinct from old.status then
    new.status_changed_at := now();
    if new.status = 'hidden' then
      if new.hidden_by is not distinct from old.hidden_by then new.hidden_by := 'admin'; end if;
      new.locked := false;
    else
      new.hidden_by := null;
    end if;
    if new.status = 'active' then
      new.used_count := 0;
      new.avoided_count := 0;
      if current_user = 'authenticated' then new.locked := true; end if;
    end if;
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists learned_shortcuts_status_change on public.learned_shortcuts;
create trigger learned_shortcuts_status_change
  before update of status on public.learned_shortcuts
  for each row execute function public.learned_shortcuts_status_change();


-- ── 5. Took it, or went around it? ──────────────────────────────────────
--
-- Sent when a signed-in user routed through an active shortcut reaches it
-- and then arrives (no location, just used / avoided). If the last 3
-- different people since it was switched on all went around it, it's
-- hidden automatically — e.g. a GPS-drift "path" through a building, or one
-- since fenced off — unless an admin locked it on. At most 50 per user per
-- day.
--
-- Returns {"recorded": bool, "reason": text|null, "status": text}.
drop function if exists public.report_shortcut_outcome(bigint, uuid, boolean, uuid);

create or replace function public.report_shortcut_outcome(p_shortcut_id bigint, p_trip_id uuid, p_used boolean)
  returns jsonb
  security definer
  set search_path = public
as $$
declare
  uid uuid := auth.uid();
  who text;
  sc learned_shortcuts%rowtype;
  recent_avoided integer;
  recent_total integer;
  st text;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  who := 'u:' || uid;
  if p_shortcut_id is null or p_trip_id is null or p_used is null then
    raise exception 'shortcut id, trip id and used are required' using errcode = '22023';
  end if;

  select * into sc from learned_shortcuts where id = p_shortcut_id for update;
  if not found or sc.status <> 'active' then
    return jsonb_build_object('recorded', false, 'reason', 'not_active');
  end if;
  if exists (select 1 from shortcut_outcomes
              where contributor = who and trip_id = p_trip_id and shortcut_id = p_shortcut_id) then
    return jsonb_build_object('recorded', false, 'reason', 'duplicate', 'status', sc.status);
  end if;
  if (select count(*) from shortcut_outcomes
       where contributor = who and created_at > now() - interval '1 day') >= 50 then
    return jsonb_build_object('recorded', false, 'reason', 'throttled', 'status', sc.status);
  end if;

  insert into shortcut_outcomes (contributor, user_id, trip_id, shortcut_id, used)
  values (who, uid, p_trip_id, p_shortcut_id, p_used);

  -- Each person's latest report since the shortcut was last switched on;
  -- the 3 most recent people decide.
  select count(*) filter (where not used), count(*)
    into recent_avoided, recent_total
    from (select used
            from (select distinct on (contributor) contributor, used, created_at
                    from shortcut_outcomes
                   where shortcut_id = p_shortcut_id and created_at >= sc.status_changed_at
                   order by contributor, created_at desc) latest
           order by created_at desc
           limit 3) last3;

  update learned_shortcuts
     set used_count = (select count(*) from shortcut_outcomes
                        where shortcut_id = p_shortcut_id and used and created_at >= sc.status_changed_at),
         avoided_count = (select count(*) from shortcut_outcomes
                           where shortcut_id = p_shortcut_id and not used and created_at >= sc.status_changed_at),
         updated_at = now()
   where id = p_shortcut_id;

  if not sc.locked and recent_total >= 3 and recent_avoided = recent_total then
    update learned_shortcuts set status = 'hidden', hidden_by = 'auto' where id = p_shortcut_id;
  end if;

  select status into st from learned_shortcuts where id = p_shortcut_id;
  return jsonb_build_object('recorded', true, 'reason', null, 'status', st);
end;
$$ language plpgsql;

revoke all on function public.report_shortcut_outcome(bigint, uuid, boolean) from public, anon;
grant execute on function public.report_shortcut_outcome(bigint, uuid, boolean) to authenticated;


-- ── 6. Access ───────────────────────────────────────────────────────────
-- Everyone (guests too) can read ACTIVE shortcuts' paths — routing needs
-- them. Nobody can read who took them. Admins can see and switch any.

alter table public.learned_shortcuts enable row level security;
alter table public.shortcut_walks enable row level security;
alter table public.shortcut_outcomes enable row level security;

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
grant select (id, path, length_m, walker_count, status, by_vehicle, used_count, avoided_count,
              hidden_by, locked, status_changed_at, created_at, updated_at)
  on public.learned_shortcuts to anon, authenticated;
grant update (status) on public.learned_shortcuts to authenticated;

revoke all on public.shortcut_walks from anon, authenticated;
revoke all on public.shortcut_outcomes from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- Verification — run AFTER the script
-- ════════════════════════════════════════════════════════════════════════
--
-- a) Tables and functions exist (expect 3 rows, then 2 rows):
--      select table_name from information_schema.tables
--      where table_schema = 'public' and table_name in ('learned_shortcuts', 'shortcut_walks', 'shortcut_outcomes');
--      select oid::regprocedure from pg_proc where proname in ('submit_shortcut_walk', 'report_shortcut_outcome');
--
-- b) Live behaviour, with two real signed-in test accounts:
--      - user A: rpc('submit_shortcut_walk', {p_trip_id: <uuid>, p_seq: 0,
--        p_path: [[7.3000,5.1400],[7.3005,5.1405],[7.3010,5.1410]], p_saved_m: 60,
--        p_by_vehicle: false}) -> accepted, walkers 1, status 'learning'
--      - same call again -> reason 'duplicate'
--      - user B, same path, new trip id -> walkers 2, status 'active'
--      - signed out (anon key): that rpc -> error; select from learned_shortcuts -> only active rows
--      - a point outside the campus box, or two points 300 m apart -> error 22023
--      - three different users: rpc('report_shortcut_outcome', {p_shortcut_id: <active id>,
--        p_trip_id: <new uuid>, p_used: false}) -> after the third, status 'hidden', hidden_by 'auto'
--      - admin, from the Shortcuts tab: switch it on -> locked, counts back to 0;
--        more "went around" reports leave it on
--
-- ════════════════════════════════════════════════════════════════════════
-- Admin without the app (the Shortcuts tab does the same)
-- ════════════════════════════════════════════════════════════════════════
--
--   select id, status, hidden_by, locked, by_vehicle, walker_count, used_count, avoided_count,
--          round(length_m) as metres, start_lat, start_lng, end_lat, end_lng
--   from learned_shortcuts order by updated_at desc;
--
--   update learned_shortcuts set status = 'hidden' where id = <id>;   -- switch off
--   update learned_shortcuts set status = 'active' where id = <id>;   -- switch on
--
-- From the SQL editor, switching on doesn't lock (current_user isn't
-- 'authenticated' there); also run  update learned_shortcuts set locked = true where id = <id>;
