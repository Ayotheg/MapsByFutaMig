-- ── Events — automatic cleanup of abandoned listings (supabase/events_cleanup.sql)
--
-- Run AFTER events.sql, events_hardening.sql and events_owner_remove.sql.
-- Safe to run more than once.
--
-- Listings that were never paid — test tries, abandoned checkouts, and ones
-- the organiser removed from their profile — are deleted for good 30 days
-- after their last activity. The 30 days keep the record around in case
-- anyone later asks about a payment ("I paid and my event vanished"): an
-- admin can still check it.
--
-- Never deleted by this job: anything BACHS ever reported a payment for
-- (paid_at / bachs_payment_id set), free events, and anything in review,
-- approved or rejected. Those stay until an admin deals with them.
--
-- Poster FILES in the place-images bucket (event/<id>/…) aren't touched —
-- a database job can't reach Storage. They're small (compressed on upload)
-- and can be cleared from the dashboard.

create extension if not exists pg_cron;

create or replace function purge_stale_unpaid_events()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  with gone as (
    delete from events
     where status in ('awaiting_payment', 'removed')
       and payment_status in ('unpaid', 'failed', 'expired')
       and paid_at is null
       and bachs_payment_id is null
       -- last activity: created, or the latest checkout opened
       and greatest(created_at, coalesce(bachs_checkout_started_at, created_at)) < now() - interval '30 days'
    returning id
  )
  select count(*) into n from gone;
  return n;
end;
$$;

-- Only the scheduler (and the dashboard) runs this, never the app.
revoke all on function purge_stale_unpaid_events() from public, anon, authenticated;

-- Every day at 03:30 Lagos time (02:30 UTC). Re-running this file replaces
-- the job instead of adding a second one.
do $$
begin
  if exists (select 1 from cron.job where jobname = 'purge-stale-unpaid-events') then
    perform cron.unschedule('purge-stale-unpaid-events');
  end if;
end $$;

select cron.schedule(
  'purge-stale-unpaid-events',
  '30 2 * * *',
  'select public.purge_stale_unpaid_events()'
);
