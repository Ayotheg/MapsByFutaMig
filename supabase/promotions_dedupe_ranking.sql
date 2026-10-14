-- ── Promote — no duplicate listings + Explore ranking (supabase/promotions_dedupe_ranking.sql)
--
-- Run AFTER promotions.sql, promotions_admin.sql and promotions_hardening.sql.
-- Safe to run more than once. Replaces admin_approve_promotion,
-- admin_remove_promotion, expire_promotions and the promotions delete
-- trigger function from promotions_admin.sql (same names and signatures, so
-- the app's calls and grants are unchanged).
--
-- WHAT CHANGES
-- 1. Physical Shop, no more duplicate pins.
--    Approving used to INSERT a new waypoint every time, even when the
--    business owner had picked their existing place with "Search on Map" on
--    the promote page, so the same shop showed twice on the map. Approve now
--    promotes an existing pin instead of adding one, if either:
--      a) the person picked that place on the promote page
--         (promotions.existing_waypoint_id), or
--      b) the same person promoted a business with the same name before;
--         its pin is reused.
--    A reused pin is never deleted by Remove / Delete / expiry. Those only
--    take its Promoted badge off and put its Explore state back to what it
--    was before the ad.
-- 2. Online Store: a repeat ad replaces the old one.
--    Approving an Online Store first takes down the same person's earlier
--    approved Online Store listing(s) with the same name or the same contact
--    link. They move to the "Removed" filter with the note "Replaced by a
--    newer promotion"; their photo files stay until you press Delete there.
-- 3. Explore ranking. The promoted waypoint now carries promo_days and
--    promo_paid_at. The app (useExplorePicks.js comparePicks) puts paid ads
--    first: most days first, and on equal days whoever PAID first (payment
--    time, not approval time).
--    promo_paid_at also marks a business as a paid ad, which keeps paid
--    Online Stores out of the search bar (useSearchIndex.js); businesses an
--    admin adds by hand ("+ Add Business") stay searchable.
--
-- Only matches promotions from the SAME account (submitted_by), so nobody
-- can take down or take over someone else's listing by reusing its name.

alter table promotions add column if not exists existing_waypoint_id text;
alter table promotions add column if not exists reused_waypoint boolean not null default false;
alter table promotions add column if not exists restore_is_explore boolean not null default false;
alter table waypoints add column if not exists promo_days integer;
alter table waypoints add column if not exists promo_paid_at timestamptz;

-- The picked place can be deleted later; the promotion just forgets it.
do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'promotions_existing_waypoint_id_fkey'
  ) then
    alter table promotions add constraint promotions_existing_waypoint_id_fkey
      foreign key (existing_waypoint_id) references waypoints(id) on delete set null;
  end if;
end $$;

-- Backfill the ranking fields for listings that are already live.
update waypoints w
   set promo_days = p.days,
       promo_paid_at = p.paid_at
  from (
    select distinct on (waypoint_id) waypoint_id, days, paid_at
      from promotions
     where status = 'approved' and waypoint_id is not null
     order by waypoint_id, paid_at desc nulls last
  ) p
 where w.id = p.waypoint_id;

-- ── Shared: take one promotion's ad off its waypoint ─────────────────────
-- Called with the promotion row AFTER its own waypoint_id link is cleared
-- (or after the row is deleted), so "other promotions" never counts itself.
--   - another live promotion still uses the pin -> leave it featured
--   - the pin was created by this promotion, nothing else points at it,
--     and p_may_delete -> delete it (waypoint_images cascade)
--   - otherwise -> un-feature it, and drop the photo rows this promotion
--     copied onto it (their files are deleted by the app)
create or replace function promotion_release_waypoint(
  p_promo_id text,
  p_waypoint_id text,
  p_reused boolean,
  p_restore_is_explore boolean,
  p_may_delete boolean
)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if p_waypoint_id is null then
    return;
  end if;

  if exists (
    select 1 from promotions o
     where o.waypoint_id = p_waypoint_id
       and o.id <> p_promo_id
       and o.status = 'approved'
       and o.promo_ends_at > now()
  ) then
    return;
  end if;

  if p_may_delete
     and not p_reused
     and not exists (select 1 from promotions o where o.waypoint_id = p_waypoint_id and o.id <> p_promo_id) then
    delete from waypoints where id = p_waypoint_id;
    return;
  end if;

  update waypoints
     set is_promoted = false,
         is_explore = coalesce(p_restore_is_explore, false)
   where id = p_waypoint_id;

  delete from waypoint_images
   where waypoint_id = p_waypoint_id
     and starts_with(storage_path, 'promotion/' || p_promo_id || '/');
