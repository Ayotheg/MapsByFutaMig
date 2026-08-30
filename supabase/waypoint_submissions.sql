-- ── Student-submitted waypoints (pending review) ──────────────────────────
--
-- Backs the "Suggest a Place" flow (SuggestWaypointModal.jsx,
-- submitWaypoint.js) + the admin panel's new "Pending" tab
-- (PendingTab.jsx). Run this once in the Supabase SQL editor.
--
-- Same file-per-feature convention as supabase/quick_chips.sql (that file
-- is the precedent for putting new-slice schema here instead of appending
-- to FIREBASE_TO_SUPABASE_MIGRATION.md, whose own "Step" numbering stops
-- at Step 7 / Slice 10 and was never continued for anything added after
-- Slice 11).

-- ── 1. Review-workflow columns on the existing waypoints table ───────────

-- The migrated table preserves Firestore IDs as text and therefore did not
-- have a default. Keep that compatibility while allowing new inserts to
-- omit the ID safely.
alter table waypoints
  alter column id set default (gen_random_uuid()::text);

alter table waypoints
  add column if not exists status text not null default 'approved'
    check (status in ('pending', 'approved', 'rejected')),
  add column if not exists submitted_by uuid references auth.users(id),
  add column if not exists rejection_reason text;

-- Backfill: every existing row (admin-created, pre-this-slice) is already-
-- live content and should NOT retroactively become invisible now that
-- useWaypoints.js filters to status='approved'.
update waypoints set status = 'approved' where status is null;

-- Default 'approved' is deliberate, not an oversight — existing admin-
-- inserted rows and adminSave.js's insertWaypoint both continue to work
-- unchanged; only the new student-facing submitWaypoint.js explicitly
-- sets status: 'pending'.

-- ── 2. Rate-limit log ──────────────────────────────────────────────────

create table if not exists waypoint_submission_log (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create index if not exists waypoint_submission_log_user_recent
  on waypoint_submission_log (user_id, created_at desc);

alter table waypoint_submission_log enable row level security;

drop policy if exists "insert_own_log" on waypoint_submission_log;
create policy "insert_own_log" on waypoint_submission_log
  for insert to authenticated
  with check (user_id = auth.uid());

drop policy if exists "read_own_log" on waypoint_submission_log;
create policy "read_own_log" on waypoint_submission_log
  for select to authenticated
  using (user_id = auth.uid());

-- One row inserted per submission attempt, regardless of approve/reject
-- outcome — rejected/approved submissions still count toward the daily
-- cap (MAX_PENDING_PER_DAY = 5 in submitWaypoint.js), so a user who gets
-- 5 submissions rejected in a row doesn't get 5 fresh attempts.

-- ── 3. Admin identity ──────────────────────────────────────────────────
--
-- The existing admin gate (adminPin.js/useAdminPin.js/AdminPinGate.jsx)
-- is a client-side PIN check only (confirmed by reading adminPin.js's own
-- header comment) — there was no server-side concept of "this Supabase
-- user is an admin" for RLS to check against before this. This is the
-- minimal fix: adds one column + one function, doesn't touch the existing
-- (working) PIN UI flow at all.

alter table profiles
  add column if not exists is_admin boolean not null default false;

-- Manually set true for the known admin account(s) after running this file:
--   update profiles set is_admin = true where id = '<admin-auth-uid>';

create or replace function is_admin(uid uuid) returns boolean as $$
  select coalesce((select is_admin from profiles where id = uid), false);
$$ language sql stable security definer;

-- A server-side guard for the student rate limit. Admins bypass the daily
-- cap, but regular students cannot exceed 5 pending submissions in 24h.
create or replace function can_submit_pending_waypoint(uid uuid) returns boolean as $$
  select
    is_admin(uid)
    or (
      (
        select count(*)
        from waypoint_submission_log
        where user_id = uid
          and created_at >= now() - interval '24 hours'
      ) < 5
    );
$$ language sql stable security definer;

-- security definer is required here for the same reason quick_chips'
-- trigger functions and Step 7's handle_new_user needed it: is_admin()
-- is called from inside OTHER tables' RLS policies (waypoints'
-- admin_update below), which run as the requesting (non-admin) user;
-- without security definer, that user's own profiles row-level select-
-- own policy would block the lookup for anyone checking someone ELSE's
-- admin flag — exactly what this function needs to do.

