-- ── Events — listing, payment, admin review, public read (supabase/events.sql)
--
-- Run AFTER: waypoint_submissions.sql (is_admin()), promotions.sql
-- (bachs_webhook_events). Safe to run more than once.
--
-- Flow (mirrors promotions, see docs/payments.md):
--   /event form (src/features/events/submitEvent.js) inserts a row.
--     Free     -> status 'pending_review', payment_status 'not_required'.
--     Ticketed -> status 'awaiting_payment', payment_status 'unpaid'; the
--                 create-event-checkout Edge Function sets listing_fee
--                 server-side and opens a BACHS checkout; bachs-webhook marks
--                 it 'paid' + 'pending_review'.
--   An admin approves or rejects it in the admin Events tab (RPCs below).
--   Approved events show in Explore -> Events (public_events()) until the
--   end of the event day, Lagos time.
--
-- Same split as promotions: no client UPDATE policy at all, because the
-- payment columns share the row with the review columns. Every write past
-- the insert is the service role (Edge Functions) or a SECURITY DEFINER RPC.

create table if not exists events (
  -- Client-generated uuid (crypto.randomUUID()), like promotions.id: it is
  -- sent to BACHS before any read-back.
  id text primary key,
  submitted_by uuid not null references auth.users(id),

  -- ── What people see on the card ─────────────────────────────────────
  title text not null check (char_length(btrim(title)) between 1 and 120),
  organiser text not null check (char_length(btrim(organiser)) between 1 and 120),
  about text check (about is null or char_length(about) <= 1000),
  poster_path text, -- place-images bucket, event/<id>/...
  starts_at timestamptz not null,
  ends_at timestamptz,

  -- ── Entry ───────────────────────────────────────────────────────────
  entry_type text not null check (entry_type in ('free', 'ticketed')),
  -- What attendees pay (naira, major units). Display only; this app never
  -- sells tickets.
  ticket_price numeric(12, 2),
  ticket_note text check (ticket_note is null or char_length(ticket_note) <= 80),
  check (
    (entry_type = 'free' and ticket_price is null)
    or (entry_type = 'ticketed' and ticket_price > 0)
  ),

  -- ── Where ───────────────────────────────────────────────────────────
  location_type text not null check (location_type in ('venue', 'online')),
  venue_name text,
  venue_lat double precision,
  venue_lng double precision,
  -- Set when the venue was picked from the map's own places.
  venue_waypoint_id text references waypoints(id) on delete set null,
  online_platform text check (online_platform in ('whatsapp', 'meet', 'telegram', 'other')),
  online_link text, -- full URL, built by submitEvent.js
  check (
    (location_type = 'venue' and venue_name is not null and venue_lat is not null and venue_lng is not null
       and online_link is null)
    or (location_type = 'online' and online_link is not null and venue_lat is null and venue_lng is null)
  ),

  -- ── Listing fee (what the organiser pays us) ──────────────────────────
  -- 0 for free events. For ticketed ones create-event-checkout overwrites
  -- whatever the client inserted with EVENT_LISTING_FEE, and bachs-webhook
  -- checks the collected amount against this column.
  listing_fee numeric(12, 2) not null default 0 check (listing_fee >= 0),
  currency text not null default 'NGN',

  -- ── Review ──────────────────────────────────────────────────────────
  status text not null
    check (status in ('awaiting_payment', 'pending_review', 'approved', 'rejected', 'removed')),
  rejection_reason text,
  is_featured boolean not null default false, -- Explore's "Featured events" rail
  reviewed_at timestamptz,

  -- ── Payment (service role only) ─────────────────────────────────────
  payment_status text not null
    check (payment_status in ('not_required', 'unpaid', 'paid', 'failed', 'expired')),
  bachs_checkout_id text,
  bachs_checkout_url text,
  bachs_payment_id text,
  paid_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists events_submitted_by_idx on events(submitted_by);
create index if not exists events_review_idx on events(status) where status = 'pending_review';
create index if not exists events_live_idx on events(starts_at) where status = 'approved';

-- ── RLS ───────────────────────────────────────────────────────────────
alter table events enable row level security;

-- A signed-in user creates their own event, pinned to its only legal
-- starting state: free -> waiting for review (nothing to pay), ticketed ->
-- waiting for payment. Review/payment columns can't be pre-filled.
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
    and bachs_payment_id is null
    and (
      (entry_type = 'free' and status = 'pending_review' and payment_status = 'not_required' and listing_fee = 0)
      or (entry_type = 'ticketed' and status = 'awaiting_payment' and payment_status = 'unpaid')
    )
  );

