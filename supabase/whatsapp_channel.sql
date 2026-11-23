-- ════════════════════════════════════════════════════════════════════════
-- WhatsApp channel — remember "joined" on the account, not just the device
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Run AFTER
-- supabase/profile_stats.sql (needs `profiles` and its RLS setup).
-- Safe to re-run: every statement is idempotent.
--
-- The map's "join our WhatsApp channel" prompt
-- (src/features/whatsapp/ChannelPrompt.jsx) stops for good once someone
-- clicks Join. That used to live only in localStorage, so the same person
-- on another phone/browser got asked again. This stores it on the profile
-- for signed-in users. Guests stay device-only (no account to attach to).
--
-- `profiles` has no client write access (profile_stats.sql section 6), so
-- the client can't UPDATE the column directly — it calls the definer-rights
-- RPC below, which can only ever set the caller's OWN flag, and only to
-- "now" (no arbitrary values, no un-setting). Reading it goes through the
-- existing `profiles_select_own` policy.

alter table public.profiles
  add column if not exists whatsapp_channel_joined_at timestamptz;

create or replace function public.mark_whatsapp_channel_joined()
  returns timestamptz
  security definer
  set search_path = public
as $$
declare
  uid uuid := auth.uid();
  joined timestamptz;
begin
  if uid is null then
    raise exception 'Not signed in' using errcode = '28000';
  end if;

  -- Upsert: older accounts may predate their `profiles` row. Keeps the
  -- FIRST join time if called again.
  insert into public.profiles (id, whatsapp_channel_joined_at)
  values (uid, now())
  on conflict (id) do update
    set whatsapp_channel_joined_at = coalesce(public.profiles.whatsapp_channel_joined_at, excluded.whatsapp_channel_joined_at)
  returning whatsapp_channel_joined_at into joined;

  return joined;
end;
$$ language plpgsql;

revoke all on function public.mark_whatsapp_channel_joined() from public, anon;
grant execute on function public.mark_whatsapp_channel_joined() to authenticated;


-- ════════════════════════════════════════════════════════════════════════
-- Verification — run after the script
-- ════════════════════════════════════════════════════════════════════════
--
-- a) Column exists (expect 1 row):
--      select column_name from information_schema.columns
--      where table_schema = 'public' and table_name = 'profiles'
--        and column_name = 'whatsapp_channel_joined_at';
--
-- b) How many accounts have joined via the app:
--      select count(*) from public.profiles where whatsapp_channel_joined_at is not null;
