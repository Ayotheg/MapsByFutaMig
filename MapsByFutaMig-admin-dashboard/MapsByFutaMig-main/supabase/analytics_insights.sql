-- ── Insights tab: extra numbers ─────────────────────────────────────────
--
-- Adds ONE read-only, admin-only function and one index. No tables,
-- columns, policies or data change. Safe to re-run.
--
-- What it powers in the admin Insights tab (src/features/analytics/):
--   Trends: people (truly unique, not added up per day), new people vs
--           people who came back, visits, how long people stay, phone vs
--           computer, busiest times of day.
--   Places: most opened places, kinds of place, how people found them,
--           opened a place then got directions, top destinations, searches
--           that found nothing.
--   Usage:  exact directions counts (started / got there / stopped / went off
--           route), average trip time, and every kind of tap counted (the
--           daily rollup only keeps each day's top 10).
-- Until this is run, those cards fall back to the daily rollup or hide.
--
-- Reads analytics_events only. Events it relies on (all sent by the app):
--   app_opened, place_opened {id, name, type, source},
--   search_query {query, result_count}, nav_started {to},
--   nav_completed {duration_ms}, nav_abandoned, nav_rerouted
--
-- A "visit" is one browser tab's session, split wherever it sat idle for 30
-- minutes — a tab left open for days is many visits, not one long one.

-- Lets each visitor's first-ever event be looked up directly (new vs came
-- back) instead of scanning the whole table.
create index if not exists analytics_events_who_idx
  on analytics_events ((coalesce(user_id::text, anon_id)), created_at);

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
  -- Midnight today on campus (the daily rollup counts UTC days).
  v_today timestamptz := date_trunc('day', now() at time zone 'Africa/Lagos') at time zone 'Africa/Lagos';
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
  -- Same visit splitting for this window and the one before it.
  marked as (
    select ev.*,
           case when created_at - lag(created_at) over w > interval '30 minutes'
                  or lag(created_at) over w is null then 1 else 0 end as starts_visit
    from ev
    window w as (partition by session_id order by created_at)
  ),
  numbered as (
    select marked.*,
           sum(starts_visit) over (partition by session_id order by created_at rows unbounded preceding) as visit_no
    from marked
  ),
  visits as (
    select session_id, visit_no,
           min(created_at) as started, max(created_at) as ended, count(*) as n,
           min(created_at) filter (where event_name = 'place_opened') as first_open,
           max(created_at) filter (where event_name = 'nav_started') as last_nav
    from numbered
    group by session_id, visit_no
  ),
  prev_visits as (
    select count(*) as c from (
      select session_id,
             case when created_at - lag(created_at) over (partition by session_id order by created_at) > interval '30 minutes'
                    or lag(created_at) over (partition by session_id order by created_at) is null then 1 else 0 end as s
      from analytics_events
      where created_at >= v_prev and created_at < v_from
    ) t where s = 1
  ),
  people_now as (
    select distinct who from ev
  ),
  first_seen as (
    select p.who,
           (select min(a.created_at) from analytics_events a
             where coalesce(a.user_id::text, a.anon_id) = p.who) as first_at
    from people_now p
  ),
  opened as (
    select * from ev where event_name = 'place_opened'
  )
  select jsonb_build_object(
    'today_people', (select count(distinct who) from ev where created_at >= v_today),
    'today_visits', (select count(*) from visits where ended >= v_today),
    'people',      (select count(*) from people_now),
    'people_prev', (
      select count(distinct coalesce(user_id::text, anon_id))
      from analytics_events where created_at >= v_prev and created_at < v_from
    ),
    'new_people',  (select count(*) from first_seen where first_at >= v_from),
    'visits',      (select count(*) from visits),
    'visits_prev', (select c from prev_visits),
    -- One-event visits have no length; leave them out of the average.
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
               count(distinct (session_id, visit_no)) as visits
        from numbered group by 1
      ) t
    ),
    'places_opened', (select count(*) from opened),
    'top_places', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', c) order by c desc), '[]'::jsonb)
      from (
        select props->>'name' as name, count(*) as c
        from opened where coalesce(props->>'name', '') <> ''
        group by 1 order by 2 desc limit 10
      ) t
    ),
    'place_types', (
      select coalesce(jsonb_agg(jsonb_build_object('type', type, 'count', c) order by c desc), '[]'::jsonb)
      from (
        select lower(props->>'type') as type, count(*) as c
        from opened where coalesce(props->>'type', '') <> ''
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
    -- Of visits where a place was opened, the share that went on to start
    -- directions after it.
    'opened_then_directions', (
      select case when count(*) = 0 then null
                  else round(100.0 * count(*) filter (where last_nav > first_open) / count(*)) end
      from visits where first_open is not null
    ),
    'top_destinations', (
      select coalesce(jsonb_agg(jsonb_build_object('name', name, 'count', c) order by c desc), '[]'::jsonb)
      from (
        select props->>'to' as name, count(*) as c
        from ev
        where event_name = 'nav_started' and coalesce(props->>'to', '') <> ''
        group by 1 order by 2 desc limit 10
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
    -- Every event kind, counted in full.
    'event_counts', (
      select coalesce(jsonb_object_agg(event_name, c), '{}'::jsonb)
      from (select event_name, count(*) as c from ev group by 1) t
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
