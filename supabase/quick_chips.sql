-- ── Quick Chips config table ──────────────────────────────────────────────
--
-- Backs the new "Chips" tab in the admin panel (QuickChipsTab.jsx). Run
-- this once in the Supabase SQL editor. Until it's run, the app falls
-- back to the 16 built-in default chips (features/search/chipConfig.js
-- DEFAULT_CHIPS) with no error — this table is additive, not required
-- for the app to keep working.
--
-- Same schema style as waypoints/segments in FIREBASE_TO_SUPABASE_
-- MIGRATION.md: `id` is a stable text slug (not a Firestore doc id here
-- since chips never existed in Firestore — 'toilet', 'hostel', or a
-- generated slug for admin-added custom chips), `keywords`/`pinned_ids`/
-- `excluded_ids` are plain text arrays (waypoints.id is `text`, so
-- pinned/excluded reference it directly, no join table needed for a
-- handful of ids per chip).

create table if not exists quick_chips (
  id            text primary key,             -- stable slug, e.g. 'hostel'
  label         text not null,
  emoji         text,
  icon_key      text,                          -- lib/legacyIconMap.js key, or null for emoji-only
  keywords      text[] not null default '{}',  -- substrings matched against name+type
  pinned_ids    text[] not null default '{}',  -- waypoints.id — force-included
  excluded_ids  text[] not null default '{}',  -- waypoints.id — force-excluded even on keyword match
  sort_order    integer not null default 0,    -- display order in the chip bar
  is_custom     boolean not null default true, -- false only for the 16 seeded defaults below
  updated_at    timestamptz not null default now()
);

-- Keep updated_at current on every edit.
create or replace function quick_chips_set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists quick_chips_touch on quick_chips;
create trigger quick_chips_touch
  before update on quick_chips
  for each row execute function quick_chips_set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────────────────
-- Same unverified-exposure note as adminSave.js: this client uses the
-- anon key, and the admin PIN gate is a UI convenience only. Read access
-- needs to be public (every visitor's Quick Chips bar reads this table);
-- writes are restricted to authenticated users whose profile is marked as
-- an admin. The client-side PIN is only a UI gate; `is_admin(auth.uid())`
-- is the database security boundary. Run waypoint_submissions.sql first
-- if that function has not been created yet.
alter table quick_chips enable row level security;

drop policy if exists "quick_chips_public_read" on quick_chips;
create policy "quick_chips_public_read" on quick_chips
  for select using (true);

drop policy if exists "quick_chips_public_write" on quick_chips;
drop policy if exists "quick_chips_admin_insert" on quick_chips;
create policy "quick_chips_admin_insert" on quick_chips
  for insert to authenticated
  with check (is_admin(auth.uid()));

drop policy if exists "quick_chips_admin_update" on quick_chips;
create policy "quick_chips_admin_update" on quick_chips
  for update to authenticated
  using (is_admin(auth.uid()))
  with check (is_admin(auth.uid()));

drop policy if exists "quick_chips_admin_delete" on quick_chips;
create policy "quick_chips_admin_delete" on quick_chips
  for delete to authenticated
  using (is_admin(auth.uid()));

-- ── Seed the 16 default chips ───────────────────────────────────────────
-- Matches features/shared/placeCategories.js's CHIP_DISPLAY_ORDER/
-- CATEGORY_KEYWORDS exactly. Safe to re-run (upsert on id).
insert into quick_chips (id, label, emoji, icon_key, keywords, sort_order, is_custom) values
  ('toilet',        'Toilet',            '🚻', 'toilet',           array['toilet','restroom'], 0, false),
  ('hostel',        'Hostel / Lodges',   '🏠', 'house-door-fill',  array['hostel','lodges','lodge','hall of residence','off campus lodge'], 1, false),
  ('printing_shop', 'Printing',          '🖨️', 'printer-fill',    array['printing','printing press','printing shop','print shop','print press'], 2, false),
  ('garage',        'Garage',            '🔧', 'bus-front-fill',  array['garage'], 3, false),
  ('library',       'Library',           '📚', 'building-fill',   array['library','bookshop','book shop'], 4, false),
  ('kiosk',         'Kiosk',             '🛒', 'shop',             array['kiosk','shopping','spot','futa bread','shopping complex'], 5, false),
  ('bank',          'POS / ATM',         '💳', 'bank2',            array['bank','pos','atm','cooperative','cooperatives','finance'], 6, false),
  ('chapel',        'Church',            '⛪', 'church',           array['fellowship','church','place of worship','church of god','campus fellowship','postgraduate fellowship','chapel'], 7, false),
  ('bus_stop',      'Bus Stop',          '🚌', 'bus-front-fill',  array['bus station','bus stop','bus park','shuttle bus station','shuttle bus'], 8, false),
  ('gate',          'Gates / Entrance',  '🚧', null,               array['gate','entrance'], 9, false),
  ('clinic',        'Clinic',            '🏥', 'hospital-fill',   array['clinic','hospital','health center','health centre','pharmacy'], 10, false),
  ('restaurant',    'Canteen',           '🍽️', 'restaurant-fill', array['restaurant','eatery','canteen'], 11, false),
  ('mosque',        'Mosque',            '🕌', 'mosque',           array['mosque'], 12, false),
  ('sports',        'Sports',            '⚽', 'football',         array['gym','gym center','gym centre','pitch','sport complex','sports complex','sport'], 13, false),
  ('lecture_hall',  'Lecture Halls',     '🎓', 'building-fill',   array['lecture halls','lecture hall','lecture theatre','lecture theater'], 14, false),
  ('faculty',       'Faculty',           '🏫', 'building-fill',   array['faculty'], 15, false)
on conflict (id) do update set
  label = excluded.label,
  emoji = excluded.emoji,
  icon_key = excluded.icon_key,
  keywords = excluded.keywords,
  sort_order = excluded.sort_order;
