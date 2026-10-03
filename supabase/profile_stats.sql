-- ════════════════════════════════════════════════════════════════════════
-- Profile stats — Reviews / Navigations counters on the Profile tab
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Nothing in the app
-- applies this automatically, and the live database is NOT fixed until
-- it has been run (see "Verification" at the bottom).
--
-- Safe to re-run: every statement is idempotent. Safe for existing
-- accounts: step 2 backfills missing `profiles` rows and recomputes both
-- counters from the real data. Order-independent with
-- supabase/waypoint_submissions.sql (it defines the same `profiles`
-- superset and the same `handle_new_user`; whichever runs first wins and
-- the other is a no-op).
--
-- What this fixes (found by reading the current implementation):
--
--  1. `recompute_profile_review_count()` (FIREBASE_TO_SUPABASE_MIGRATION.md
--     Step 7) was NOT `security definer`. It ran as the reviewing user,
--     who has no UPDATE policy on `profiles`, so Postgres RLS silently
--     filtered the UPDATE to zero rows and `review_count` never moved.
--     It was also insert-only, so deleted/cascaded reviews left the count
--     stale. Replaced below with a definer function on INSERT/UPDATE/
--     DELETE that always recomputes from the actual `reviews` rows.
--
--  2. `reviews.user_id` was whatever the client sent. Any client could
--     attribute reviews to another user's profile. A trigger now rejects
--     a `user_id` that isn't the caller's own `auth.uid()`.
--
--  3. `nav_count` had no writer at all. It is now derived from a new
--     `navigation_completions` table (one row per completed trip,
--     idempotent on trip id) written ONLY through the
--     `record_navigation_completion` RPC.
--
--  4. Existing accounts created before the trigger existed (or when it
--     failed) have no `profiles` row. Backfilled below.
--
-- Metric definitions (unchanged in meaning):
--   review_count = number of rows in `reviews` with user_id = this user.
--   nav_count    = number of completed navigations recorded for this user.
--                  Nothing wrote this column before, so every existing
--                  value is 0 and "recompute from the completions table"
--                  does not change any previously-meaningful number.
--                  (Step 0 below warns if that assumption is wrong.)
-- ════════════════════════════════════════════════════════════════════════


-- ── 0. Pre-flight (read-only) ───────────────────────────────────────────
-- nav_count had no writer, so this should report 0 rows. If it does not,
-- those non-zero values will be replaced by the recomputed count (which
-- starts from the empty completions table). Investigate before continuing.
do $$
declare n integer;
begin
  if to_regclass('public.profiles') is not null
     and exists (select 1 from information_schema.columns
                 where table_schema = 'public' and table_name = 'profiles'
                   and column_name = 'nav_count') then
    execute 'select count(*) from public.profiles where nav_count > 0' into n;
    if n > 0 then
      raise warning 'profile_stats.sql: % profile(s) have nav_count > 0 from before this migration. They will be recomputed from navigation_completions (currently empty).', n;
    end if;
  end if;
end $$;


-- ── 1. Schema ───────────────────────────────────────────────────────────

alter table public.reviews
  add column if not exists user_id uuid references auth.users(id);

