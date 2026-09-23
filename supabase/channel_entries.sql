-- ── Channel entries on `waypoints` ──────────────────────────────────────
--
-- Same precedent as people_entries.sql: no new table, no new RLS to
-- manage. A "Channel" is just a `waypoints` row with `is_channel = true`
-- — it shares every policy, index, image table, and admin-write helper
-- that a normal place/person entry already has (see
-- supabase/admin_waypoint_policies.sql, adminSave.js). Like a Person, a
-- Channel has no map location, so `lat`/`lng` stay null for these rows.
--
-- Two extra columns beyond `is_person`'s shape: `channel_link` (the
-- WhatsApp/Telegram/any-URL invite link students tap to join) and
-- `channel_platform` (which of the admin's platform-picker options was
-- used — 'whatsapp' | 'telegram' | 'other' — purely cosmetic, drives the
-- brand icon/color shown on the card, never validated server-side).
--
-- Run once. Safe to re-run (every statement is guarded/idempotent).

alter table waypoints add column if not exists is_channel boolean not null default false;
alter table waypoints add column if not exists channel_link text;
alter table waypoints add column if not exists channel_platform text;

-- Channel rows never carry coordinates either — belt-and-suspenders with
-- people_entries.sql's own version of this statement (both idempotent).
alter table waypoints alter column lat drop not null;
alter table waypoints alter column lng drop not null;

create index if not exists waypoints_is_channel_idx on waypoints (is_channel) where is_channel = true;
