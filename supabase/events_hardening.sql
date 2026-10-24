-- ── Events — hardening (supabase/events_hardening.sql) ──────────────────
--
-- Run AFTER events.sql. Safe to run more than once. Fixes from the review
-- of the events feature:
--   1. poster_path must be this event's own folder (event/<id>/…). Admin
--      Remove/Delete deletes that file, so any other path would let a
--      listing delete someone else's photo.
--   2. online_link must be an http(s) URL (it's opened by "Join online" and
--      written into calendar files).
--   3. currency is pinned to NGN on events AND promotions: the checkout
--      functions charge in the row's currency and the webhook compares
--      against it, so a client-chosen currency could pay "3,000" of a
--      cheaper one.
--   4. Length / range checks on the free-text and coordinate columns, and
--      ends_at after starts_at.
--   5. bachs_checkout_started_at lets create-event-checkout reuse a still-
--      open checkout instead of opening a second one that could also be paid.
--   6. Admins can erase unpaid listings (spam that never paid).

alter table events add column if not exists bachs_checkout_started_at timestamptz;

alter table events drop constraint if exists events_poster_path_own;
alter table events add constraint events_poster_path_own
  check (poster_path is null or poster_path like ('event/' || id || '/%'));

alter table events drop constraint if exists events_online_link_web;
alter table events add constraint events_online_link_web
  check (online_link is null or (online_link ~* '^https?://[^[:space:]]+$' and char_length(online_link) <= 500));

alter table events drop constraint if exists events_venue_name_len;
alter table events add constraint events_venue_name_len
  check (venue_name is null or char_length(btrim(venue_name)) between 1 and 120);

alter table events drop constraint if exists events_coords_range;
alter table events add constraint events_coords_range
  check ((venue_lat is null or venue_lat between -90 and 90) and (venue_lng is null or venue_lng between -180 and 180));

alter table events drop constraint if exists events_ends_after_start;
alter table events add constraint events_ends_after_start
  check (ends_at is null or ends_at > starts_at);

alter table events drop constraint if exists events_currency_ngn;
alter table events add constraint events_currency_ngn check (currency = 'NGN');

alter table promotions drop constraint if exists promotions_currency_ngn;
alter table promotions add constraint promotions_currency_ngn check (currency = 'NGN');

-- Same insert rule as events.sql, plus the new checkout column can't be pre-filled.
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
    and bachs_payment_id is null
    and (
      (entry_type = 'free' and status = 'pending_review' and payment_status = 'not_required' and listing_fee = 0)
      or (entry_type = 'ticketed' and status = 'awaiting_payment' and payment_status = 'unpaid')
    )
  );

-- Erase also works on listings that never paid (but never on a paid one
-- still waiting for payment bookkeeping).
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
    delete from events
     where id = p_id
       and (
         status in ('approved', 'removed', 'rejected')
         or (status = 'awaiting_payment' and payment_status in ('unpaid', 'failed', 'expired'))
       );
  else
    update events
       set status = 'removed', is_featured = false, poster_path = null
     where id = p_id and status = 'approved';
  end if;

  if not found then
    raise exception 'Event % can''t be removed from its current state', p_id;
  end if;
end;
$$;

revoke all on function admin_remove_event(text, boolean) from public;
grant execute on function admin_remove_event(text, boolean) to authenticated;