end;
$$;

revoke all on function promotion_release_waypoint(text, text, boolean, boolean, boolean) from public;

-- ── Approve ──────────────────────────────────────────────────────────────
create or replace function admin_approve_promotion(p_id text)
returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  promo promotions%rowtype;
  target_id text;
  target_is_explore boolean := false;
  target_is_promoted boolean := false;
  reused boolean := false;
  next_pos integer := 0;
  old_promo promotions%rowtype;
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
    -- a) the place picked with "Search on Map"
    if promo.existing_waypoint_id is not null then
      select w.id into target_id
        from waypoints w
       where w.id = promo.existing_waypoint_id
         and w.status = 'approved'
         and w.lat is not null and w.lng is not null
         and not coalesce(w.is_person, false)
         and not coalesce(w.is_channel, false)
         and not coalesce(w.is_business, false);
    end if;

    -- b) the pin this person's earlier ad for the same business created
    if target_id is null then
      select p.waypoint_id into target_id
        from promotions p
        join waypoints w on w.id = p.waypoint_id
       where p.submitted_by = promo.submitted_by
         and p.id <> promo.id
         and p.listing_type = 'physical'
         and p.status = 'approved'
         and w.status = 'approved'
         and lower(btrim(p.business_name)) = lower(btrim(promo.business_name))
       order by p.paid_at desc nulls last
       limit 1;
    end if;
  else
    -- Online Store: the new ad replaces this person's earlier one(s).
    for old_promo in
      select * from promotions o
       where o.submitted_by = promo.submitted_by
         and o.id <> promo.id
         and o.listing_type = 'online'
         and o.status = 'approved'
         and (
           lower(btrim(o.business_name)) = lower(btrim(promo.business_name))
           or o.contact_link = promo.contact_link
         )
       for update
    loop
      update promotions
         set waypoint_id = null,
             status = 'removed',
             rejection_reason = 'Replaced by a newer promotion',
             promo_ends_at = least(coalesce(old_promo.promo_ends_at, now()), now())
       where id = old_promo.id;
      perform promotion_release_waypoint(
        old_promo.id, old_promo.waypoint_id, old_promo.reused_waypoint,
        old_promo.restore_is_explore, true
      );
    end loop;
  end if;

  if target_id is not null then
    select coalesce(is_explore, false), coalesce(is_promoted, false)
      into target_is_explore, target_is_promoted
      from waypoints where id = target_id for update;
    reused := true;

    update waypoints
       set is_explore = true,
           is_promoted = true,
           sponsor_name = promo.business_name,
           promo_label = 'Promoted',
           promo_days = promo.days,
           promo_paid_at = promo.paid_at
     where id = target_id;
  else
    target_id := gen_random_uuid()::text;
    if promo.listing_type = 'physical' then
      insert into waypoints (
        id, name, description, lat, lng, type, source_type, status, saved_at,
        submitted_by, is_explore, explore_priority, is_promoted, sponsor_name, promo_label,
        promo_days, promo_paid_at
      ) values (
        target_id, promo.business_name, promo.description, promo.lat, promo.lng,
        'shop', 'gps_annotation', 'approved', now(),
        promo.submitted_by, true, 1, true, promo.business_name, 'Promoted',
        promo.days, promo.paid_at
      );
    else
      insert into waypoints (
        id, name, description, lat, lng, source_type, status, saved_at,
        submitted_by, is_business, business_link, business_platform,
        is_explore, explore_priority, is_promoted, sponsor_name, promo_label,
        promo_days, promo_paid_at
      ) values (
        target_id, promo.business_name, promo.description, null, null,
        'gps_annotation', 'approved', now(),
        promo.submitted_by, true, promo.contact_link, promo.contact_platform,
        true, 1, true, promo.business_name, 'Promoted',
        promo.days, promo.paid_at
      );
    end if;
  end if;

  -- On a reused pin the ad's photos go after the ones it already has.
  select coalesce(max(position) + 1, 0) into next_pos
    from waypoint_images where waypoint_id = target_id;
  insert into waypoint_images (waypoint_id, storage_path, position)
  select target_id, storage_path, next_pos + position
    from promotion_images
   where promotion_id = promo.id
   order by position;

  update promotions
     set status = 'approved',
         rejection_reason = null,
         waypoint_id = target_id,
         reused_waypoint = reused,
         -- Only an organic Explore feature is put back when the ad ends;
         -- an earlier ad's Promoted state is not.
         restore_is_explore = (target_is_explore and not target_is_promoted),
         promo_ends_at = now() + make_interval(days => promo.days)
   where id = promo.id;

  return target_id;
