-- Admin write boundary for the browser admin console.
--
-- Run waypoint_submissions.sql first. It creates the security-definer
-- is_admin(uuid) helper and the profiles.is_admin flag. The client-side PIN
-- is not a security boundary; these policies are.
--
-- This file is safe to re-run. It deliberately leaves public SELECT access
-- in place for map content, while every admin mutation requires both an
-- authenticated session and profiles.is_admin = true.

alter table segments enable row level security;
alter table segment_points enable row level security;
alter table segment_images enable row level security;
alter table waypoints enable row level security;
alter table waypoint_images enable row level security;

-- The map uses the browser publishable/anon client, so approved waypoints
-- must have an explicit read policy. Do not rely on a policy created by an
-- older migration being present in the live project.
drop policy if exists "public_read_approved" on waypoints;
create policy "public_read_approved" on waypoints
  for select
  using (status = 'approved' or submitted_by = auth.uid());

drop policy if exists "public_read_waypoint_images" on waypoint_images;
create policy "public_read_waypoint_images" on waypoint_images
  for select
  using (
    exists (
      select 1
      from waypoints w
      where w.id = waypoint_id
        and (w.status = 'approved' or w.submitted_by = auth.uid())
    )
  );

-- Remove the broad policy names used by the earlier live setup. Leaving one
-- permissive policy beside an admin-only policy would still allow any signed-
-- in user to mutate the table because PostgreSQL ORs policies together.
drop policy if exists "public_write" on waypoints;
drop policy if exists "authenticated_write" on waypoints;
drop policy if exists "public_write" on segments;
drop policy if exists "authenticated_write" on segments;
drop policy if exists "public_write" on segment_points;
drop policy if exists "authenticated_write" on segment_points;
drop policy if exists "public_write" on segment_images;
drop policy if exists "authenticated_write" on segment_images;
drop policy if exists "public_write" on waypoint_images;
drop policy if exists "authenticated_write" on waypoint_images;

-- Waypoints also have student-submission policies in
-- waypoint_submissions.sql. These admin policies are additive: a student
-- cannot satisfy is_admin(auth.uid()).
drop policy if exists "admin_insert_waypoints" on waypoints;
create policy "admin_insert_waypoints" on waypoints
  for insert to authenticated
  with check (is_admin(auth.uid()));

drop policy if exists "admin_update_waypoints" on waypoints;
drop policy if exists "admin_update" on waypoints;
create policy "admin_update_waypoints" on waypoints
  for update to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists "admin_delete_waypoints" on waypoints;
create policy "admin_delete_waypoints" on waypoints
  for delete to authenticated
  using (is_admin(auth.uid()));

drop policy if exists "admin_insert_segments" on segments;
create policy "admin_insert_segments" on segments
  for insert to authenticated
  with check (is_admin(auth.uid()));

drop policy if exists "admin_update_segments" on segments;
create policy "admin_update_segments" on segments
  for update to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists "admin_delete_segments" on segments;
create policy "admin_delete_segments" on segments
  for delete to authenticated
  using (is_admin(auth.uid()));

drop policy if exists "admin_insert_segment_points" on segment_points;
create policy "admin_insert_segment_points" on segment_points
  for insert to authenticated
  with check (is_admin(auth.uid()));

drop policy if exists "admin_delete_segment_points" on segment_points;
create policy "admin_delete_segment_points" on segment_points
  for delete to authenticated
  using (is_admin(auth.uid()));

drop policy if exists "admin_insert_waypoint_images" on waypoint_images;
create policy "admin_insert_waypoint_images" on waypoint_images
  for insert to authenticated
  with check (is_admin(auth.uid()));

drop policy if exists "admin_delete_waypoint_images" on waypoint_images;
create policy "admin_delete_waypoint_images" on waypoint_images
  for delete to authenticated
  using (is_admin(auth.uid()));

drop policy if exists "admin_insert_segment_images" on segment_images;
create policy "admin_insert_segment_images" on segment_images
  for insert to authenticated
  with check (is_admin(auth.uid()));

drop policy if exists "admin_delete_segment_images" on segment_images;
create policy "admin_delete_segment_images" on segment_images
  for delete to authenticated
  using (is_admin(auth.uid()));

-- Storage objects are separate from database rows, so table RLS cannot
-- protect uploads/removals. Keep public reads if the bucket is public, but
-- restrict object mutations to authenticated admins.
drop policy if exists "admin_upload_place_images" on storage.objects;
create policy "admin_upload_place_images" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'place-images' and is_admin(auth.uid()));

drop policy if exists "admin_update_place_images" on storage.objects;
create policy "admin_update_place_images" on storage.objects
  for update to authenticated
  using (bucket_id = 'place-images' and is_admin(auth.uid()))
  with check (bucket_id = 'place-images' and is_admin(auth.uid()));

drop policy if exists "admin_delete_place_images" on storage.objects;
create policy "admin_delete_place_images" on storage.objects
  for delete to authenticated
  using (bucket_id = 'place-images' and is_admin(auth.uid()));

-- Verification: run as an authenticated admin and as a non-admin test user.
-- The admin should be able to insert/update/delete; the non-admin should
-- receive an RLS violation for each mutation.
select auth.uid() as current_user_id, is_admin(auth.uid()) as current_user_is_admin;