-- Same superset waypoint_submissions.sql defines (is_admin, timestamps),
-- so running either file first is fine.
create table if not exists public.profiles (
  id            uuid primary key references auth.users(id) on delete cascade,
  is_admin      boolean not null default false,
  review_count  integer not null default 0,
  nav_count     integer not null default 0,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

alter table public.profiles
  add column if not exists is_admin boolean not null default false,
  add column if not exists review_count integer not null default 0,
  add column if not exists nav_count integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

-- One row per completed navigation. Composite PK = idempotency: the same
-- (user, trip) can never be counted twice, whether from a retry, a page
-- reload mid-arrival, or a duplicate callback. Deliberately minimal — no
-- destination/route columns; this is a counter source, not trip history.
create table if not exists public.navigation_completions (
  user_id       uuid not null references auth.users(id) on delete cascade,
  trip_id       uuid not null,
  completed_at  timestamptz not null default now(),
  primary key (user_id, trip_id)
);

create index if not exists navigation_completions_user_completed_idx
  on public.navigation_completions (user_id, completed_at desc);


-- ── 2. Profile row creation (new users) + backfill (existing users) ─────
-- Same body as waypoint_submissions.sql's version. A failure here never
-- blocks sign-up (it only warns), which is exactly why the app must treat
-- a missing profile row as an explicit state, not as "0 reviews".

create or replace function public.handle_new_user() returns trigger
  security definer
  set search_path = public
as $$
begin
  insert into public.profiles (id)
  values (new.id)
  on conflict (id) do nothing;
  return new;
exception when others then
  raise warning 'handle_new_user failed for user %: %', new.id, sqlerrm;
  return new;
end;
$$ language plpgsql;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Backfill: every existing Auth user gets a profile row.
insert into public.profiles (id)
select u.id from auth.users u
on conflict (id) do nothing;


-- ── 3. review_count — always recomputed from the real rows ───────────────
-- security definer is REQUIRED: the reviewing user has no UPDATE access to
-- `profiles` (and must not — see section 6), so an invoker-rights trigger
-- updates zero rows under RLS. Definer rights bypass RLS as table owner.

create or replace function public.recompute_profile_review_count() returns trigger
  security definer
  set search_path = public
as $$
declare
  old_uid uuid;
  new_uid uuid;
begin
  if tg_op in ('UPDATE', 'DELETE') then old_uid := old.user_id; end if;
  if tg_op in ('INSERT', 'UPDATE') then new_uid := new.user_id; end if;

  if old_uid is not null then
    update public.profiles
       set review_count = (select count(*) from public.reviews where user_id = old_uid)
     where id = old_uid;
  end if;
  if new_uid is not null and new_uid is distinct from old_uid then
    update public.profiles
       set review_count = (select count(*) from public.reviews where user_id = new_uid)
     where id = new_uid;
  end if;
  return null;
end;
$$ language plpgsql;

-- Replaces Step 7's insert-only trigger.
drop trigger if exists reviews_after_insert_profile_count on public.reviews;
drop trigger if exists reviews_after_change_profile_count on public.reviews;
create trigger reviews_after_change_profile_count
  after insert or delete or update of user_id on public.reviews
  for each row execute function public.recompute_profile_review_count();

-- Attribution guard (security INVOKER on purpose: current_user must be the
-- calling API role). A request made as `anon`/`authenticated` may only set
-- user_id to its own auth.uid() or leave it null (anonymous review stays
-- valid). SQL-editor / service-role / migration writes (other roles) are
-- not restricted.
create or replace function public.reviews_enforce_own_user_id() returns trigger as $$
begin
  if new.user_id is not null
     and new.user_id is distinct from auth.uid()
     and current_user in ('anon', 'authenticated') then
    raise exception 'reviews.user_id must be the signed-in user''s own id'
      using errcode = '42501';
  end if;
  return new;
end;
$$ language plpgsql;

drop trigger if exists reviews_enforce_own_user_id on public.reviews;
create trigger reviews_enforce_own_user_id
  before insert or update of user_id on public.reviews
  for each row execute function public.reviews_enforce_own_user_id();


-- ── 4. nav_count — derived from navigation_completions ───────────────────

create or replace function public.recompute_profile_nav_count() returns trigger
  security definer
  set search_path = public
as $$
declare
  uid uuid;
begin
  uid := case when tg_op = 'DELETE' then old.user_id else new.user_id end;
  update public.profiles
     set nav_count = (select count(*) from public.navigation_completions where user_id = uid)
   where id = uid;
  return null;
end;
$$ language plpgsql;

drop trigger if exists navigation_completions_after_change on public.navigation_completions;
create trigger navigation_completions_after_change
  after insert or delete on public.navigation_completions
  for each row execute function public.recompute_profile_nav_count();

-- The ONLY write path for navigation completions. The client calls this
-- exactly when its arrival detection confirms a trip finished (see
-- NavigationController.jsx `arrivedAtDestination`), passing a trip id it
-- generated when the trip started.
--
--   * Idempotent: the same trip id is counted once, however many times
--     this is called (retries, reload mid-arrival, duplicate callbacks).
--   * Requires a signed-in user (auth.uid()); guests are never counted.
--   * Throttled: a second completion within 15 seconds of the previous one
--     is not counted. A real trip cannot finish that fast (arrival needs
--     three consecutive GPS fixes within 15 m after a fresh route fetch),
--     so this bounds how fast a scripted client can inflate the counter.
--     Arrival is detected client-side from GPS, so this cannot prove a trip
--     physically happened — it only makes the counter non-arbitrary.
--
-- Returns {"counted": bool, "reason": text|null, "nav_count": int}.
create or replace function public.record_navigation_completion(p_trip_id uuid)
  returns jsonb
  security definer
  set search_path = public
as $$
declare
  uid uuid := auth.uid();
  inserted integer;
  current_count integer;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;
  if p_trip_id is null then
    raise exception 'trip id is required' using errcode = '22004';
  end if;

  -- Serialize per user so the throttle check + insert can't race.
  perform pg_advisory_xact_lock(hashtextextended(uid::text, 0));

  if exists (select 1 from public.navigation_completions
              where user_id = uid and trip_id = p_trip_id) then
    select nav_count into current_count from public.profiles where id = uid;
    return jsonb_build_object('counted', false, 'reason', 'duplicate', 'nav_count', current_count);
  end if;

  if exists (select 1 from public.navigation_completions
              where user_id = uid and completed_at > now() - interval '15 seconds') then
    select nav_count into current_count from public.profiles where id = uid;
    return jsonb_build_object('counted', false, 'reason', 'throttled', 'nav_count', current_count);
  end if;

  insert into public.navigation_completions (user_id, trip_id)
  values (uid, p_trip_id)
  on conflict do nothing;
  get diagnostics inserted = row_count;

  select nav_count into current_count from public.profiles where id = uid;
  return jsonb_build_object(
    'counted', inserted = 1,
    'reason', case when inserted = 1 then null else 'duplicate' end,
    'nav_count', current_count
  );
end;
$$ language plpgsql;

revoke all on function public.record_navigation_completion(uuid) from public, anon;
grant execute on function public.record_navigation_completion(uuid) to authenticated;


-- ── 5. Recompute both counters for every existing account ────────────────
-- Idempotent; run after sections 3–4 so triggers and data agree.

update public.profiles p
   set review_count = coalesce((select count(*) from public.reviews r where r.user_id = p.id), 0),
       nav_count    = coalesce((select count(*) from public.navigation_completions c where c.user_id = p.id), 0);


-- ── 6. Least-privilege access ────────────────────────────────────────────
-- Users: SELECT their own profile row only. Nobody on the client API can
-- INSERT/UPDATE/DELETE `profiles` (counters AND is_admin are server-only),
-- and `navigation_completions` is not directly readable or writable.
-- Triggers/RPCs above run with definer rights and are unaffected.

alter table public.profiles enable row level security;
alter table public.navigation_completions enable row level security;

-- Drop any client write policies that may exist on `profiles` (e.g. added
-- by hand in the dashboard). SELECT policies are left alone here and
-- audited by the verification query below instead.
do $$
declare pol record;
begin
  for pol in
    select policyname from pg_policies
     where schemaname = 'public' and tablename = 'profiles'
       and cmd in ('INSERT', 'UPDATE', 'DELETE', 'ALL')
  loop
    execute format('drop policy %I on public.profiles', pol.policyname);
    raise notice 'dropped client write policy % on profiles', pol.policyname;
  end loop;
end $$;

drop policy if exists "profiles_select_own" on public.profiles;
create policy "profiles_select_own" on public.profiles
  for select to authenticated
  using (auth.uid() = id);

-- Belt and braces: even if a permissive policy is added later, the API
-- roles hold no write privilege on these tables.
revoke all on public.profiles from anon, authenticated;
grant select on public.profiles to authenticated;

revoke all on public.navigation_completions from anon, authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- Verification — run these AFTER the script and read the results
-- (this file does not prove the live database is fixed until you do).
-- ════════════════════════════════════════════════════════════════════════
--
-- a) Every auth user has a profile (expect 0):
--      select count(*) from auth.users u
--      where not exists (select 1 from public.profiles p where p.id = u.id);
--
-- b) Counters match the source rows (expect 0 rows):
--      select p.id, p.review_count,
--             (select count(*) from public.reviews r where r.user_id = p.id) as actual_reviews,
--             p.nav_count,
--             (select count(*) from public.navigation_completions c where c.user_id = p.id) as actual_navs
--      from public.profiles p
--      where p.review_count <> (select count(*) from public.reviews r where r.user_id = p.id)
--         or p.nav_count    <> (select count(*) from public.navigation_completions c where c.user_id = p.id);
--
-- c) Only ONE kind of policy on profiles — a SELECT-own policy (expect
--    exactly profiles_select_own / SELECT; any extra SELECT policy that
--    isn't scoped to the owner would expose other users' rows):
--      select policyname, cmd, roles, qual from pg_policies
--      where schemaname = 'public' and tablename = 'profiles';
--
-- d) API roles hold no write privilege (expect only SELECT for authenticated,
--    nothing for anon):
--      select grantee, privilege_type from information_schema.role_table_grants
--      where table_schema = 'public' and table_name = 'profiles'
--        and grantee in ('anon', 'authenticated');
--
-- e) Live behaviour, with a real signed-in test user (client or
--    `set local role authenticated` + `set local request.jwt.claim.sub`):
--      - submit a review  -> that user's profiles.review_count goes up by 1
--      - delete that review (as admin/SQL editor) -> count goes back down
--      - insert a review with someone else's user_id as the test user -> rejected (42501)
--      - `update profiles set nav_count = 99` as the test user -> permission denied
--      - rpc('record_navigation_completion', {p_trip_id: <uuid>}) twice with
--        the same uuid -> nav_count rises by exactly 1, second call
--        returns reason 'duplicate'
--      - the same rpc while signed out (anon key) -> error, nothing counted