-- ── 4. RLS policies on waypoints ───────────────────────────────────────
--
-- Same unverified-exposure note as quick_chips.sql: this client uses the
-- anon key. Existing waypoints policies from before this slice (a
-- blanket public-read + authenticated-write pair) need to be narrowed
-- alongside adding these, not left active in parallel — leaving both live
-- at once would let a signed-in student bypass student_insert_pending
-- entirely through the older, looser policy. Adjust/drop the old ones in
-- the same dashboard session as running this file.

drop policy if exists "student_insert_pending" on waypoints;
create policy "student_insert_pending" on waypoints
  for insert
  to authenticated
  with check (
    status = 'pending'
    and submitted_by = auth.uid()
    and can_submit_pending_waypoint(auth.uid())
  );

drop policy if exists "public_read_approved" on waypoints;
create policy "public_read_approved" on waypoints
  for select
  using (
    status = 'approved'
    or submitted_by = auth.uid()
  );

drop policy if exists "admin_update" on waypoints;
create policy "admin_update" on waypoints
  for update
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists "student_delete_own_pending" on waypoints;
create policy "student_delete_own_pending" on waypoints
  for delete
  to authenticated
  using (submitted_by = auth.uid() and status = 'pending');

-- ── 5. waypoint_images — one more condition ────────────────────────────
--
-- Additive — keep whatever existing admin-write policy is already on
-- this table. This just lets a student attach images to their OWN
-- pending waypoint, not arbitrary/other rows.

drop policy if exists "student_insert_own_pending_images" on waypoint_images;
create policy "student_insert_own_pending_images" on waypoint_images
  for insert
  to authenticated
  with check (
    exists (
      select 1 from waypoints w
      where w.id = waypoint_id
        and w.submitted_by = auth.uid()
        and w.status = 'pending'
    )
  );

-- ── 6. Submitter display name (for the admin Pending tab) ──────────────
--
-- PendingTab.jsx needs to show WHO submitted each pending waypoint. RLS
-- blocks a direct client-side join against auth.users (correctly — that
-- table shouldn't be broadly readable), so this is exposed through a
-- narrow security-definer function instead of granting wider auth.users
-- access.

create or replace function submitter_display_names(user_ids uuid[])
returns table (id uuid, display_name text) as $$
  select
    u.id,
    coalesce(u.raw_user_meta_data->>'display_name', split_part(u.email, '@', 1)) as display_name
  from auth.users u
  where u.id = any(user_ids);
$$ language sql stable security definer;

revoke all on function submitter_display_names(uuid[]) from public;
grant execute on function submitter_display_names(uuid[]) to authenticated;

-- PendingTab.jsx calls THIS wrapper, not the bare function above — the
-- bare version stays available (security definer, authenticated-granted)
-- for a possible future need to resolve a display name outside the admin
-- panel, but nothing in this slice's own UI calls it un-gated.
create or replace function submitter_display_names_admin_check(user_ids uuid[])
returns table (id uuid, display_name text) as $$
  select * from submitter_display_names(user_ids) where is_admin(auth.uid());
$$ language sql stable security definer;

revoke all on function submitter_display_names_admin_check(uuid[]) from public;
grant execute on function submitter_display_names_admin_check(uuid[]) to authenticated;

-- ── Not yet confirmed against a live database ──────────────────────────
--
-- Written from the app code, not run against Supabase yet. In particular,
-- verify LIVE (not just trust the app code) that a direct insert with
-- status: 'approved' from a non-admin authenticated client is actually
-- rejected by student_insert_pending's with-check clause — that's the
-- real security boundary this whole feature depends on.