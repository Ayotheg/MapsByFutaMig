-- ── Admin write access to waypoints (fixes: edits / new points / approvals do nothing) ──
--
-- Sections 1-4 are safe to run as-is, once, in the Supabase SQL editor.
-- Section 5 rewrites data in waypoints.type — read it and run it separately.
--
-- WHY THIS EXISTS
-- `waypoint_submissions.sql` narrowed the waypoints policies to:
--     select  -> status = 'approved' OR submitted_by = auth.uid()
--     insert  -> students only, and only as status = 'pending'
--     update  -> is_admin(auth.uid())
--     delete  -> a student's own pending rows only
-- That leaves admins with NO policy for:
--     * inserting an approved waypoint        ("Add Point" never reaches the map)
--     * seeing other people's pending rows    (Pending tab / Approve)
--     * deleting any waypoint
-- and, because Postgres RLS silently filters UPDATE/DELETE instead of raising an
-- error, edits and approvals looked like they worked while changing nothing.
--
-- Every policy below is gated on is_admin(auth.uid()) (defined in
-- waypoint_submissions.sql), so students gain nothing.

-- ── 1. waypoints ─────────────────────────────────────────────────────────
drop policy if exists "admin_select_all" on waypoints;
create policy "admin_select_all" on waypoints
  for select to authenticated
  using (is_admin(auth.uid()));

drop policy if exists "admin_insert" on waypoints;
create policy "admin_insert" on waypoints
  for insert to authenticated
  with check (is_admin(auth.uid()));

drop policy if exists "admin_update" on waypoints;
create policy "admin_update" on waypoints
  for update to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists "admin_delete" on waypoints;
create policy "admin_delete" on waypoints
  for delete to authenticated
  using (is_admin(auth.uid()));

-- ── 2. waypoint_images (admin adds / removes photos while editing) ───────
drop policy if exists "admin_all_images" on waypoint_images;
create policy "admin_all_images" on waypoint_images
  for all to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

-- Reading images must stay public so the map can show them. Harmless if you
-- already have an equivalent policy — this only adds one if none exists.
do $$
begin
  if not exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'waypoint_images' and cmd = 'SELECT'
  ) then
    create policy "public_read_images" on waypoint_images for select using (true);
  end if;
end $$;

-- ── 3. Storage bucket `place-images` (admin photo upload / cleanup) ──────
drop policy if exists "admin_manage_place_images" on storage.objects;
create policy "admin_manage_place_images" on storage.objects
  for all to authenticated
  using (bucket_id = 'place-images' and is_admin(auth.uid()))
  with check (bucket_id = 'place-images' and is_admin(auth.uid()));

-- ── 4. Make sure YOUR account is an admin ────────────────────────────────
-- The admin PIN only unlocks the panel in the browser. The database decides by
-- profiles.is_admin. Find your id, then flag it:
--
--   select id, email from auth.users order by created_at desc;   -- find yourself
--   update profiles set is_admin = true where id = '<your-uuid>';
--
-- Check who is currently an admin:
--   select p.id, u.email, p.is_admin from profiles p join auth.users u on u.id = p.id where p.is_admin;

-- ── 5. Clean up waypoints saved with a type the map can't render ─────────
-- Before the app fix, saving some waypoints in the admin panel wrote a search-chip
-- name (shawarma, car_wash, restaurant, kiosk...) into waypoints.type. Those pins
-- have no colour, no legend row and no type-filter toggle. Review first:
--
--   select type, count(*) from waypoints
--   where type is null or type not in (
--     'lecture_hall','faculty','laboratory','workshop','library','admin','hostel',
--     'staff_quarters','food','shop','printing_shop','fuel','bank','sports','hall',
--     'clinic','toilet','garage','bus_stop','infrastructure','mosque','chapel','gate','landmark')
--   group by type order by count(*) desc;
--
-- Then run the mapping below (mirrors the merge table in adminTypeOptions.js).
update waypoints set type = case
    when lower(type) in ('senate','bursary','student_affairs','government','office') then 'admin'
    when lower(type) in ('cafe','restaurant','kiosk','fast_food','shawarma') then 'food'
    when lower(type) in ('shopping','furniture','barber','laundry','convenience','beauty','hairdresser',
                         'clothes','clothing','footwear','shoes','mobile_phone','computer',
                         'interior_decoration','supermarket','beverages','vending_machine',
                         'car_wash','gas') then 'shop'
    when lower(type) in ('auditorium','arts_centre','social_centre') then 'hall'
    when lower(type) in ('pharmacy','hospital','chemist') then 'clinic'
    when lower(type) in ('dormitory','off_campus_lodge','townhall') then 'hostel'
    when lower(type) in ('utility','security_post','security','police','fire_station',
                         'warehouse','parking','parking_space') then 'infrastructure'
    when lower(type) = 'entrance' then 'gate'
    when lower(type) in ('poi','hazard','junction') then 'landmark'
    else type
  end
where type is not null
  and type not in (
    'lecture_hall','faculty','laboratory','workshop','library','admin','hostel',
    'staff_quarters','food','shop','printing_shop','fuel','bank','sports','hall',
    'clinic','toilet','garage','bus_stop','infrastructure','mosque','chapel','gate','landmark');

-- Anything still left over after the mapping above is genuinely unclassified.
-- Run this only after reviewing the SELECT in section 5 — it is optional, and the
-- app already displays such rows as "landmark":
--
--   update waypoints set type = 'landmark'
--   where type is null or type not in (<the 24 types above>);
