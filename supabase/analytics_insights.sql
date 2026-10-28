-- ── Insights tab: extra numbers ─────────────────────────────────────────
--
-- Adds ONE read-only, admin-only function. No tables, columns, policies or
-- data change. Safe to re-run (create or replace).
--
-- What it powers in the admin Insights tab (src/features/analytics/):
--   Trends: people (truly unique, not added up per day), new people vs
--           people who came back, visits, how long people stay, phone vs
--           computer, busiest times of day.
--   Places: most opened places, kinds of place, how people found them,
--           opened a place then got directions, searches that found nothing.
--   Usage:  average trip time.
-- Until this is run, those cards simply don't show; everything else in the
-- tab uses the existing functions in supabase/analytics.sql.
--
-- Reads analytics_events only. Events it relies on (all sent by the app):
--   place_opened {id, name, type, source}  — MapPage.jsx openPlace()
--   app_opened   {returning}               — lib/analytics.js trackVisitStart()
--   search_query {query, result_count}
--   nav_started / nav_completed {duration_ms}
--
-- Cost: one pass over the chosen window plus a first-seen lookup per
-- visitor in it. Fine at the current size (thousands of rows); if
-- analytics_events grows into the millions, move first-seen into a table.

create or replace function analytics_insights(days_back int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := now() - make_interval(days => days_back);
  v_prev timestamptz := now() - make_interval(days => days_back * 2);
  result jsonb;
begin
  if not is_admin(auth.uid()) then
    return null;
  end if;

  with ev as (
    select e.*, coalesce(e.user_id::text, e.anon_id) as who
    from analytics_events e
    where e.created_at >= v_from
  ),
  prev as (
    select coalesce(user_id::text, anon_id) as who, session_id
    from analytics_events
    where created_at >= v_prev and created_at < v_from
  ),
  first_seen as (
    select coalesce(user_id::text, anon_id) as who, min(created_at) as first_at
    from analytics_events
    where coalesce(user_id::text, anon_id) in (select distinct who from ev)
    group by 1
  ),
  visits as (
    select session_id, min(created_at) as started, max(created_at) as ended, count(*) as n
    from ev
    group by session_id
  ),
  opened as (
    select * from ev where event_name = 'place_opened'
  )
  select jsonb_build_object(
    'people',        (select count(distinct who) from ev),
    'people_prev',   (select count(distinct who) from prev),
    'new_people',    (select count(*) from first_seen where first_at >= v_from),
    'visits',        (select count(*) from visits),
    'visits_prev',   (select count(distinct session_id) from prev),
    -- Single-event visits have no length; leave them out of the average.
    'avg_visit_seconds', (
      select coalesce(round(avg(extract(epoch from ended - started))), 0)
      from visits where n > 1
    ),
    'devices', (
      select coalesce(jsonb_object_agg(device, people), '{}'::jsonb)
      from (
        select coalesce(device_type, 'unknown') as device, count(distinct who) as people
        from ev group by 1
      ) t
    ),
    -- Visits active in each hour of the day, campus time.
    'hours', (
      select coalesce(jsonb_agg(jsonb_build_object('hour', hour, 'visits', visits) order by hour), '[]'::jsonb)
      from (
        select extract(hour from created_at at time zone 'Africa/Lagos')::int as hour,
               count(distinct session_id) as visits
        from ev group by 1
      ) t
    ),
    'places_opened', (select count(*) from opened),
    'top_places', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', c) order by c desc), '[]'::jsonb)
      from (
        select props->>'name' as name, count(*) as c
        from opened where props->>'name' is not null
        group by 1 order by 2 desc limit 10
      ) t
    ),
    'place_types', (
      select coalesce(jsonb_agg(jsonb_build_object('type', type, 'count', c) order by c desc), '[]'::jsonb)
      from (
        select props->>'type' as type, count(*) as c
        from opened where props->>'type' is not null
        group by 1 order by 2 desc limit 8
      ) t
    ),
    'place_sources', (
      select coalesce(jsonb_object_agg(source, c), '{}'::jsonb)
      from (
        select coalesce(props->>'source', 'other') as source, count(*) as c
        from opened group by 1
      ) t
    ),
    -- Of visits where a place was opened, the share that also started
    -- directions.
    'opened_then_directions', (
      select case when count(*) = 0 then null
                  else round(100.0 * count(*) filter (where went) / count(*)) end
      from (
        select o.session_id,
               bool_or(exists (
                 select 1 from ev n
                 where n.session_id = o.session_id and n.event_name = 'nav_started'
               )) as went
        from opened o group by o.session_id
      ) t
    ),
    'nothing_found', (
      select coalesce(jsonb_agg(jsonb_build_object('query', query, 'count', c) order by c desc), '[]'::jsonb)
      from (
        select lower(trim(props->>'query')) as query, count(*) as c
        from ev
        where event_name = 'search_query'
          and props->>'result_count' = '0'
          and coalesce(trim(props->>'query'), '') <> ''
        group by 1 order by 2 desc limit 10
      ) t
    ),
    'avg_trip_seconds', (
      select round(avg((props->>'duration_ms')::numeric) / 1000)
      from ev
      where event_name = 'nav_completed' and props->>'duration_ms' ~ '^[0-9]+$'
    )
  ) into result;

  return result;
end;
$$;
