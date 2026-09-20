-- Prevent duplicate admin/KML waypoints with the same name and coordinates.
-- Run the diagnostic query first. Remove or merge every reported duplicate,
-- then run the unique-index statement separately.
--
-- This is intentionally scoped to approved browser-created rows. OSM bulk
-- imports are excluded, and rejected submissions remain as history without
-- blocking a later approved submission for the same place.

-- Find every conflict before creating the index.
select
  lower(trim(name)) as normalized_name,
  lat,
  lng,
  count(*) as duplicate_count,
  array_agg(id order by created_at nulls first, id) as waypoint_ids
from public.waypoints
where source_type is distinct from 'osm_import'
  and status = 'approved'
group by lower(trim(name)), lat, lng
having count(*) > 1
order by duplicate_count desc;

-- After the query above returns zero rows, run this separately:
--
-- create unique index if not exists waypoints_name_coords_unique
--   on public.waypoints (lower(trim(name)), lat, lng)
--   where source_type is distinct from 'osm_import'
--     and status = 'approved';