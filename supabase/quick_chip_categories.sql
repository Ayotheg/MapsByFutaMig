-- ── Quick Chips categories + top bar (Oct 2026 revamp) ───────────────────
--
-- Run once in the Supabase SQL editor, after quick_chips.sql.
--
-- Adds three columns to quick_chips:
--   category     the heading a chip sits under in "All places" (also
--                asked for when an admin creates a chip)
--   bar_order    position in the map's top chip bar; null = only in
--                All places
--   short_label  optional shorter name for the top bar ("Food" for
--                Canteens)
--
-- Then arranges the live chips exactly as the "All places" screen shows
-- them (public/Maps By FUTA — Quick-chips-png.zip): groups, order within
-- each group, and wording. The custom chips below are matched by the ids
-- the admin panel generated for them in this project's database.
--
-- Allowed categories match CHIP_GROUPS in
-- src/features/shared/placeCategories.js.

alter table quick_chips add column if not exists category text;
alter table quick_chips add column if not exists bar_order integer;
alter table quick_chips add column if not exists short_label text;

alter table quick_chips drop constraint if exists quick_chips_category_check;
alter table quick_chips add constraint quick_chips_category_check
  check (category is null or category in
    ('study', 'food', 'essentials', 'hostel_life', 'fix_style', 'faith_fun', 'other'));

-- id, category, All places order, label (as on the screen)
update quick_chips q set
  category   = v.category,
  sort_order = v.sort_order,
  label      = v.label
from (values
  -- Study
  ('lecture_hall',               'study',       0, 'Lecture halls'),
  ('faculty',                    'study',       1, 'Faculties'),
  ('library',                    'study',       2, 'Library'),
  ('printing_shop',              'study',       3, 'Printing'),
  ('viewing_centres_95u91',      'study',       4, 'Viewing centres'),
  -- Food & chops
  ('restaurant',                 'food',        5, 'Canteens'),
  ('kiosk',                      'food',        6, 'Kiosks'),
  ('aboki_s_pepper_stall_1en80', 'food',        7, 'Aboki''s pepper stall'),
  ('beef_mongers_exj07',         'food',        8, 'Beef mongers'),
  -- Daily essentials
  ('bank',                       'essentials',  9, 'POS / ATM'),
  ('toilet',                     'essentials', 10, 'Toilets'),
  ('bus_stop',                   'essentials', 11, 'Bus stops'),
  ('gate',                       'essentials', 12, 'Gates & entrances'),
  ('clinic',                     'essentials', 13, 'Clinic'),
  ('charging_booth_rm2lf',       'essentials', 14, 'Charging booths'),
  -- Hostel life
  ('hostel',                     'hostel_life', 15, 'Hostels & lodges'),
  ('laundry_dry_cleaners_lyob0', 'hostel_life', 16, 'Laundry & dry cleaners'),
  ('gas_shops_zs1pt',            'hostel_life', 17, 'Gas shops'),
  ('household_items_ce7br',      'hostel_life', 18, 'Household items'),
  ('furniture_c6r7l',            'hostel_life', 19, 'Furniture'),
  -- Fix & style
  ('salons_ikddg',               'fix_style',  20, 'Salons'),
  ('gadgets_repair_v48gl',       'fix_style',  21, 'Gadgets & repair'),
  ('cobblers_shoe_maker_mpy8e',  'fix_style',  22, 'Cobblers'),
  ('footwears_shoe_12d80',       'fix_style',  23, 'Footwear'),
  ('car_wash_9tzx9',             'fix_style',  24, 'Car wash'),
  ('garage',                     'fix_style',  25, 'Garage'),
  ('filling_stations_t0c9c',     'fix_style',  26, 'Filling stations'),
  -- Faith & fun
  ('chapel',                     'faith_fun',  27, 'Churches'),
  ('mosque',                     'faith_fun',  28, 'Mosques'),
  ('sports',                     'faith_fun',  29, 'Sports')
) as v(id, category, sort_order, label)
where q.id = v.id;

-- Anything not listed above (e.g. a chip added after this was written)
-- shows under "Other" until an admin picks its category.
update quick_chips set category = 'other' where category is null;

-- Top bar: Lecture halls · Food · Printing · POS / ATM · Hostels
update quick_chips set bar_order = null, short_label = null;
update quick_chips q set bar_order = v.bar_order, short_label = v.short_label
from (values
  ('lecture_hall',  0, null),
  ('restaurant',    1, 'Food'),
  ('printing_shop', 2, null),
  ('bank',          3, null),
  ('hostel',        4, 'Hostels')
) as v(id, bar_order, short_label)
where q.id = v.id;
