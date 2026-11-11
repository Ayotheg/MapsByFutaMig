-- ── Insights tab: Meet me / Race numbers ────────────────────────────────
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Nothing in the app
-- applies this automatically. Adds ONE read-only, admin-only function. No
-- tables, columns, policies or data change. Safe to re-run.
--
-- Powers two cards on the admin Insights > Usage tab. Until this is run they
-- show a note saying so; nothing else is affected.
--
-- Reads analytics_events only. Events it relies on (all sent by the app):
--   friends_joined {mode, via}, friends_started {mode},
--   friends_ended {mode, reason, finishers},
--   friends_intro {action: shown | try | later | close | outside | esc | interrupted}
--
-- Who counts as one person:
--   Feature use: the account, or the browser if signed out, like the rest of
--   Insights. A host counts once they start (tapping "Meet a friend" opens a
--   lobby by itself, so opening one isn't use); a guest counts once they're
--   in the room.
--   The pop-up: the browser (anon_id). It's shown once per device, often
--   before sign-in, and signing in changes the account id but not this.
--
-- "Ignored" = shown the pop-up and didn't tap Try it now: closed it, tapped
-- Maybe later, opened something else, or left without answering. Those who
-- left without answering are also counted on their own (`no_answer`).

create or replace function analytics_friends(days_back int default 30)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_from timestamptz := now() - make_interval(days => days_back);
  result jsonb;
begin
  if not is_admin(auth.uid()) then
    return null;
  end if;

  with ev as (
    select event_name,
           props->>'mode' as mode,
           props->>'action' as action,
           props->>'via' as via,
           props->>'reason' as reason,
           case when props->>'finishers' ~ '^[0-9]+$' then (props->>'finishers')::int else 0 end as finishers,
           coalesce(user_id::text, anon_id) as who,
           anon_id,
           created_at
    from analytics_events
    where created_at >= v_from
      and event_name in ('friends_joined', 'friends_started', 'friends_ended', 'friends_intro')
  ),
  -- One row per browser that was shown the pop-up.
  intro as (
    select anon_id,
           min(created_at) filter (where action = 'shown') as shown_at,
           coalesce(bool_or(action = 'try'), false) as tried,
           coalesce(bool_or(action not in ('shown', 'try')), false) as closed
    from ev
    where event_name = 'friends_intro'
    group by anon_id
    having min(created_at) filter (where action = 'shown') is not null
  ),
  -- ...and whether that browser then started or joined something.
  intro_used as (
    select i.*,
           exists (
             select 1 from ev u
             where u.anon_id = i.anon_id
               and u.event_name in ('friends_started', 'friends_joined')
               and u.created_at > i.shown_at
           ) as used
    from intro i
  )
  select jsonb_build_object(
    'days', days_back,
    'people', (select count(distinct who) from ev where event_name in ('friends_started', 'friends_joined')),
    'meet', (
      select jsonb_build_object(
        'people', count(distinct who) filter (where event_name in ('friends_started', 'friends_joined')),
        'joined', count(*) filter (where event_name = 'friends_joined'),
        'started', count(*) filter (where event_name = 'friends_started'),
        'finished', count(*) filter (where event_name = 'friends_ended' and reason = 'met')
      )
      from ev where mode = 'meet'
    ),
    'race', (
      select jsonb_build_object(
        'people', count(distinct who) filter (where event_name in ('friends_started', 'friends_joined')),
        'joined', count(*) filter (where event_name = 'friends_joined'),
        'started', count(*) filter (where event_name = 'friends_started'),
        -- Ended with at least one person across the line: everyone finished,
        -- the time limit ran out, or the last host left.
        'finished', count(*) filter (where event_name = 'friends_ended' and reason in ('done', 'timeout', 'host-left') and finishers > 0)
      )
      from ev where mode = 'race'
    ),
    'joined_by_code', (select count(*) from ev where event_name = 'friends_joined' and via = 'code'),
    'joined_by_link', (select count(*) from ev where event_name = 'friends_joined' and via = 'link'),
    'intro', (
      select jsonb_build_object(
        'shown', count(*),
        'tried', count(*) filter (where tried),
        'tried_used', count(*) filter (where tried and used),
        'ignored', count(*) filter (where not tried),
        'ignored_used', count(*) filter (where not tried and used),
        'no_answer', count(*) filter (where not tried and not closed)
      )
      from intro_used
    )
  ) into result;

  return result;
end;
$$;
