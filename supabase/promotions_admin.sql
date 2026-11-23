-- ── Promote — admin review + publish (supabase/promotions_admin.sql) ─────
--
-- Run AFTER: promotions.sql, waypoint_submissions.sql (is_admin()),
-- explore_fields.sql and business_entries.sql (the waypoint columns this
-- publishes into). Safe to run more than once.
--
-- WHY RPCs INSTEAD OF AN UPDATE POLICY
-- promotions.sql deliberately grants `authenticated` no UPDATE policy: the
-- payment columns (payment_status, paid_at, bachs_*) share the row with the
-- review columns, and RLS can't restrict by column. These SECURITY DEFINER
-- functions check is_admin() themselves and only ever touch review columns,
-- and only on a row that is already PAID and in 'pending_review'.
--
-- WHAT "APPROVE" DOES (all in one transaction — if any step fails, nothing
-- is half-published):
--   Physical Shop -> a normal approved `waypoints` row (type 'shop', real
--                    lat/lng) so it gets a map pin, search, and PlaceCard.
--   Online Store  -> an approved `waypoints` row with is_business = true,
--                    business_link/business_platform, no coordinates (the
--                    existing link-out pattern: Explore card -> PlaceCard
--                    with a "Visit <platform>" button).
--   Both          -> featured in Explore with the "Promoted" badge
--                    (is_explore + is_promoted), the promotion's photos
--                    copied onto waypoint_images, the promotion linked to
--                    the waypoint (promotions.waypoint_id), and the paid
--                    duration started (promo_ends_at = now + days).

alter table promotions add column if not exists promo_ends_at timestamptz;

create or replace function admin_approve_promotion(p_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  promo promotions%rowtype;
  new_wp_id text := gen_random_uuid()::text;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Not authorised';
  end if;

  select * into promo from promotions where id = p_id for update;
  if not found
     or promo.status <> 'pending_review'
     or promo.payment_status <> 'paid' then
    raise exception 'Promotion % is not a paid promotion waiting for review', p_id;
  end if;

  if promo.listing_type = 'physical' then
    insert into waypoints (
      id, name, description, lat, lng, type, source_type, status, saved_at,
      submitted_by, is_explore, explore_priority, is_promoted, sponsor_name, promo_label
    ) values (
      new_wp_id, promo.business_name, promo.description, promo.lat, promo.lng,
      'shop', 'gps_annotation', 'approved', now(),
      promo.submitted_by, true, 1, true, promo.business_name, 'Promoted'
    );
  else
    insert into waypoints (
      id, name, description, lat, lng, source_type, status, saved_at,
      submitted_by, is_business, business_link, business_platform,
      is_explore, explore_priority, is_promoted, sponsor_name, promo_label
    ) values (
      new_wp_id, promo.business_name, promo.description, null, null,
      'gps_annotation', 'approved', now(),
      promo.submitted_by, true, promo.contact_link, promo.contact_platform,
      true, 1, true, promo.business_name, 'Promoted'
    );
  end if;

  insert into waypoint_images (waypoint_id, storage_path, position)
  select new_wp_id, storage_path, position
    from promotion_images
   where promotion_id = promo.id
   order by position;

  update promotions
     set status = 'approved',
         rejection_reason = null,
         waypoint_id = new_wp_id,
         promo_ends_at = now() + make_interval(days => promo.days)
   where id = promo.id;

  return new_wp_id;
end;
$$;

create or replace function admin_reject_promotion(p_id text, p_reason text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if not is_admin(auth.uid()) then
    raise exception 'Not authorised';
  end if;

  update promotions
     set status = 'rejected',
         rejection_reason = nullif(btrim(p_reason), '')
   where id = p_id
     and status = 'pending_review'
     and payment_status = 'paid';

  if not found then
    raise exception 'Promotion % is not a paid promotion waiting for review', p_id;
  end if;
end;
$$;

-- ── Expiry: the paid duration actually ends ──────────────────────────────
-- Un-features (no "Promoted" badge, off the Explore list) every approved
-- promotion whose paid days have run out. A physical shop's map pin stays as
-- an ordinary place; an Online Store has no value outside the promotion, so
-- its waypoint is hidden. Idempotent. Called by the admin Promotions tab
-- each time it opens; to run it on a schedule too, enable pg_cron and:
--   select cron.schedule('expire-promotions', '15 * * * *', 'select expire_promotions()');
create or replace function expire_promotions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer;
begin
  -- admins from the app, or no JWT at all (pg_cron / service role)
  if auth.uid() is not null and not is_admin(auth.uid()) then
    raise exception 'Not authorised';
  end if;

  with ended as (
    select waypoint_id
      from promotions
     where status = 'approved'
       and waypoint_id is not null
       and promo_ends_at is not null
       and promo_ends_at <= now()
  ),
  unfeature as (
    update waypoints w
       set is_promoted = false,
           is_explore = false
      from ended e
     where w.id = e.waypoint_id
       and (w.is_promoted or w.is_explore)
    returning w.id, w.is_business
  ),
  hide as (
    update waypoints w
       set status = 'rejected',
           rejection_reason = 'Promotion ended'
      from unfeature u
     where w.id = u.id and u.is_business
    returning w.id
  )
  select count(*) into n from unfeature;

  return n;
end;
$$;

revoke all on function admin_approve_promotion(text) from public;
revoke all on function admin_reject_promotion(text, text) from public;
revoke all on function expire_promotions() from public;
grant execute on function admin_approve_promotion(text) to authenticated;
grant execute on function admin_reject_promotion(text, text) to authenticated;
grant execute on function expire_promotions() to authenticated;

-- ── Taking a live listing down (admin "Remove" / "Delete") ───────────────
-- Why this exists: Approve creates a separate `waypoints` row, and THAT row
-- is what the map and Explore read. Deleting only the `promotions` row in
-- the Supabase dashboard therefore leaves the listing live. Use the admin
-- Promotions → Approved tab instead; it takes down both together.

-- 1) A new review state for a listing an admin took down early.
do $$
declare c record;
begin
  -- Drop whatever the old status check is called, found by its definition.
  for c in
    select conname from pg_constraint
     where conrelid = 'promotions'::regclass and contype = 'c'
       and pg_get_constraintdef(oid) ilike '%awaiting_payment%'
  loop
    execute format('alter table promotions drop constraint %I', c.conname);
  end loop;
end $$;
alter table promotions add constraint promotions_status_check
  check (status in ('awaiting_payment', 'pending_review', 'approved', 'rejected', 'removed'));

-- 2) Deleting a waypoint by hand in the dashboard no longer fails on the
--    promotion that points at it — the promotion just loses its link.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
     where conrelid = 'promotions'::regclass and contype = 'f'
       and confrelid = 'waypoints'::regclass
  loop
    execute format('alter table promotions drop constraint %I', c.conname);
  end loop;
