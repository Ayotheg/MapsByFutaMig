-- ════════════════════════════════════════════════════════════════════════
-- push_notifications — web push for signed-in users (no Firebase)
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Safe to re-run.
-- Run AFTER waypoint_submissions.sql (profiles, is_admin), events.sql,
-- promotions.sql and reviews_read.sql.
--
-- How it fits together:
--   • The app saves each device's browser subscription (save_push_subscription)
--     once the person turns notifications on in their profile. Accounts only.
--   • Anything that wants to notify someone adds a row to push_queue:
--       queue_review_reminder()  — app, on arriving at a rateable place
--       build_weekly_digest()    — pg_cron, Sundays 18:00 Lagos
--       queue_admin_summary()    — pg_cron, daily 08:00 Lagos
--       send_test_push()         — admin, from the Notify tab
--       send_digest_preview()    — admin: this Sunday's round-up, to admins only
--   • Every minute pg_cron calls kick_push_sender(), which wakes the
--     send-push Edge Function only when something is due. That function
--     applies quiet hours and each person's switches, then sends.
--
-- The rule behind it: don't bug people. General news only goes out in the
-- weekly round-up; everything else is about something the person did.
--
-- ── ONE-TIME VAULT SETUP (run yourself, do NOT commit the real values) ───
-- send-push reads all of these from the vault (push_sender_config below),
-- so it needs no Edge Function secrets.
--   select vault.create_secret(
--     'https://vzjlarvtssybglwzfrhi.supabase.co/functions/v1/send-push',
--     'push_fn_url');
--   select vault.create_secret('<long random string>', 'push_webhook_secret');
--   select vault.create_secret('<VAPID public key>',  'vapid_public_key');
--   select vault.create_secret('<VAPID private key>', 'vapid_private_key');
--   select vault.create_secret('https://ik.imagekit.io/<id>', 'image_proxy_url'); -- optional
--
-- Pause sending:  select cron.unschedule('push-sender');
-- Resume:         re-run this file.
-- ════════════════════════════════════════════════════════════════════════

create extension if not exists pg_net with schema extensions;
create extension if not exists pg_cron;


-- ── 1. Per-person switches ──────────────────────────────────────────────
-- A missing key means on. Keys: weekly, reviews.
alter table public.profiles
  add column if not exists push_prefs jsonb not null default '{}'::jsonb;

