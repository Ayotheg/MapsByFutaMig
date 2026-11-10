-- ════════════════════════════════════════════════════════════════════════
-- Public API dashboard — self-serve keys for developers, tools for admins
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor, after public_api.sql.
-- Safe to re-run.
--
-- Backs /developers (src/features/developers/) and the admin panel's API
-- tab (src/features/admin/ApiTab.jsx).
--
-- The api_* tables stay closed: RLS on, no policies, no table grants to
-- anon or authenticated. The browser reaches them only through the
-- functions below, which check who is asking:
--   api_dev_*    the signed-in user, and only their own keys (auth.uid())
--   api_admin_*  admins only (is_admin(auth.uid()), waypoint_submissions.sql)
--   api_pricing  anyone: the plans and prices, nothing else
-- No function here returns a key_hash. A new key's full text is returned
-- once, by the call that made it, and never stored.
--
-- Payments aren't wired up: a developer asks for an upgrade or more credits
-- (api_credit_requests) and an admin grants them by hand in the API tab.
--
-- Sections: 1 tables · 2 internal helpers · 3 pricing · 4 developer
--           functions · 5 admin functions · 6 permissions · 7 verification

-- ── 1. Tables ────────────────────────────────────────────────────────────

-- Keys made on /developers belong to a signed-in user. Keys made in SQL
-- (api_create_key) have none.
alter table api_keys add column if not exists user_id uuid references auth.users(id) on delete set null;
create index if not exists api_keys_user_idx on api_keys (user_id) where user_id is not null;

create table if not exists api_credit_requests (
  id          bigint generated always as identity primary key,
  key_id      uuid not null references api_keys(id) on delete cascade,
  user_id     uuid references auth.users(id) on delete set null,
  kind        text not null check (kind in ('upgrade', 'topup')),
  plan_id     text references api_plans(id),
  credits     integer check (credits is null or credits > 0),
  note        text check (note is null or char_length(note) <= 500),
  status      text not null default 'open' check (status in ('open', 'done', 'dismissed', 'cancelled')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists api_credit_requests_open_idx on api_credit_requests (created_at) where status = 'open';
create index if not exists api_credit_requests_user_idx on api_credit_requests (user_id, created_at desc);

alter table api_credit_requests enable row level security;

-- ── 2. Internal helpers (not callable from the browser) ──────────────────

-- The signed-in caller, or an error. Anonymous sessions don't count.
create or replace function api_dev_caller()
returns uuid
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or coalesce((auth.jwt() ->> 'is_anonymous')::boolean, false) then
    raise exception 'not_signed_in';
  end if;
  return v_uid;
end;
$$;

-- One key as the dashboard shows it. Never includes key_hash.
create or replace function api_key_json(p_key_id uuid)
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'id',              k.id,
    'name',            k.owner_name,
    'prefix',          k.key_prefix,
    'status',          k.status,
    'plan_id',         p.id,
    'plan_name',       p.name,
    'monthly_credits', p.monthly_credits,
    'rate_limit',      p.rate_limit_per_minute,
    'plan_credits',    k.plan_credits_remaining,
    'topup_credits',   k.topup_credits_remaining,
    'resets_at',       k.period_reset_at,
    'created_at',      k.created_at,
    'last_used_at',    k.last_used_at,
    'calls_30d',       (select count(*) from api_usage u
                         where u.key_id = k.id and u.created_at > now() - interval '30 days'),
    'credits_used_30d', (select coalesce(sum(u.credits_charged), 0) from api_usage u
                         where u.key_id = k.id and u.created_at > now() - interval '30 days')
  )
  from api_keys k
  join api_plans p on p.id = k.plan_id
  where k.id = p_key_id;
$$;

-- Makes a key and returns its full text once. Only the hash is saved.
create or replace function api_issue_key(
  p_owner_name    text,
  p_owner_email   text,
  p_plan_id       text,
  p_user_id       uuid,
  p_plan_credits  integer,
  p_topup_credits integer,
  p_reset_at      timestamptz
)
returns table (api_key text, key_id uuid)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  -- 48 random hex chars cut from two v4 UUIDs (about 180 random bits),
  -- the same recipe as api_create_key.
  v_key text := 'fk_live_' || substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 9, 48);
  v_id  uuid;
begin
  insert into api_keys (owner_name, owner_email, key_prefix, key_hash, plan_id,
                        plan_credits_remaining, topup_credits_remaining, period_reset_at, user_id)
  values (btrim(p_owner_name), lower(btrim(p_owner_email)), substr(v_key, 1, 12),
          encode(sha256(convert_to(v_key, 'UTF8')), 'hex'), p_plan_id,
          p_plan_credits, p_topup_credits, p_reset_at, p_user_id)
  returning id into v_id;
  return query select v_key, v_id;
end;
$$;