end $$;
alter table promotions add constraint promotions_waypoint_id_fkey
  foreign key (waypoint_id) references waypoints(id) on delete set null;

-- 3) Safety net for the dashboard: deleting a promotion row also deletes the
--    waypoint it published, so a manual delete can never leave a ghost
--    listing in Explore again. (AFTER delete: the FK needs the promotion row
--    gone before its waypoint can go.)
create or replace function promotions_delete_published_waypoint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.waypoint_id is not null then
    delete from waypoints where id = old.waypoint_id;
  end if;
  return old;
end;
$$;

drop trigger if exists promotions_delete_waypoint on promotions;
create trigger promotions_delete_waypoint
  after delete on promotions
  for each row execute function promotions_delete_published_waypoint();

-- 4) The admin action. p_erase = false -> take the listing down but keep the
--    record (status 'removed', shown under the Removed filter). p_erase =
--    true -> also delete the promotion record itself (photo rows cascade;
--    the trigger above is a no-op here because the link is already cleared).
--    Either way the photo FILES are deleted from Storage by the app right
--    after this succeeds (a database function can't reach Storage).
--    Works on a live (approved) promotion, even before its expiry date.
create or replace function admin_remove_promotion(p_id text, p_erase boolean default false)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  promo promotions%rowtype;
begin
  if not is_admin(auth.uid()) then
    raise exception 'Not authorised';
  end if;

  select * into promo from promotions where id = p_id for update;
  if not found or promo.status not in ('approved', 'removed') then
    raise exception 'Promotion % is not an approved or removed promotion', p_id;
  end if;

  -- Clear the link first so the waypoint can be deleted (and nothing can
  -- re-point at it), then delete the live listing. waypoint_images cascade.
  update promotions set waypoint_id = null where id = promo.id;
  if promo.waypoint_id is not null then
    delete from waypoints where id = promo.waypoint_id;
  end if;

  if p_erase then
    delete from promotions where id = promo.id;
  else
    -- The photo FILES are deleted from Storage by the app right after this
    -- (adminSave.js removePromotion); drop the rows that pointed at them so
    -- the kept record doesn't reference files that no longer exist.
    delete from promotion_images where promotion_id = promo.id;
    update promotions
       set status = 'removed',
           promo_ends_at = least(coalesce(promo_ends_at, now()), now())
     where id = promo.id;
  end if;
end;
$$;

revoke all on function admin_remove_promotion(text, boolean) from public;
grant execute on function admin_remove_promotion(text, boolean) to authenticated;

-- Reading is already covered by promotions_select_own_or_admin and
-- promotion_images_select_own_or_admin in promotions.sql (admins see all).
