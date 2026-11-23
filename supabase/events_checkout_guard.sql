-- ── Events — one live checkout at a time (supabase/events_checkout_guard.sql)
--
-- Run AFTER events.sql, events_hardening.sql, events_owner_remove.sql.
-- Safe to run more than once. From the second review of the events feature:
--
--   1. claim_event_checkout(): create-event-checkout calls this (service role
--      only) instead of several separate queries, so two taps at the same
--      moment (profile "Pay now" + "Try payment again" in another tab) can't
--      both open a payable checkout. It locks the row and answers:
--        'reuse'   + url  a checkout is still open (until BACHS's own expiry)
--        'busy'           another call is opening one right now
--        'claimed'        this call may open a fresh checkout (old link cleared)
--        'started' / 'not_payable' / 'missing'
--   2. bachs_checkout_expires_at: BACHS's own expiry for the open checkout
--      (from its create response), so "still open" isn't a guess.
--   3. admin_remove_event: erasing a never-paid listing (unpaid, or removed by
--      its organiser) is refused while a checkout was opened in the last 24
--      hours — a bank transfer can still
--      complete after the checkout expires, and a deleted row would leave
--      that payment with nothing to attach to.
--   4. poster_path may not contain "..".

alter table events add column if not exists bachs_checkout_expires_at timestamptz;

-- The client can't pre-fill the new column either (same rule as
-- events_hardening.sql, plus bachs_checkout_expires_at).
drop policy if exists events_insert_own on events;
create policy events_insert_own
  on events for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and starts_at > now()
    and is_featured = false
    and reviewed_at is null
    and rejection_reason is null
    and paid_at is null
    and bachs_checkout_id is null
    and bachs_checkout_url is null
    and bachs_checkout_started_at is null
    and bachs_checkout_expires_at is null
    and bachs_payment_id is null
    and (
      (entry_type = 'free' and status = 'pending_review' and payment_status = 'not_required' and listing_fee = 0)
      or (entry_type = 'ticketed' and status = 'awaiting_payment' and payment_status = 'unpaid')
    )
  );

create or replace function claim_event_checkout(p_id text, p_fee numeric)
returns table (result text, checkout_url text)
language plpgsql
security definer
set search_path = public
as $$
declare
  e events%rowtype;
begin
  -- Row lock: a second call waits here until the first one has decided.
  select * into e from events where id = p_id for update;
  if not found then
    return query select 'missing'::text, null::text;
    return;
  end if;

  if e.entry_type <> 'ticketed'
     or e.status <> 'awaiting_payment'
     or e.payment_status not in ('unpaid', 'failed', 'expired') then
    return query select 'not_payable'::text, null::text;
    return;
  end if;

  if e.starts_at <= now() then
    return query select 'started'::text, null::text;
    return;
  end if;

  -- A checkout is still open: hand the same one back (until 2 minutes before
  -- BACHS's own expiry; 30 minutes when BACHS didn't say).
  if e.payment_status = 'unpaid'
     and e.bachs_checkout_url is not null
     and coalesce(e.bachs_checkout_expires_at, e.bachs_checkout_started_at + interval '30 minutes')
         > now() + interval '2 minutes' then
    return query select 'reuse'::text, e.bachs_checkout_url;
    return;
  end if;

  -- Another call claimed it moments ago and is still talking to BACHS.
  if e.payment_status = 'unpaid'
     and e.bachs_checkout_url is null
     and e.bachs_checkout_started_at > now() - interval '1 minute' then
    return query select 'busy'::text, null::text;
    return;
  end if;

  update events
     set listing_fee = p_fee,
         currency = 'NGN',
         payment_status = 'unpaid',
         bachs_checkout_id = null,
         bachs_checkout_url = null,
         bachs_checkout_expires_at = null,
         bachs_checkout_started_at = now()
   where id = p_id;

  return query select 'claimed'::text, null::text;
end;
$$;

-- Only the Edge Function (service role) calls this, never the app.
revoke all on function claim_event_checkout(text, numeric) from public, anon, authenticated;

create or replace function admin_remove_event(p_id text, p_erase boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Not authorised';
  end if;

  if p_erase then
    -- Never-paid rows (unpaid listings, or ones the organiser removed) wait
    -- 24 hours after their last checkout before they can be erased.
    delete from events
     where id = p_id
       and status in ('approved', 'removed', 'rejected', 'awaiting_payment')
       and not (
         payment_status in ('unpaid', 'failed', 'expired')
         and bachs_checkout_started_at is not null
         and bachs_checkout_started_at >= now() - interval '24 hours'
       );
  else
    update events
       set status = 'removed', is_featured = false, poster_path = null
     where id = p_id and status = 'approved';
  end if;

  if not found then
    raise exception 'Event % can''t be removed yet (a payment may still be in progress — try again tomorrow)', p_id;
  end if;
end;
$$;

revoke all on function admin_remove_event(text, boolean) from public;
grant execute on function admin_remove_event(text, boolean) to authenticated;

alter table events drop constraint if exists events_poster_path_own;
alter table events add constraint events_poster_path_own
  check (poster_path is null or (poster_path like ('event/' || id || '/%') and poster_path !~ '\.\.'));
