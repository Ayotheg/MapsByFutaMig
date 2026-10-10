-- One-off cleanup: listings still live in Explore/the map after their
-- `promotions` row was deleted by hand in the Supabase dashboard.
--
-- STEP 1 — look first. These are promoted waypoints that no promotion points
-- at any more (i.e. the ghosts). Check the names are the test data you meant.
select w.id, w.name, w.type, w.is_business, w.is_explore, w.is_promoted, w.status, w.saved_at
  from waypoints w
 where w.is_promoted = true
   and w.promo_label = 'Promoted'
   and not exists (select 1 from promotions p where p.waypoint_id = w.id)
 order by w.saved_at desc;

-- STEP 1b — note the photo files these ghosts own BEFORE deleting: the rows
-- below disappear with the waypoint, and a database delete can't remove the
-- files from Storage. After step 2, delete these paths by hand in
-- Supabase → Storage → place-images (they live under the `promotion/` folder).
select wi.waypoint_id, wi.storage_path
  from waypoint_images wi
  join waypoints w on w.id = wi.waypoint_id
 where w.is_promoted = true
   and w.promo_label = 'Promoted'
   and not exists (select 1 from promotions p where p.waypoint_id = w.id)
 order by wi.waypoint_id, wi.position;

-- STEP 2 — delete the ones you recognise, by id (paste the ids from step 1).
-- waypoint_images rows go with them automatically.
-- delete from waypoints where id in ('PASTE-ID-HERE');