-- Owners see their own (the payment callback page polls it); admins see all.
drop policy if exists events_select_own_or_admin on events;
create policy events_select_own_or_admin
  on events for select
  to authenticated
  using (submitted_by = auth.uid() or is_admin(auth.uid()));

-- ── Public read: Explore -> Events ─────────────────────────────────────
-- Only approved events, only the columns a card needs (no submitter id, no
-- payment fields), and only until the end of the event day in Lagos.
create or replace function public_events()
returns table (
  id text,
  title text,
  organiser text,
  about text,
  poster_path text,
  starts_at timestamptz,
  ends_at timestamptz,
  entry_type text,
  ticket_price numeric,
  ticket_note text,
  location_type text,
  venue_name text,
  venue_lat double precision,
  venue_lng double precision,
  online_platform text,
  online_link text,
  is_featured boolean
)
language sql
stable
security definer
set search_path = public
as $$
  select e.id, e.title, e.organiser, e.about, e.poster_path, e.starts_at, e.ends_at,
         e.entry_type, e.ticket_price, e.ticket_note, e.location_type, e.venue_name,
         e.venue_lat, e.venue_lng, e.online_platform, e.online_link, e.is_featured
    from events e
   where e.status = 'approved'
     and (e.starts_at at time zone 'Africa/Lagos')::date >= (now() at time zone 'Africa/Lagos')::date
   order by e.starts_at
   limit 200;
$$;

revoke all on function public_events() from public;
grant execute on function public_events() to anon, authenticated;

-- ── Admin review ──────────────────────────────────────────────────────
-- Only on a row that needs no payment or is already paid.
create or replace function admin_approve_event(p_id text, p_featured boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Not authorised';
  end if;

  update events
     set status = 'approved',
         rejection_reason = null,
         is_featured = coalesce(p_featured, false),
         reviewed_at = now()
   where id = p_id
     and status = 'pending_review'
     and payment_status in ('not_required', 'paid');

  if not found then
    raise exception 'Event % is not waiting for review', p_id;
  end if;
end;
$$;

create or replace function admin_reject_event(p_id text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Not authorised';
  end if;

  update events
     set status = 'rejected',
         rejection_reason = nullif(btrim(p_reason), ''),
         is_featured = false,
         reviewed_at = now()
   where id = p_id
     and status = 'pending_review'
     and payment_status in ('not_required', 'paid');

  if not found then
    raise exception 'Event % is not waiting for review', p_id;
  end if;
end;
$$;

create or replace function admin_set_event_featured(p_id text, p_featured boolean)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Not authorised';
  end if;

  update events set is_featured = coalesce(p_featured, false)
   where id = p_id and status = 'approved';

  if not found then
    raise exception 'Event % is not approved', p_id;
  end if;
end;
$$;

-- Takes a live event down. p_erase = true also deletes the record. The
-- poster FILE is deleted from Storage by the app afterwards (adminSave.js
-- removeEvent); a database function can't reach Storage.
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
    delete from events where id = p_id and status in ('approved', 'removed', 'rejected');
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

revoke all on function admin_approve_event(text, boolean) from public;
revoke all on function admin_reject_event(text, text) from public;
revoke all on function admin_set_event_featured(text, boolean) from public;
revoke all on function admin_remove_event(text, boolean) from public;
grant execute on function admin_approve_event(text, boolean) to authenticated;
grant execute on function admin_reject_event(text, text) to authenticated;
grant execute on function admin_set_event_featured(text, boolean) to authenticated;
grant execute on function admin_remove_event(text, boolean) to authenticated;

-- ── Storage: let signed-in users upload posters under event/ ───────────
-- Replaces the live users_insert_place_images policy (which allowed
-- promotion/ and waypoint/) with the same rule plus event/.
drop policy if exists users_insert_place_images on storage.objects;
create policy users_insert_place_images
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'place-images'
    and (storage.foldername(name))[1] = any (array['promotion', 'waypoint', 'event'])
  );
