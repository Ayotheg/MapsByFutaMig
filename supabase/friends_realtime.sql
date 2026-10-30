-- ════════════════════════════════════════════════════════════════════════
-- Meet me / Race to a place — only signed-in users on `friends:*` channels
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Nothing in the app
-- applies this automatically. Safe to re-run: every statement is
-- idempotent. Changes no tables of ours and stores nothing.
--
-- Why: a meetup or race runs over a Supabase Realtime channel named
-- `friends:<code>` (src/features/friends/useFriendsSession.js). Today
-- those channels are public, so only the app's screens stop a signed-out
-- person joining; anyone with the link and the public anon key could
-- connect directly and see positions (a race's distances to the finish,
-- a meetup's two live locations).
--
-- What this does: Realtime Authorization. A *private* channel is only
-- joined if the user passes these RLS policies on `realtime.messages`.
-- Signed-in users (role `authenticated`) may receive and send broadcast
-- and presence on `friends:*` topics; `anon` gets nothing.
--
-- What it doesn't touch:
--  - `site-presence` (the admin "who's online" view) stays public. Do NOT
--    turn off "Allow public access" in Realtime settings: anonymous
--    visitors use that channel.
--  - The signed-out invite card reads `friends-invite:<code>`, a separate
--    public channel that only carries the inviter's name, the place and a
--    player count — never positions. It is deliberately not covered here.
--
-- Turning it on, in this order:
--   1. Run this file.
--   2. Set VITE_FRIENDS_PRIVATE_CHANNELS=true in Vercel (and .env.local),
--      then redeploy. Before that, the app keeps using public channels, so
--      nothing breaks if step 2 waits.
--   Turning it off again: unset the variable and redeploy; the policies
--   can stay.
--
-- Note: the code is the only thing tying a user to a session — any
-- signed-in user holding the link can still join (that's how invites
-- work). Capacity (2 / 4) is enforced by the app.

-- RLS is on for realtime.messages by default; kept explicit.
alter table realtime.messages enable row level security;

drop policy if exists "friends channels: signed-in can receive" on realtime.messages;
create policy "friends channels: signed-in can receive"
  on realtime.messages
  for select
  to authenticated
  using (
    realtime.topic() like 'friends:%'
    and realtime.messages.extension in ('broadcast', 'presence')
  );

drop policy if exists "friends channels: signed-in can send" on realtime.messages;
create policy "friends channels: signed-in can send"
  on realtime.messages
  for insert
  to authenticated
  with check (
    realtime.topic() like 'friends:%'
    and realtime.messages.extension in ('broadcast', 'presence')
  );

-- Check (read-only): both policies listed.
-- select policyname, cmd, roles from pg_policies
--  where schemaname = 'realtime' and tablename = 'messages'
--    and policyname like 'friends channels:%';
