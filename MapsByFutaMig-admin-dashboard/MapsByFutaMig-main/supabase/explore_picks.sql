-- ── Explore Picks config table ────────────────────────────────────────────
--
-- Backs the new "Explore" tab in the admin panel (ExploreTab.jsx) and the
-- Explore popup (src/features/explore/) reached from the mobile navbar's
-- "Explore" tab and the desktop sidebar's new Explore rail button.
--
-- Same schema style/precedent as quick_chips.sql: this table is a thin
-- CURATION layer, not a second place database. It never stores a name,
-- image, or location of its own — every row points at an existing
-- `waypoints.id` and the app joins in that waypoint's real name/type/
-- images/rating client-side (same "one place database" principle
-- CLAUDE.md's non-negotiable rules already establish for waypoints).
-- This is deliberate, per the person's own instruction: admin picks a
-- place by name, nothing new is uploaded.
--
-- Additive/optional, same as quick_chips: until this is run, useExplorePicks()
-- falls back to an auto-generated list (top-rated/most-reviewed waypoints),
-- so the Explore panel is never empty even before an admin curates anything.

create table if not exists explore_picks (
  id            bigint generated always as identity primary key,
  waypoint_id   text not null references waypoints(id) on delete cascade,
  tags          text[] not null default '{}',   -- short labels shown on the card, e.g. {'Quick bite','Open late'}

  -- ── Promotion / "ad" fields ──────────────────────────────────────────
  -- `is_promoted` is the only thing that puts a "Promoted"/"Ad" badge on
  -- a card — never inferred from anything else. When false, this row is
  -- indistinguishable from an organic pick besides its `priority`.
  is_promoted   boolean not null default false,
  sponsor_name  text,                             -- e.g. 'Chicken Republic' — shown only if is_promoted
  promo_label   text not null default 'Promoted',  -- lets an admin say "Ad" / "Sponsored" / "New" instead

  -- ── Rotation / scheduling ────────────────────────────────────────────
  priority      integer not null default 0,        -- higher = shown first / more often in the rotation
  sort_order    integer not null default 0,         -- manual ordering within the full "View All" list
  active        boolean not null default true,       -- soft on/off switch, no need to delete to hide
  active_from   timestamptz,                          -- optional promo scheduling window (both nullable = always active)
  active_until  timestamptz,

  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists explore_picks_waypoint_id_idx on explore_picks (waypoint_id);
create index if not exists explore_picks_active_idx on explore_picks (active) where active = true;

-- One admin entry per place — re-adding the same waypoint edits the
-- existing row instead of creating a silent duplicate in the rotation.
create unique index if not exists explore_picks_waypoint_unique on explore_picks (waypoint_id);

-- Keep updated_at current on every edit — same trigger pattern as
-- quick_chips_set_updated_at (quick_chips.sql), duplicated here rather
-- than shared since Postgres triggers are per-table.
create or replace function explore_picks_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists explore_picks_touch on explore_picks;
create trigger explore_picks_touch
  before update on explore_picks
  for each row execute function explore_picks_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Same shape as quick_chips.sql: public read (every visitor's Explore
-- panel reads this table), writes restricted to authenticated admins.
-- `is_admin(auth.uid())` (Slice 13) is the real security boundary — the
-- client-side admin PIN is only a UI gate.
alter table explore_picks enable row level security;

drop policy if exists "explore_picks_public_read" on explore_picks;
create policy "explore_picks_public_read" on explore_picks
  for select
  to anon, authenticated
  using (true);

drop policy if exists "explore_picks_admin_write" on explore_picks;
create policy "explore_picks_admin_write" on explore_picks
  for all
  to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));
