-- ── Promote — payment half (supabase/promotions.sql) ────────────────────
--
-- File-per-feature convention (same as waypoint_submissions.sql,
-- quick_chips.sql, analytics.sql) — not appended to
-- FIREBASE_TO_SUPABASE_MIGRATION.md, which stopped being the live schema
-- doc after Slice 10 per that file's own note.
--
-- Deliberately a NEW table, not a repurposing of `waypoints`:
-- `waypoints.status` ('pending'/'approved'/'rejected', waypoint_submissions.sql)
-- answers "has an admin judged this place." A promotion needs a second,
-- earlier axis — "has BACHS been paid" — that a waypoint never has. Two
-- separate enum-ish columns (`status`, `payment_status`) below keep those
-- questions from being conflated into one. A row only ever becomes a real
-- `waypoints` insert once BOTH are satisfied (payment_status='paid' AND an
-- admin approves) — that admin step and the actual `waypoints`/Explore
-- push are a follow-up slice (PROMOTE_ADMIN_REVIEW.md), not built here.
--
-- ── Run order ─────────────────────────────────────────────────────────
-- 1. This file (table DDL + RLS), via the Supabase SQL editor or CLI
--    migration, same as every other supabase/*.sql file in this repo —
--    none of them are auto-applied, confirmed by grep (no migrations/
--    directory, no CI step references these files).
-- 2. Deploy the two Edge Functions under supabase/functions/ (see
--    PROMOTE_PAYMENT_INTEGRATION.md §4 for the exact CLI commands + the
--    secrets they need — those are NOT set by this SQL file).
-- 3. Create the `promotion-images` Storage bucket if it doesn't already
--    exist as a variant of `place-images` — see the "Storage" note near
--    the bottom of this file. Not yet confirmed live either way.

-- ── promotions ────────────────────────────────────────────────────────
-- `id` is a client-generated text uuid (crypto.randomUUID(), same
-- "no DB default, browser provides it" shape `waypoints.id` already
-- uses per submitWaypoint.js) — chosen deliberately, not just copied,
-- because this exact id is what gets sent to BACHS as `reference` and
-- round-tripped back in the webhook's metadata; generating it before the
-- insert (rather than trusting `.select().single()` after) means the
-- client already has it to pass to create-promotion-checkout without a
-- second round trip.
create table if not exists promotions (
  id text primary key,
  submitted_by uuid not null references auth.users(id),

  -- ── Form fields — every input on PromotePage.jsx ───────────────────
  business_name text not null,
  description text,
  listing_type text not null check (listing_type in ('physical', 'online')),

  -- Physical Shop only. Null for Online Store — enforced by the
  -- check constraint below, not just left to convention.
  lat double precision,
  lng double precision,

  -- Online Store only. `contact_platform` is one of PromotePage.jsx's
  -- CONTACT_PLATFORMS ids ('whatsapp'/'telegram'/'instagram'/'other');
  -- `contact_link` is the fully-built URL/handle (submitPromotion.js's
  -- buildContactLink — e.g. "https://wa.me/2348012345678"), not the raw
  -- digits the person typed, so a reader/admin/card never needs to know
  -- the per-platform prefix rule again.
  contact_platform text,
  contact_link text,

  check (
    (listing_type = 'physical' and lat is not null and lng is not null and contact_link is null)
    or
    (listing_type = 'online' and lat is null and lng is null and contact_link is not null)
  ),

  -- ── Duration / pricing ──────────────────────────────────────────────
  -- `days` * pricing.js's NAIRA_PER_DAY = `amount` — computed and stored
  -- server-side (create-promotion-checkout Edge Function re-derives it
  -- from `days`, never trusts a client-sent `amount`; see that
  -- function's own comment). `amount` is numeric in major units (whole
  -- naira), NOT kobo — matches BACHS's own "never floats or minor units"
  -- convention (their SDK docs are explicit about this), so this column
  -- and every BACHS request/response agree on units without a x100/÷100
  -- conversion anywhere in this codebase.
  days integer not null check (days between 1 and 30),
  amount numeric(12, 2) not null check (amount > 0),
  currency text not null default 'NGN',

  -- ── Review queue status (admin's job, next slice — column exists now
  -- so this migration doesn't need a second alter table later) ────────
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'pending_review', 'approved', 'rejected')),
  rejection_reason text,
  -- Set once an admin approves a Physical Shop and pushes it onto the
  -- map — the Explore/waypoints join point PROMOTE_ADMIN_REVIEW.md will
  -- define. Null for every Online Store (never gets a pin) and for any
  -- row not yet approved.
  waypoint_id text references waypoints(id),

  -- ── Payment status — the ONLY thing this file's Edge Functions are
  -- trusted to write, and only via the service-role key, never the
  -- client's anon key. See the RLS policies below: there is no UPDATE
  -- policy granted to `authenticated` at all on this table.
  payment_status text not null default 'unpaid'
    check (payment_status in ('unpaid', 'paid', 'failed', 'expired')),
  bachs_checkout_id text,
  bachs_checkout_url text,
  bachs_payment_id text,
  paid_at timestamptz,

  created_at timestamptz not null default now()
);

create index if not exists promotions_submitted_by_idx on promotions(submitted_by);
create index if not exists promotions_status_idx on promotions(status) where status = 'pending_review';
create index if not exists promotions_payment_status_idx on promotions(payment_status) where payment_status = 'unpaid';

-- ── promotion_images ─────────────────────────────────────────────────
-- Same row-per-image normalization as waypoint_images/segment_images
-- (Slice 2/4/5's established pattern) — uploaded via adminSave.js's
-- shared uploadImage()/insertImageRows() helpers (submitPromotion.js
-- reuses them exactly like submitWaypoint.js does), not a new upload
-- path.
create table if not exists promotion_images (
  id bigint generated always as identity primary key,
  promotion_id text not null references promotions(id) on delete cascade,
  storage_path text not null,
  position integer not null default 0
);

create index if not exists promotion_images_promotion_id_idx on promotion_images(promotion_id);

-- ── bachs_webhook_events — idempotency guard ────────────────────────
-- BACHS's own docs say webhooks are delivered "at least once" — the
-- same event.id can arrive twice (retry after a slow 200, a duplicate
-- send, etc.). Without this table, a duplicate `collection.succeeded`
-- delivery is harmless (the webhook's UPDATE is itself idempotent,
-- guarded by `where payment_status = 'unpaid'`) but a duplicate
-- `collection.failed` arriving AFTER a `collection.succeeded` already
-- landed would incorrectly flip a paid promotion back to failed. This
-- table makes every event processed exactly once, not just "probably
-- fine": bachs-webhook/index.ts inserts the event id first and only
-- proceeds if that insert succeeded (a conflict means "already handled,
-- return 200 and stop").
create table if not exists bachs_webhook_events (
  id text primary key, -- BACHS event id, e.g. "evt_..."
  type text not null,
  received_at timestamptz not null default now()
);

-- ── RLS ───────────────────────────────────────────────────────────────
alter table promotions enable row level security;
alter table promotion_images enable row level security;
alter table bachs_webhook_events enable row level security;

-- A signed-in student can create their own draft promotion — status and
-- payment_status are pinned to their only legal starting values by the
-- WITH CHECK clause, so even a hand-crafted client request can't insert
-- a pre-approved or pre-paid row. This is the real enforcement
-- submitPromotion.js's own header comment already flags its client-side
-- checks as not being a substitute for.
create policy promotions_insert_own
  on promotions for insert
  to authenticated
  with check (
    submitted_by = auth.uid()
    and status = 'awaiting_payment'
    and payment_status = 'unpaid'
  );

-- A person can read their own promotions (any status/payment_status —
-- PromoteCallbackPage.jsx's poll needs to see 'paid'/'failed' land).
-- Admins can read every row (the not-yet-built review tab's job).
-- Reuses waypoint_submissions.sql's `is_admin(uid)` security-definer
-- function rather than inventing a second admin check.
create policy promotions_select_own_or_admin
  on promotions for select
  to authenticated
  using (submitted_by = auth.uid() or is_admin(auth.uid()));

-- Deliberately NO update/delete policy for `authenticated` on
-- `promotions`. Every legitimate write past the initial insert —
-- attaching a BACHS checkout id/url, flipping payment_status to
-- 'paid'/'failed' from the webhook, an admin's approve/reject — goes
-- through an Edge Function using the service-role key, which bypasses
-- RLS entirely and doesn't need a policy here. If a future admin-panel
-- slice wants the *client* to call approve/reject directly (mirroring
-- adminSave.js's approveWaypoint/rejectWaypoint pattern) rather than
-- through an Edge Function, it should add an explicit
-- `to authenticated using (is_admin(auth.uid()))` policy then — not
-- assumed or pre-added here, since payment-touching columns living on
-- the same row make a broad admin UPDATE policy riskier than
-- waypoints' equivalent (an admin policy scoped to columns Postgres RLS
-- can't actually restrict by column — needs a view or a separate table
-- split if that's the direction chosen, a real design decision for that
-- slice, not a guess here).

-- Images: insert scoped through the owning promotion (same
-- exists-and-is-mine check waypoint_images doesn't need — that table
-- has no images RLS documented in this repo either, but promotion
-- photos are collected pre-payment, so scoping matters more here: a
-- signed-in stranger shouldn't be able to attach images to someone
-- else's draft promotion). Select mirrors promotions' own select policy.
create policy promotion_images_insert_own
  on promotion_images for insert
  to authenticated
  with check (
    exists (
      select 1 from promotions p
      where p.id = promotion_images.promotion_id
        and p.submitted_by = auth.uid()
    )
  );

create policy promotion_images_select_own_or_admin
  on promotion_images for select
  to authenticated
  using (
    exists (
      select 1 from promotions p
      where p.id = promotion_images.promotion_id
        and (p.submitted_by = auth.uid() or is_admin(auth.uid()))
    )
  );

-- bachs_webhook_events: service-role only, by omission — no policy
-- grants `authenticated` or `anon` anything here, and the webhook
-- function uses the service-role key (bypasses RLS) exclusively. A
-- table with RLS enabled and zero policies denies all access to every
-- non-service-role caller, which is the intent, not an oversight.

-- ── Storage — NOT set up by this file, flagged not guessed ──────────
-- uploadImage('promotion', promotionId, file, position) (adminSave.js)
-- uploads into the existing `place-images` bucket under a
-- `promotion/<id>/...` prefix — reusing the bucket submitWaypoint.js
-- already uses for 'waypoint', rather than provisioning a second
-- bucket, since nothing about promotion photos needs different
-- public/private semantics from waypoint photos (both end up public
-- once approved). Confirm the `place-images` bucket's existing Storage
-- policies allow an authenticated, non-admin insert under a
-- `promotion/` prefix — the same "not yet confirmed live" flag
-- adminSave.js's own header comment already carries for waypoint/
-- segment image uploads, now extended to this prefix too.

-- ── Not yet run against a live database ──────────────────────────────
-- Same status every other schema file in this repo starts at. Before
-- trusting this live: run it in the SQL editor, then as a real non-admin
-- authenticated client, confirm (a) an insert with someone else's
-- submitted_by is rejected, (b) a direct client update() attempt (e.g.
-- trying to set payment_status='paid' from the browser console) comes
-- back as either a permission error or an accepted-but-0-rows response
-- (PostgREST's RLS-blocked-write behavior — see adminSave.js's own
-- blockedWriteError() comment for why that distinction matters), and
-- (c) the is_admin(auth.uid()) reuse from waypoint_submissions.sql
-- actually resolves for an admin account in this project.
