-- ── Promote — tighten what a student can insert (supabase/promotions_hardening.sql)
--
-- Run AFTER promotions.sql and promotions_admin.sql. Safe to run more than once.
--
-- WHY
-- promotions_insert_own only pinned status/payment_status, so a signed-in
-- user could insert their own draft with any other column pre-filled:
--   - waypoint_id = an existing campus waypoint. Deleting that draft later
--     (e.g. clearing unpaid rows in the dashboard) fires the
--     promotions_delete_waypoint trigger, which deletes the REAL waypoint.
--   - bachs_payment_id / paid_at / promo_ends_at / rejection_reason, which
--     only the webhook or admin functions should ever set.
-- promotion_images_insert_own didn't check storage_path, so a user could
-- point a row at another listing's photo file. When an admin later removes
-- that promotion, adminSave.js removePromotion() deletes those files from
-- Storage — breaking the other listing's photos.

drop policy if exists promotions_insert_own on promotions;
create policy promotions_insert_own
  on promotions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'awaiting_payment'
    and payment_status = 'unpaid'
    and waypoint_id is null
    and bachs_checkout_id is null
    and bachs_checkout_url is null
    and bachs_payment_id is null
    and paid_at is null
    and promo_ends_at is null
    and rejection_reason is null
  );

-- Photos must live under this promotion's own folder — the exact path
-- uploadImage('promotion', promotionId, ...) in adminSave.js produces.
-- starts_with, not LIKE: promotion ids are client-chosen text, and an id
-- containing % or _ would turn a LIKE pattern into a wildcard.
drop policy if exists promotion_images_insert_own on promotion_images;
create policy promotion_images_insert_own
  on promotion_images for insert
  to authenticated
  with check (
    position('/' in promotion_id) = 0
    and position('..' in storage_path) = 0
    and starts_with(storage_path, 'promotion/' || promotion_id || '/')
    and exists (
      select 1 from promotions p
      where p.id = promotion_images.promotion_id
        and p.submitted_by = auth.uid()
    )
  );
