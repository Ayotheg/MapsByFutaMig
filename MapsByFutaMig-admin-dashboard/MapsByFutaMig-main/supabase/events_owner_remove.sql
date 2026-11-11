-- ── Events — organiser removes an unpaid listing (supabase/events_owner_remove.sql)
--
-- Run AFTER events.sql and events_hardening.sql. Safe to run more than once.
--
-- The profile's "Event not paid yet" card has a Remove button, so someone who
-- tried a few times doesn't keep seeing old unpaid listings. Only the owner,
-- only a ticketed event that was never paid (unpaid / failed / expired).
--
-- It HIDES the row (status 'removed', shown under the admin Events tab's
-- Removed filter) instead of deleting it. A payment can still be in flight
-- when someone taps Remove (a checkout open in another tab); if it lands,
-- bachs-webhook finds the row and moves it to 'pending_review' as usual, so
-- the money is never lost. A deleted row would leave that payment with
-- nothing to attach to. Admins can still erase it for good (admin_remove_event).

create or replace function remove_my_unpaid_event(p_id text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;

  update events
     set status = 'removed',
         is_featured = false,
         rejection_reason = 'Removed by the organiser before paying'
   where id = p_id
     and submitted_by = auth.uid()
     and status = 'awaiting_payment'
     and payment_status in ('unpaid', 'failed', 'expired');

  if not found then
    raise exception 'This event can''t be removed (it may already be paid)';
  end if;
end;
$$;

revoke all on function remove_my_unpaid_event(text) from public;
grant execute on function remove_my_unpaid_event(text) to authenticated;