end;
$$;

-- ── Expiry ───────────────────────────────────────────────────────────────
create or replace function expire_promotions()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  n integer := 0;
  r promotions%rowtype;
  biz boolean;
begin
  -- admins from the app, or no JWT at all (pg_cron / service role)
  if auth.uid() is not null and not is_admin(auth.uid()) then
    raise exception 'Not authorised';
  end if;

  for r in
    select p.* from promotions p
      join waypoints w on w.id = p.waypoint_id
     where p.status = 'approved'
       and p.promo_ends_at is not null
       and p.promo_ends_at <= now()
       and w.is_promoted
  loop
    -- Another live ad on the same pin keeps it featured.
    continue when exists (
      select 1 from promotions o
       where o.waypoint_id = r.waypoint_id and o.id <> r.id
         and o.status = 'approved' and o.promo_ends_at > now()
    );

    update waypoints
       set is_promoted = false,
           is_explore = coalesce(r.restore_is_explore, false)
     where id = r.waypoint_id
    returning coalesce(is_business, false) into biz;

    -- An Online Store has no value outside the promotion: hide it.
    if biz then
      update waypoints
         set status = 'rejected', rejection_reason = 'Promotion ended'
       where id = r.waypoint_id;
    end if;
    n := n + 1;
  end loop;

  return n;
end;
$$;

-- ── Remove / Delete from the admin panel ─────────────────────────────────
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

  update promotions set waypoint_id = null where id = promo.id;
  perform promotion_release_waypoint(
    promo.id, promo.waypoint_id, promo.reused_waypoint, promo.restore_is_explore, true
  );

  if p_erase then
    delete from promotions where id = promo.id;
  else
    delete from promotion_images where promotion_id = promo.id;
    update promotions
       set status = 'removed',
           promo_ends_at = least(coalesce(promo_ends_at, now()), now())
     where id = promo.id;
  end if;
end;
$$;

-- ── Dashboard delete safety net (trigger from promotions_admin.sql) ──────
create or replace function promotions_delete_published_waypoint()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  perform promotion_release_waypoint(
    old.id, old.waypoint_id, old.reused_waypoint, old.restore_is_explore, true
  );
  return old;
end;
$$;

revoke all on function admin_approve_promotion(text) from public;
revoke all on function admin_remove_promotion(text, boolean) from public;
revoke all on function expire_promotions() from public;
grant execute on function admin_approve_promotion(text) to authenticated;
grant execute on function admin_remove_promotion(text, boolean) to authenticated;
grant execute on function expire_promotions() to authenticated;