create or replace function public.set_push_pref(p_key text, p_on boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_prefs jsonb;
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if p_key not in ('weekly', 'reviews') then
    raise exception 'Unknown notification setting: %', p_key;
  end if;
  update public.profiles
     set push_prefs = push_prefs || jsonb_build_object(p_key, coalesce(p_on, true))
   where id = auth.uid()
  returning push_prefs into v_prefs;
  if not found then
    raise exception 'No profile row for this user';
  end if;
  return v_prefs;
end;
$$;

revoke all on function public.set_push_pref(text, boolean) from public, anon;
grant execute on function public.set_push_pref(text, boolean) to authenticated;


-- ── 2. Device subscriptions ─────────────────────────────────────────────
-- One row per browser. No client policies: written only through the two
-- functions below, read only by send-push (service role).
create table if not exists public.push_subscriptions (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);
create index if not exists push_subscriptions_user_idx on public.push_subscriptions(user_id);
alter table public.push_subscriptions enable row level security;

create or replace function public.save_push_subscription(p_endpoint text, p_p256dh text, p_auth text, p_user_agent text default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Sign in first';
  end if;
  if coalesce(p_endpoint, '') !~ '^https://' or coalesce(p_p256dh, '') = '' or coalesce(p_auth, '') = '' then
    raise exception 'Invalid subscription';
  end if;
  -- A shared device moves to whoever signed in last.
  insert into public.push_subscriptions (user_id, endpoint, p256dh, auth, user_agent)
  values (auth.uid(), p_endpoint, p_p256dh, p_auth, left(p_user_agent, 300))
  on conflict (endpoint) do update
    set user_id = excluded.user_id, p256dh = excluded.p256dh, auth = excluded.auth,
        user_agent = excluded.user_agent, last_seen_at = now();
  -- Keep the 10 most recent devices per person.
  delete from public.push_subscriptions
   where user_id = auth.uid()
     and id not in (select id from public.push_subscriptions where user_id = auth.uid()
                     order by last_seen_at desc limit 10);
end;
$$;

create or replace function public.delete_push_subscription(p_endpoint text)
returns void
language sql
security definer
set search_path = ''
as $$
  delete from public.push_subscriptions where endpoint = p_endpoint and user_id = auth.uid();
$$;

revoke all on function public.save_push_subscription(text, text, text, text) from public, anon;
revoke all on function public.delete_push_subscription(text) from public, anon;
grant execute on function public.save_push_subscription(text, text, text, text) to authenticated;
grant execute on function public.delete_push_subscription(text) to authenticated;


-- ── 3. When a place went live ───────────────────────────────────────────
-- Student suggestions are created long before an admin approves them, so
-- "new this week" needs the approval time, not created_at. No backfill:
-- older places count by created_at.
alter table public.waypoints add column if not exists approved_at timestamptz;

create or replace function public.stamp_waypoint_approved_at()
returns trigger
language plpgsql
as $$
begin
  if new.status = 'approved' and (tg_op = 'INSERT' or old.status is distinct from 'approved') then
    new.approved_at := now();
  end if;
  return new;
end;
$$;

drop trigger if exists waypoints_stamp_approved_at on public.waypoints;
create trigger waypoints_stamp_approved_at
  before insert or update of status on public.waypoints
  for each row execute function public.stamp_waypoint_approved_at();


-- ── 4. The queue ────────────────────────────────────────────────────────
create table if not exists public.push_queue (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users(id) on delete cascade,
  kind        text not null check (kind in ('review', 'weekly', 'admin', 'test', 'preview')),
  title       text not null,
  body        text,
  url         text,
  image_path  text,            -- place-images path; send-push turns it into a URL
  tag         text,            -- same tag replaces the earlier notification
  actions     jsonb,           -- up to two [{action, title, url}]
  ref         text,            -- e.g. the waypoint a review reminder is about
  send_after  timestamptz not null default now(),
  status      text not null default 'pending'
              check (status in ('pending', 'sending', 'sent', 'skipped', 'cancelled', 'failed')),
  status_note text,
  claimed_at  timestamptz,
  sent_at     timestamptz,
  created_at  timestamptz not null default now(),
  dedupe_key  text unique
);
-- Tables made before the admin preview existed: allow its kind too.
alter table public.push_queue drop constraint if exists push_queue_kind_check;
alter table public.push_queue add constraint push_queue_kind_check
  check (kind in ('review', 'weekly', 'admin', 'test', 'preview'));
create index if not exists push_queue_due_idx on public.push_queue(send_after) where status = 'pending';
create index if not exists push_queue_user_kind_idx on public.push_queue(user_id, kind, sent_at desc);
alter table public.push_queue enable row level security;

-- send-push takes a batch at a time; rows another run already holds are
-- skipped, and a run that died frees its rows after 10 minutes.
create or replace function public.claim_push_batch(p_limit integer default 200)
returns setof public.push_queue
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.push_queue set status = 'pending', claimed_at = null
   where status = 'sending' and claimed_at < now() - interval '10 minutes';

  return query
  update public.push_queue q
     set status = 'sending', claimed_at = now()
   where q.id in (
     select id from public.push_queue
      where status = 'pending' and send_after <= now()
      order by id
      limit p_limit
      for update skip locked)
  returning q.*;
end;
$$;

revoke all on function public.claim_push_batch(integer) from public, anon, authenticated;

-- Does this person have any device to send to?
create or replace function public.has_push_device(p_user uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.push_subscriptions where user_id = p_user);
$$;
revoke all on function public.has_push_device(uuid) from public, anon, authenticated;


-- ── 5. Rate your visit ──────────────────────────────────────────────────
-- Called by the app when a signed-in person arrives at a rateable place
-- (MapPage onArrival). One pending reminder per person: a new visit
-- replaces the last. Reviewing first cancels it (trigger below).
create or replace function public.queue_review_reminder(p_waypoint_id text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_name  text;
  v_image text;
begin
  if auth.uid() is null or not public.has_push_device(auth.uid()) then
    return;
  end if;
  select w.name into v_name from public.waypoints w
   where w.id = p_waypoint_id and w.status = 'approved';
  if v_name is null then
    return;
  end if;
  select i.storage_path into v_image from public.waypoint_images i
   where i.waypoint_id = p_waypoint_id order by i.position limit 1;

  update public.push_queue set status = 'cancelled', status_note = 'newer visit'
   where user_id = auth.uid() and kind = 'review' and status = 'pending';

  insert into public.push_queue (user_id, kind, title, body, url, image_path, tag, actions, ref, send_after, dedupe_key)
  values (
    auth.uid(), 'review',
    'How was ' || v_name || '?',
    'You were there an hour ago · takes 10 seconds',
    '/map?open=review:' || p_waypoint_id,
    v_image,
    'review',
    jsonb_build_array(
      jsonb_build_object('action', 'rate', 'title', 'Rate now', 'url', '/map?open=review:' || p_waypoint_id),
      jsonb_build_object('action', 'later', 'title', 'Not now')),
    p_waypoint_id,
    now() + interval '1 hour',
    'review:' || auth.uid() || ':' || p_waypoint_id || ':' || (now() at time zone 'Africa/Lagos')::date
  )
  on conflict (dedupe_key) do nothing;
end;
$$;

revoke all on function public.queue_review_reminder(text) from public, anon;
grant execute on function public.queue_review_reminder(text) to authenticated;

create or replace function public.cancel_review_reminder_on_review()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is not null then
    update public.push_queue set status = 'cancelled', status_note = 'reviewed'
     where user_id = new.user_id and kind = 'review' and ref = new.waypoint_id
       and status in ('pending', 'sending');
  end if;
  return new;
exception when others then
  raise warning 'cancel_review_reminder_on_review: %', sqlerrm;
  return new;
end;
$$;

drop trigger if exists reviews_cancel_push_reminder on public.reviews;
create trigger reviews_cancel_push_reminder
  after insert on public.reviews
  for each row execute function public.cancel_review_reminder_on_review();


-- ── 6. Weekly round-up ──────────────────────────────────────────────────
-- Admins write at most one announcement per Sunday (Notify tab). "Lead"
-- puts it (or a chosen new place) first in the title.
create table if not exists public.push_announcements (
  id               bigint generated always as identity primary key,
  send_week        date not null unique,   -- the Sunday it goes out
  title            text check (char_length(title) between 1 and 80),
  body             text check (char_length(body) <= 160),
  url              text,
  lead             boolean not null default false,
  lead_waypoint_id text,
  created_by       uuid references auth.users(id) on delete set null,
  created_at       timestamptz not null default now(),
  sent_at          timestamptz,
  -- An announcement, a lead place, or both. Leading needs a title.
  constraint push_announcements_has_content check (title is not null or lead_waypoint_id is not null),
  constraint push_announcements_lead_needs_title check (not lead or title is not null)
);
alter table public.push_announcements enable row level security;

drop policy if exists push_announcements_admin on public.push_announcements;
create policy push_announcements_admin on public.push_announcements
  for all to authenticated
  using (public.is_admin(auth.uid()))
  with check (public.is_admin(auth.uid()));

-- Places counted as "new this week" (also listed in the Notify tab).
create or replace function public.weekly_new_places()
returns table (id text, name text, live_at timestamptz)
language sql
stable
security definer
set search_path = ''
as $$
  select w.id, w.name, coalesce(w.approved_at, w.created_at) as live_at
    from public.waypoints w
   where w.status = 'approved'
     and coalesce(w.source_type, '') <> 'osm_import'
     and coalesce(w.approved_at, w.created_at) >= now() - interval '7 days'
   order by live_at desc;
$$;
revoke all on function public.weekly_new_places() from public, anon;
grant execute on function public.weekly_new_places() to authenticated;

-- The round-up's words and picture for the Sunday `p_week`, or null in a
-- quiet week. Shared by the real send and the admins' preview, so the
-- preview is exactly what everyone gets. Mirrored for the Notify tab's
-- on-screen preview in src/features/notifications/weekly.js.
create or replace function public.compose_weekly_digest(p_week date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_places  integer;
  v_events  integer;
  v_ann     public.push_announcements%rowtype;
  v_lead    text;
  v_title   text;
  v_body    text;
  v_url     text := '/map?open=explore';
  v_image   text;
  v_parts   text[] := '{}';
begin
  select count(*) into v_places from public.weekly_new_places();
  select count(*) into v_events from public.events
   where status = 'approved' and starts_at >= now() and starts_at < now() + interval '7 days';
  select * into v_ann from public.push_announcements
   where send_week = p_week and sent_at is null limit 1;

  if v_places = 0 and v_events = 0 and v_ann.title is null then
    return null; -- quiet week: nothing goes out
  end if;

  if v_places > 0 then
    v_parts := v_parts || (v_places || case when v_places = 1 then ' new place' else ' new places' end);
  end if;
  if v_events > 0 then
    v_parts := v_parts || (v_events || case when v_events = 1 then ' event this week' else ' events this week' end);
  end if;

  if v_ann.id is not null and v_ann.lead_waypoint_id is not null then
    select name into v_lead from public.waypoints where id = v_ann.lead_waypoint_id and status = 'approved';
  end if;

  if v_ann.id is not null and v_ann.lead then
    v_title := v_ann.title;
    v_body := coalesce(nullif(btrim(v_ann.body), ''), array_to_string(v_parts, ' · '));
    v_url := coalesce(nullif(v_ann.url, ''), v_url);
  elsif v_lead is not null then
    v_title := v_lead || ' is on the map' ||
               case when v_places > 1 then ', plus ' || (v_places - 1) || ' more' else '' end;
    if v_ann.title is not null then
      v_parts := v_parts || v_ann.title;
    end if;
    v_body := array_to_string(v_parts, ' · ');
  else
    if v_ann.title is not null then
      v_parts := v_parts || v_ann.title;
    end if;
    v_title := case
      when v_places > 0 and v_events = 0 and v_ann.title is null
        then v_places || case when v_places = 1 then ' new place on campus this week' else ' new places on campus this week' end
      when v_events > 0 and v_places = 0 and v_ann.title is null
        then v_events || case when v_events = 1 then ' event on campus this week' else ' events on campus this week' end
      else 'Your week on campus'
    end;
    v_body := array_to_string(v_parts, ' · ');
  end if;

  -- Picture: the lead place's photo, else the newest new place with one.
  select i.storage_path into v_image
    from public.waypoint_images i
    left join public.weekly_new_places() p on p.id = i.waypoint_id
   where i.waypoint_id = v_ann.lead_waypoint_id or p.id is not null
   order by (i.waypoint_id = v_ann.lead_waypoint_id) desc nulls last, p.live_at desc nulls last, i.position
   limit 1;

  return jsonb_build_object(
    'title', v_title, 'body', v_body, 'url', v_url, 'image_path', v_image,
    'announcement_id', v_ann.id,
    'actions', jsonb_build_array(
      jsonb_build_object('action', 'see', 'title', 'See the week', 'url', v_url),
      jsonb_build_object('action', 'map', 'title', 'Open map', 'url', '/map')));
end;
$$;
revoke all on function public.compose_weekly_digest(date) from public, anon, authenticated;

create or replace function public.build_weekly_digest()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date := (now() at time zone 'Africa/Lagos')::date;
  d       jsonb;
  n       integer;
begin
  d := public.compose_weekly_digest(v_today);
  if d is null then
    return 0;
  end if;

  insert into public.push_queue (user_id, kind, title, body, url, image_path, tag, actions, dedupe_key)
  select s.user_id, 'weekly', d->>'title', d->>'body', d->>'url', d->>'image_path', 'weekly', d->'actions',
         'weekly:' || s.user_id || ':' || v_today
    from (select distinct user_id from public.push_subscriptions) s
    join public.profiles pr on pr.id = s.user_id
   where (pr.push_prefs ->> 'weekly') is distinct from 'false'
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;

  if d->>'announcement_id' is not null then
    update public.push_announcements set sent_at = now() where id = (d->>'announcement_id')::bigint;
  end if;
  return n;
end;
$$;
revoke all on function public.build_weekly_digest() from public, anon, authenticated;

-- "Send preview to admins" (Notify tab): this Sunday's round-up, now, to
-- every admin's devices, exactly as everyone will get it. Doesn't mark the
-- announcement sent and ignores quiet hours. Returns how many admins.
create or replace function public.send_digest_preview()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_now  timestamp := now() at time zone 'Africa/Lagos';
  v_add  integer;
  d      jsonb;
  n      integer;
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admins only';
  end if;
  -- The Sunday the next round-up goes out (after 6 pm Sunday: next week's).
  v_add := (7 - extract(dow from v_now)::integer) % 7;
  if v_add = 0 and extract(hour from v_now) >= 18 then
    v_add := 7;
  end if;

  d := public.compose_weekly_digest(v_now::date + v_add);
  if d is null then
    raise exception 'Nothing to send yet: no new places, events or announcement this week';
  end if;

  insert into public.push_queue (user_id, kind, title, body, url, image_path, tag, actions)
  select pr.id, 'preview', d->>'title', d->>'body', d->>'url', d->>'image_path', 'weekly-preview', d->'actions'
    from public.profiles pr
   where pr.is_admin and public.has_push_device(pr.id);
  get diagnostics n = row_count;
  if n = 0 then
    raise exception 'No admin has notifications turned on yet. Turn them on in your profile first';
  end if;
  return n;
end;
$$;
revoke all on function public.send_digest_preview() from public, anon;
grant execute on function public.send_digest_preview() to authenticated;


-- ── 7. Admin morning summary ────────────────────────────────────────────
create or replace function public.queue_admin_summary()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_places integer;
  v_events integer;
  v_promos integer;
  v_total  integer;
  v_parts  text[] := '{}';
  n        integer;
begin
  select count(*) into v_places from public.waypoints where status = 'pending';
  select count(*) into v_events from public.events where status = 'pending_review';
  select count(*) into v_promos from public.promotions where status = 'pending_review' and payment_status = 'paid';
  v_total := v_places + v_events + v_promos;
  if v_total = 0 then
    return 0;
  end if;
  if v_promos > 0 then v_parts := v_parts || (v_promos || case when v_promos = 1 then ' paid promotion' else ' paid promotions' end); end if;
  if v_places > 0 then v_parts := v_parts || (v_places || case when v_places = 1 then ' place' else ' places' end); end if;
  if v_events > 0 then v_parts := v_parts || (v_events || case when v_events = 1 then ' event' else ' events' end); end if;

  insert into public.push_queue (user_id, kind, title, body, url, tag, actions, dedupe_key)
  select pr.id, 'admin',
         v_total || case when v_total = 1 then ' thing waiting for review' else ' things waiting for review' end,
         array_to_string(v_parts, ' · '),
         '/map?open=admin', 'admin',
         jsonb_build_array(jsonb_build_object('action', 'review', 'title', 'Review now', 'url', '/map?open=admin')),
         'admin:' || pr.id || ':' || (now() at time zone 'Africa/Lagos')::date
    from public.profiles pr
   where pr.is_admin and public.has_push_device(pr.id)
  on conflict (dedupe_key) do nothing;
  get diagnostics n = row_count;
  return n;
end;
$$;
revoke all on function public.queue_admin_summary() from public, anon, authenticated;


-- ── 8. Test ping (admins, from the Notify tab) ──────────────────────────
create or replace function public.send_test_push()
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Not public.is_admin(): it reads an unqualified `profiles`, which fails
  -- under this function's empty search_path.
  if not exists (select 1 from public.profiles where id = auth.uid() and is_admin) then
    raise exception 'Admins only';
  end if;
  if not public.has_push_device(auth.uid()) then
    raise exception 'Turn on notifications in your profile first';
  end if;
  insert into public.push_queue (user_id, kind, title, body, url, tag)
  values (auth.uid(), 'test', 'Notifications are working',
          'This is how Maps By FUTA notifications look on this device.', '/map?open=profile', 'test');
end;
$$;
revoke all on function public.send_test_push() from public, anon;
grant execute on function public.send_test_push() to authenticated;


-- ── 9. Waking the sender ────────────────────────────────────────────────
-- send-push's keys, from the vault. Service role only.
create or replace function public.push_sender_config()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_object_agg(name, decrypted_secret)
    from vault.decrypted_secrets
   where name in ('push_webhook_secret', 'vapid_public_key', 'vapid_private_key', 'image_proxy_url');
$$;
revoke all on function public.push_sender_config() from public, anon, authenticated;
grant execute on function public.push_sender_config() to service_role;

create or replace function public.kick_push_sender()
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  if not exists (select 1 from public.push_queue where status = 'pending' and send_after <= now()) then
    return;
  end if;
  select decrypted_secret into v_url from vault.decrypted_secrets where name = 'push_fn_url' limit 1;
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = 'push_webhook_secret' limit 1;
  if v_url is null or v_secret is null then
    raise warning 'kick_push_sender: vault secrets missing';
    return;
  end if;
  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object('Content-Type', 'application/json', 'x-webhook-secret', v_secret),
    body    := '{}'::jsonb);
end;
$$;
revoke all on function public.kick_push_sender() from public, anon, authenticated;

-- Re-running this file replaces the jobs instead of adding copies.
do $$
declare j text;
begin
  foreach j in array array['push-sender', 'push-weekly-digest', 'push-admin-summary'] loop
    if exists (select 1 from cron.job where jobname = j) then
      perform cron.unschedule(j);
    end if;
  end loop;
end $$;

select cron.schedule('push-sender', '* * * * *', 'select public.kick_push_sender()');
-- Sundays 18:00 Lagos (17:00 UTC).
select cron.schedule('push-weekly-digest', '0 17 * * 0', 'select public.build_weekly_digest()');
-- Every day 08:00 Lagos (07:00 UTC).
select cron.schedule('push-admin-summary', '0 7 * * *', 'select public.queue_admin_summary()');

-- Verification:
--   select jobname, schedule from cron.job where jobname like 'push-%';
--   select id, kind, title, status, status_note, send_after, sent_at
--     from public.push_queue order by id desc limit 20;
--   select id, status_code, error_msg, created from net._http_response order by created desc limit 5;