-- ── 3. Pricing (public) ──────────────────────────────────────────────────

create or replace function api_pricing()
returns jsonb
language sql stable security definer set search_path = public, pg_temp
as $$
  select jsonb_build_object(
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', id, 'name', name, 'price_ngn', monthly_price_ngn,
               'monthly_credits', monthly_credits, 'rate_limit', rate_limit_per_minute)
             order by monthly_price_ngn, monthly_credits)
        from api_plans where active), '[]'::jsonb),
    'costs', coalesce((
      select jsonb_agg(jsonb_build_object('endpoint', endpoint_pattern, 'credits', credits)
             order by credits, endpoint_pattern)
        from api_credit_costs), '[]'::jsonb)
  );
$$;

-- ── 4. Developer functions (signed-in user, own keys only) ───────────────

-- Everything /developers shows on load. Starts a new month first for any
-- of the caller's keys that are due, so the balances shown are current.
create or replace function api_dev_overview()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := api_dev_caller();
begin
  perform reset_plan_credits(k.id)
     from api_keys k
    where k.user_id = v_uid and k.status = 'active' and k.period_reset_at <= now();

  return jsonb_build_object(
    'keys', coalesce((
      select jsonb_agg(api_key_json(k.id) order by (k.status = 'active') desc, k.created_at desc)
        from api_keys k where k.user_id = v_uid), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'key_id', r.key_id, 'kind', r.kind, 'plan_id', r.plan_id,
               'credits', r.credits, 'note', r.note, 'status', r.status,
               'created_at', r.created_at, 'resolved_at', r.resolved_at)
             order by r.created_at desc)
        from (select * from api_credit_requests
               where user_id = v_uid
                 and (status = 'open' or created_at > now() - interval '30 days')
               order by created_at desc limit 20) r), '[]'::jsonb),
    'limits', jsonb_build_object('max_active_keys', 5, 'max_free_keys', 1)
  );
end;
$$;

-- Makes a key on the Free plan. An account may hold one active Free key
-- (so free credits can't be multiplied) and five active keys in all.
create or replace function api_dev_create_key(p_name text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := api_dev_caller();
  v_name  text := btrim(coalesce(p_name, ''));
  v_plan  api_plans%rowtype;
  v_key   text;
  v_id    uuid;
begin
  if char_length(v_name) < 2 or char_length(v_name) > 60 then
    raise exception 'bad_name';
  end if;
  -- One create at a time per account, so two quick taps can't both pass
  -- the limits below.
  perform pg_advisory_xact_lock(hashtext('api_dev_keys:' || v_uid::text));

  if (select count(*) from api_keys where user_id = v_uid and status = 'active') >= 5 then
    raise exception 'key_limit';
  end if;
  if exists (select 1 from api_keys where user_id = v_uid and status = 'active' and plan_id = 'free') then
    raise exception 'free_key_exists';
  end if;
  select * into v_plan from api_plans where id = 'free' and active;
  if not found then
    raise exception 'free_plan_unavailable';
  end if;

  select i.api_key, i.key_id into v_key, v_id
    from api_issue_key(v_name, coalesce(auth.jwt() ->> 'email', ''), v_plan.id, v_uid,
                       v_plan.monthly_credits, 0, now() + interval '1 month') i;

  return jsonb_build_object('api_key', v_key, 'key', api_key_json(v_id));
end;
$$;

-- Replaces a key (say it leaked) with a new one on the same plan. The
-- balances, reset date and open requests move over; the old key stops
-- working at once.
create or replace function api_dev_roll_key(p_key_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := api_dev_caller();
  k     api_keys%rowtype;
  v_key text;
  v_id  uuid;
begin
  select * into k from api_keys where id = p_key_id and user_id = v_uid for update;
  if not found then
    raise exception 'key_not_found';
  end if;
  if k.status <> 'active' then
    raise exception 'key_revoked';
  end if;

  update api_keys
     set status = 'revoked', plan_credits_remaining = 0, topup_credits_remaining = 0
   where id = k.id;

  select i.api_key, i.key_id into v_key, v_id
    from api_issue_key(k.owner_name, k.owner_email, k.plan_id, v_uid,
                       k.plan_credits_remaining, k.topup_credits_remaining, k.period_reset_at) i;

  update api_credit_requests set key_id = v_id where key_id = k.id and status = 'open';

  return jsonb_build_object('api_key', v_key, 'key', api_key_json(v_id));
end;
$$;

create or replace function api_dev_revoke_key(p_key_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := api_dev_caller();
begin
  update api_keys set status = 'revoked' where id = p_key_id and user_id = v_uid;
  if not found then
    raise exception 'key_not_found';
  end if;
  update api_credit_requests set status = 'cancelled', resolved_at = now()
   where key_id = p_key_id and status = 'open';
  return api_key_json(p_key_id);
end;
$$;

-- Calls per day for the last 14 days (Lagos time) and the last 20 calls.
create or replace function api_dev_key_usage(p_key_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid   uuid := api_dev_caller();
  v_today date := (now() at time zone 'Africa/Lagos')::date;
begin
  if not exists (select 1 from api_keys where id = p_key_id and user_id = v_uid) then
    raise exception 'key_not_found';
  end if;

  return jsonb_build_object(
    'daily', (
      select jsonb_agg(jsonb_build_object('day', d.day::date, 'calls', coalesce(u.calls, 0), 'credits', coalesce(u.credits, 0))
             order by d.day)
        from generate_series(v_today - 13, v_today, interval '1 day') as d(day)
        left join (
          select (created_at at time zone 'Africa/Lagos')::date as day,
                 count(*) as calls, sum(credits_charged) as credits
            from api_usage
           where key_id = p_key_id and created_at > now() - interval '15 days'
           group by 1
        ) u on u.day = d.day::date),
    'recent', coalesce((
      select jsonb_agg(jsonb_build_object(
               'endpoint', endpoint, 'status', status_code, 'credits', credits_charged,
               'ms', response_ms, 'at', created_at) order by created_at desc)
        from (select * from api_usage where key_id = p_key_id order by created_at desc limit 20) r), '[]'::jsonb)
  );
end;
$$;

-- Asks for an upgrade or more credits. An admin fulfils it by hand.
create or replace function api_dev_request(
  p_key_id  uuid,
  p_kind    text,
  p_plan_id text default null,
  p_credits integer default null,
  p_note    text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid  uuid := api_dev_caller();
  k      api_keys%rowtype;
  v_note text := nullif(btrim(coalesce(p_note, '')), '');
  v_id   bigint;
begin
  select * into k from api_keys where id = p_key_id and user_id = v_uid;
  if not found then
    raise exception 'key_not_found';
  end if;
  if k.status <> 'active' then
    raise exception 'key_revoked';
  end if;
  if char_length(coalesce(v_note, '')) > 500 then
    raise exception 'note_too_long';
  end if;

  if p_kind = 'upgrade' then
    if p_plan_id is null or p_plan_id = k.plan_id
       or not exists (select 1 from api_plans where id = p_plan_id and active) then
      raise exception 'bad_plan';
    end if;
  elsif p_kind = 'topup' then
    if p_credits is null or p_credits < 500 or p_credits > 1000000 then
      raise exception 'bad_credits';
    end if;
  else
    raise exception 'bad_kind';
  end if;

  if exists (select 1 from api_credit_requests where key_id = k.id and kind = p_kind and status = 'open') then
    raise exception 'request_open';
  end if;

  insert into api_credit_requests (key_id, user_id, kind, plan_id, credits, note)
  values (k.id, v_uid, p_kind,
          case when p_kind = 'upgrade' then p_plan_id end,
          case when p_kind = 'topup' then p_credits end,
          v_note)
  returning id into v_id;

  return jsonb_build_object('id', v_id, 'status', 'open');
end;
$$;

create or replace function api_dev_cancel_request(p_id bigint)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := api_dev_caller();
begin
  update api_credit_requests set status = 'cancelled', resolved_at = now()
   where id = p_id and user_id = v_uid and status = 'open';
  if not found then
    raise exception 'request_not_found';
  end if;
  return jsonb_build_object('id', p_id, 'status', 'cancelled');
end;
$$;

-- ── 5. Admin functions (is_admin only) ───────────────────────────────────

create or replace function api_admin_check()
returns uuid
language plpgsql stable security definer set search_path = public, pg_temp
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null or not is_admin(v_uid) then
    raise exception 'not_admin';
  end if;
  return v_uid;
end;
$$;

create or replace function api_admin_overview()
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform api_admin_check();
  return jsonb_build_object(
    'keys', coalesce((
      select jsonb_agg(api_key_json(k.id) || jsonb_build_object('owner_email', k.owner_email, 'self_serve', k.user_id is not null)
             order by (k.status = 'active') desc, k.last_used_at desc nulls last, k.created_at desc)
        from (select * from api_keys order by created_at desc limit 500) k), '[]'::jsonb),
    'requests', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'key_id', r.key_id, 'key_prefix', k.key_prefix, 'key_name', k.owner_name,
               'owner_email', k.owner_email, 'current_plan', k.plan_id,
               'kind', r.kind, 'plan_id', r.plan_id, 'credits', r.credits, 'note', r.note,
               'status', r.status, 'created_at', r.created_at, 'resolved_at', r.resolved_at)
             order by (r.status = 'open') desc, r.created_at desc)
        from (select * from api_credit_requests
               where status = 'open' or created_at > now() - interval '30 days'
               order by created_at desc limit 100) r
        join api_keys k on k.id = r.key_id), '[]'::jsonb),
    'plans', (api_pricing() -> 'plans')
  );
end;
$$;

create or replace function api_admin_grant(p_key_id uuid, p_amount integer, p_kind text default 'topup', p_note text default null)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_admin uuid := api_admin_check();
begin
  perform grant_credits(p_key_id, p_amount, p_kind, null,
                        concat_ws(' · ', nullif(btrim(coalesce(p_note, '')), ''), 'admin ' || v_admin::text));
  return api_key_json(p_key_id);
end;
$$;

create or replace function api_admin_set_plan(p_key_id uuid, p_plan_id text, p_refill boolean default true)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform api_admin_check();
  perform api_set_plan(p_key_id, p_plan_id, p_refill);
  return api_key_json(p_key_id);
end;
$$;

create or replace function api_admin_revoke(p_key_id uuid)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform api_admin_check();
  perform api_revoke_key(p_key_id);
  update api_credit_requests set status = 'cancelled', resolved_at = now()
   where key_id = p_key_id and status = 'open';
  return api_key_json(p_key_id);
end;
$$;

create or replace function api_admin_resolve_request(p_id bigint, p_status text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  perform api_admin_check();
  if p_status not in ('done', 'dismissed') then
    raise exception 'bad_status';
  end if;
  update api_credit_requests set status = p_status, resolved_at = now()
   where id = p_id and status = 'open';
  if not found then
    raise exception 'request_not_found';
  end if;
  return jsonb_build_object('id', p_id, 'status', p_status);
end;
$$;

-- ── 6. Permissions ───────────────────────────────────────────────────────

revoke all on api_credit_requests from public, anon, authenticated;
grant select, insert, update, delete on api_credit_requests to service_role;
revoke all on sequence api_credit_requests_id_seq from public, anon, authenticated;
grant usage, select on sequence api_credit_requests_id_seq to service_role;

-- Internal helpers: no one calls these directly.
revoke all on function api_dev_caller()                                                   from public, anon, authenticated;
revoke all on function api_admin_check()                                                  from public, anon, authenticated;
revoke all on function api_key_json(uuid)                                                 from public, anon, authenticated;
revoke all on function api_issue_key(text, text, text, uuid, integer, integer, timestamptz) from public, anon, authenticated;

-- Pricing: anyone.
revoke all on function api_pricing() from public;
grant execute on function api_pricing() to anon, authenticated, service_role;

-- Developer and admin functions: signed-in users (each checks who is asking).
revoke all on function api_dev_overview()                                   from public, anon;
revoke all on function api_dev_create_key(text)                             from public, anon;
revoke all on function api_dev_roll_key(uuid)                               from public, anon;
revoke all on function api_dev_revoke_key(uuid)                             from public, anon;
revoke all on function api_dev_key_usage(uuid)                              from public, anon;
revoke all on function api_dev_request(uuid, text, text, integer, text)     from public, anon;
revoke all on function api_dev_cancel_request(bigint)                       from public, anon;
revoke all on function api_admin_overview()                                 from public, anon;
revoke all on function api_admin_grant(uuid, integer, text, text)           from public, anon;
revoke all on function api_admin_set_plan(uuid, text, boolean)              from public, anon;
revoke all on function api_admin_revoke(uuid)                               from public, anon;
revoke all on function api_admin_resolve_request(bigint, text)              from public, anon;

grant execute on function api_dev_overview()                                to authenticated;
grant execute on function api_dev_create_key(text)                          to authenticated;
grant execute on function api_dev_roll_key(uuid)                            to authenticated;
grant execute on function api_dev_revoke_key(uuid)                          to authenticated;
grant execute on function api_dev_key_usage(uuid)                           to authenticated;
grant execute on function api_dev_request(uuid, text, text, integer, text)  to authenticated;
grant execute on function api_dev_cancel_request(bigint)                    to authenticated;
grant execute on function api_admin_overview()                              to authenticated;
grant execute on function api_admin_grant(uuid, integer, text, text)        to authenticated;
grant execute on function api_admin_set_plan(uuid, text, boolean)           to authenticated;
grant execute on function api_admin_revoke(uuid)                            to authenticated;
grant execute on function api_admin_resolve_request(bigint, text)           to authenticated;

notify pgrst, 'reload schema';

-- ── 7. Verification ──────────────────────────────────────────────────────
-- 1. The tables are still closed to the browser (expect 0 rows):
--      select table_name, grantee from information_schema.role_table_grants
--       where table_name like 'api\_%' and grantee in ('anon', 'authenticated', 'PUBLIC');
-- 2. Signed out, only pricing works: as anon, `select api_pricing();` returns
--    the plans, and `select api_dev_overview();` is refused.
-- 3. On /developers, sign in, create a key, copy it, and call
--    /v1/usage with it: the plan and credits match the page.
