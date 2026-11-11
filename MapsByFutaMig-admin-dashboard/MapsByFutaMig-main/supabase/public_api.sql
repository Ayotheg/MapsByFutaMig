-- ════════════════════════════════════════════════════════════════════════
-- Public API — keys, credits, rate limits, and the only data it may read
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Safe to re-run.
--
-- Backs the Edge Function supabase/functions/public-api (docs/public-api.md).
-- Adds new objects only; no existing table, policy or function is changed.
--
-- Security shape:
--   * The function reads place data ONLY through the api_public_* views
--     below. They name every column, so nothing private (submitted_by,
--     status, promotion fields, people/channel rows) can leak through code.
--   * Every api_* table has RLS on and no policy: only the service role
--     (the Edge Function) can touch them.
--   * Full API keys are never stored. Only their SHA-256 hash is.
--
-- Sections: 1 tables · 2 seeds · 3 public data views · 4 functions ·
--           5 admin helpers · 6 permissions · 7 verification

-- ── 1. Tables ────────────────────────────────────────────────────────────

create table if not exists api_plans (
  id                    text primary key,            -- slug, e.g. 'starter'
  name                  text not null,
  monthly_price_ngn     integer not null default 0 check (monthly_price_ngn >= 0),
  monthly_credits       integer not null check (monthly_credits >= 0),
  rate_limit_per_minute integer not null check (rate_limit_per_minute > 0),
  active                boolean not null default true -- false = not offered to new keys
);

create table if not exists api_keys (
  id                      uuid primary key default gen_random_uuid(),
  owner_name              text not null,
  owner_email             text not null,
  key_prefix              text not null,             -- 'fk_live_' + 4 chars, display only
  key_hash                text not null unique,      -- SHA-256 hex of the full key
  plan_id                 text not null references api_plans(id),
  plan_credits_remaining  integer not null default 0 check (plan_credits_remaining >= 0),
  topup_credits_remaining integer not null default 0 check (topup_credits_remaining >= 0),
  period_reset_at         timestamptz not null default (now() + interval '1 month'),
  status                  text not null default 'active' check (status in ('active', 'revoked')),
  created_at              timestamptz not null default now(),
  last_used_at            timestamptz
);

-- key_id is null for requests that arrived with an unknown key.
create table if not exists api_usage (
  id              bigint generated always as identity primary key,
  key_id          uuid references api_keys(id) on delete cascade,
  endpoint        text not null,
  status_code     integer not null,
  credits_charged integer not null default 0,
  response_ms     integer,
  created_at      timestamptz not null default now()
);
create index if not exists api_usage_key_created_idx on api_usage (key_id, created_at desc);

-- Edit a row here to change a price. No redeploy needed.
create table if not exists api_credit_costs (
  endpoint_pattern text primary key,
  credits          integer not null check (credits >= 0)
);

-- One row per key per minute.
create table if not exists api_rate_windows (
  key_id       uuid not null references api_keys(id) on delete cascade,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (key_id, window_start)
);

-- Same, per caller IP, for unknown and revoked keys (blocks key guessing).
-- The IP is stored hashed.
create table if not exists api_ip_rate_windows (
  ip_hash      text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (ip_hash, window_start)
);
create index if not exists api_ip_rate_windows_start_idx on api_ip_rate_windows (window_start);

-- Every credit grant. `reference` is unique so a payment webhook
-- (Paystack/BACHS, later) can grant once per payment and never twice.
create table if not exists api_credit_grants (
  id         bigint generated always as identity primary key,
  key_id     uuid not null references api_keys(id) on delete cascade,
  kind       text not null check (kind in ('plan', 'topup')),
  amount     integer not null check (amount > 0),
  reference  text unique,
  note       text,
  created_at timestamptz not null default now()
);
create index if not exists api_credit_grants_key_idx on api_credit_grants (key_id, created_at desc);

alter table api_plans           enable row level security;
alter table api_keys            enable row level security;
alter table api_usage           enable row level security;
alter table api_credit_costs    enable row level security;
alter table api_rate_windows    enable row level security;
alter table api_ip_rate_windows enable row level security;
alter table api_credit_grants   enable row level security;

-- ── 2. Seeds (kept as-is if you have already edited them) ────────────────

insert into api_plans (id, name, monthly_price_ngn, monthly_credits, rate_limit_per_minute) values
  ('free',    'Free',        0,  1000,  20),
  ('starter', 'Starter',  3000,  5000,  60),
  ('growth',  'Growth',  10000, 25000, 120)   -- placeholder numbers
on conflict (id) do nothing;

insert into api_credit_costs (endpoint_pattern, credits) values
  ('GET /v1/places',            1),
  ('GET /v1/places/:id',        1),
  ('GET /v1/places/nearby',     1),
  ('GET /v1/categories',        1),
  ('GET /v1/places/:id/images', 5),
  ('GET /v1/usage',             0)
on conflict (endpoint_pattern) do nothing;

-- ── 3. Public data views (the API's whole view of the app) ───────────────
-- Dropped and rebuilt so a re-run can change their columns. Only these new
-- views are dropped.

drop view if exists api_public_categories;
drop view if exists api_public_place_images;
drop view if exists api_public_places;

-- Approved, real places with a location. People, channels and online
-- businesses are waypoints rows too and are excluded here.
create view api_public_places as
select
  w.id,
  w.name,
  w.description,
  w.type,
  w.area,
  w.lat,
  w.lng,
  w.avg_rating as rating,
  w.review_count,
  (select count(*)
     from waypoint_images i
    where i.waypoint_id = w.id
      and i.storage_path ~ '^(waypoint|waypoints|waypoint_images)/'
      and position('..' in i.storage_path) = 0)::integer as image_count,
  -- For ?q= search only; the function never returns it.
  lower(concat_ws(' ', w.name, w.area, w.type)) as search_text
from waypoints w
where w.status = 'approved'
  and not w.is_person
  and not w.is_channel
  and not w.is_business
  and w.lat is not null
  and w.lng is not null;

-- Photos of those places only. The place-images bucket also holds
-- promotion and event uploads; the prefix check keeps those out.
create view api_public_place_images as
select
  i.id,
  i.waypoint_id as place_id,
  i.storage_path,
  coalesce(i.position, 0) as position
from waypoint_images i
join api_public_places p on p.id = i.waypoint_id
where i.storage_path ~ '^(waypoint|waypoints|waypoint_images)/'
  and position('..' in i.storage_path) = 0;

create view api_public_categories as
select type, count(*)::integer as place_count
from api_public_places
where type is not null
group by type;

-- ── 4. Functions ─────────────────────────────────────────────────────────

-- Starts a new month for any key whose period has ended: plan credits go
-- back to the plan's allowance, top-up credits are left alone. Called on
-- every request for that key; pass null to sweep all keys.
create or replace function reset_plan_credits(p_key_id uuid default null)
returns integer
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_rows integer;
begin
  update api_keys k
     set plan_credits_remaining = p.monthly_credits,
         -- The first monthly step that lands in the future, so one request
         -- can never refill twice. (A 29th-31st reset day settles on the
         -- last day of a shorter month.)
         period_reset_at = coalesce((
           select k.period_reset_at + make_interval(months => n)
             from generate_series(1, 1200) as n
            where k.period_reset_at + make_interval(months => n) > now()
            order by n
            limit 1), now() + interval '1 month')
    from api_plans p
   where p.id = k.plan_id
     and k.period_reset_at <= now()
     and (p_key_id is null or k.id = p_key_id);
  get diagnostics v_rows = row_count;
  return v_rows;
end;
$$;

-- Takes p_cost credits, plan credits first, then top-up. The row lock makes
-- two requests racing for the last credit run one after the other, so only
-- one can win. Raises 'insufficient_credits' and takes nothing if short.
create or replace function consume_credits(p_key_id uuid, p_cost integer)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  k           api_keys%rowtype;
  v_from_plan integer;
begin
  if p_cost is null or p_cost < 0 then
    raise exception 'invalid_cost';
  end if;

  select * into k from api_keys where id = p_key_id for update;
  if not found then
    raise exception 'key_not_found';
  end if;
  if k.status <> 'active' then
    raise exception 'key_revoked';
  end if;
  if k.plan_credits_remaining + k.topup_credits_remaining < p_cost then
    raise exception 'insufficient_credits';
  end if;

  v_from_plan := least(k.plan_credits_remaining, p_cost);
  update api_keys
     set plan_credits_remaining  = plan_credits_remaining - v_from_plan,
         topup_credits_remaining = topup_credits_remaining - (p_cost - v_from_plan)
   where id = p_key_id
   returning * into k;

  return jsonb_build_object(
    'plan_credits_remaining',  k.plan_credits_remaining,
    'topup_credits_remaining', k.topup_credits_remaining,
    'credits_remaining',       k.plan_credits_remaining + k.topup_credits_remaining
  );
end;
$$;

-- Adds credits. kind 'topup' rolls over month to month; 'plan' is wiped at
-- the next monthly reset. A repeated p_reference is ignored (granted: false).
create or replace function grant_credits(
  p_key_id    uuid,
  p_amount    integer,
  p_kind      text default 'topup',
  p_reference text default null,
  p_note      text default null
)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  k         api_keys%rowtype;
  v_granted boolean := true;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'amount must be greater than 0';
  end if;
  if p_kind is null or p_kind not in ('plan', 'topup') then
    raise exception 'kind must be plan or topup';
  end if;

  select * into k from api_keys where id = p_key_id for update;
  if not found then
    raise exception 'key_not_found';
  end if;

  begin
    insert into api_credit_grants (key_id, kind, amount, reference, note)
    values (p_key_id, p_kind, p_amount, nullif(btrim(p_reference), ''), p_note);
  exception when unique_violation then
    v_granted := false;
  end;

  if v_granted then
    update api_keys
       set plan_credits_remaining  = plan_credits_remaining  + case when p_kind = 'plan'  then p_amount else 0 end,
           topup_credits_remaining = topup_credits_remaining + case when p_kind = 'topup' then p_amount else 0 end
     where id = p_key_id
     returning * into k;
  end if;

  return jsonb_build_object(
    'granted',                 v_granted,
    'plan_credits_remaining',  k.plan_credits_remaining,
    'topup_credits_remaining', k.topup_credits_remaining,
    'credits_remaining',       k.plan_credits_remaining + k.topup_credits_remaining
  );
end;
$$;

-- One call per request: finds the key by its hash, starts a new month if
-- due, and counts the request against the per-minute limit. Unknown and
-- revoked keys are counted per IP instead. Each count is one atomic
-- upsert, so it holds across Edge Function instances.
-- status: ok | invalid | revoked | ip_rate_limited | rate_limited
create or replace function api_authorize(p_key_hash text, p_ip_hash text)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  -- Unknown- or revoked-key attempts allowed per IP per minute.
  c_ip_limit constant integer := 10;
  k          api_keys%rowtype;
  p          api_plans%rowtype;
  v_window   timestamptz := date_trunc('minute', now());
  v_retry    integer := greatest(1, ceil(extract(epoch from (v_window + interval '1 minute' - now())))::integer);
  v_count    integer;
begin
  select * into k from api_keys where key_hash = p_key_hash;

  -- Unknown and revoked keys share the per-IP counter: neither has a plan
  -- limit, and neither may hammer the API (or its log) for free.
  if not found or k.status <> 'active' then
    insert into api_ip_rate_windows as r (ip_hash, window_start, count)
    values (coalesce(nullif(p_ip_hash, ''), 'unknown'), v_window, 1)
    on conflict (ip_hash, window_start) do update set count = r.count + 1
    returning r.count into v_count;
    delete from api_ip_rate_windows where window_start < now() - interval '1 hour';
    return jsonb_build_object(
      'status',         case when v_count > c_ip_limit then 'ip_rate_limited'
                             when k.id is null then 'invalid'
                             else 'revoked' end,
      'key_id',         k.id,
      'rate_limit',     c_ip_limit,
      'rate_remaining', greatest(c_ip_limit - v_count, 0),
      'retry_after',    v_retry
    );
  end if;

  if k.period_reset_at <= now() then
    perform reset_plan_credits(k.id);
    select * into k from api_keys where id = k.id;
  end if;
  select * into p from api_plans where id = k.plan_id;

  insert into api_rate_windows as r (key_id, window_start, count)
  values (k.id, v_window, 1)
  on conflict (key_id, window_start) do update set count = r.count + 1
  returning r.count into v_count;
  delete from api_rate_windows where key_id = k.id and window_start < now() - interval '1 hour';

  update api_keys set last_used_at = now() where id = k.id;

  return jsonb_build_object(
    'status',                  case when v_count > p.rate_limit_per_minute then 'rate_limited' else 'ok' end,
    'key_id',                  k.id,
    'key_prefix',              k.key_prefix,
    'plan_id',                 p.id,
    'plan_name',               p.name,
    'monthly_credits',         p.monthly_credits,
    'rate_limit',              p.rate_limit_per_minute,
    'rate_remaining',          greatest(p.rate_limit_per_minute - v_count, 0),
    'retry_after',             v_retry,
    'plan_credits_remaining',  k.plan_credits_remaining,
    'topup_credits_remaining', k.topup_credits_remaining,
    'credits_remaining',       k.plan_credits_remaining + k.topup_credits_remaining,
    'period_reset_at',         k.period_reset_at,
    'costs',                   (select coalesce(jsonb_object_agg(endpoint_pattern, credits), '{}'::jsonb)
                                  from api_credit_costs)
  );
end;
$$;

-- Places within p_radius_m metres, nearest first (haversine; PostGIS is
-- not installed and the table is small).
create or replace function api_places_nearby(
  p_lat      double precision,
  p_lng      double precision,
  p_radius_m integer,
  p_type     text default null,
  p_limit    integer default 20
)
returns table (
  id text, name text, description text, type text, area text,
  lat numeric, lng numeric, rating numeric, review_count integer,
  image_count integer, distance_m double precision
)
language sql stable security definer set search_path = public, pg_temp
as $$
  select * from (
    select
      p.id, p.name, p.description, p.type, p.area,
      p.lat, p.lng, p.rating, p.review_count, p.image_count,
      2 * 6371000 * asin(least(1, sqrt(
        power(sin(radians(p.lat::double precision - p_lat) / 2), 2) +
        cos(radians(p_lat)) * cos(radians(p.lat::double precision)) *
        power(sin(radians(p.lng::double precision - p_lng) / 2), 2)
      ))) as distance_m
    from api_public_places p
    where p_type is null or p.type = p_type
  ) d
  where d.distance_m <= p_radius_m
  order by d.distance_m, d.id
  limit least(greatest(coalesce(p_limit, 20), 1), 50);
$$;

-- ── 5. Admin helpers (run from the SQL Editor; see docs/public-api.md) ────

-- Creates a key and returns it ONCE. Only its hash is saved, so copy the
-- api_key value from the result straight away.
--   select * from api_create_key('Acme Delivery', 'dev@acme.com', 'starter');
create or replace function api_create_key(
  p_owner_name  text,
  p_owner_email text,
  p_plan_id     text default 'free'
)
returns table (api_key text, key_id uuid, key_prefix text, plan_id text, credits integer)
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_plan api_plans%rowtype;
  -- 48 random hex chars cut from two v4 UUIDs (about 180 random bits).
  v_key  text := 'fk_live_' || substr(
    replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''), 9, 48);
  v_id   uuid;
begin
  if coalesce(btrim(p_owner_name), '') = '' or coalesce(btrim(p_owner_email), '') = '' then
    raise exception 'owner name and email are required';
  end if;
  select * into v_plan from api_plans p where p.id = p_plan_id and p.active;
  if not found then
    raise exception 'unknown or inactive plan: %', p_plan_id;
  end if;

  insert into api_keys (owner_name, owner_email, key_prefix, key_hash, plan_id, plan_credits_remaining)
  values (
    btrim(p_owner_name),
    lower(btrim(p_owner_email)),
    substr(v_key, 1, 12),
    encode(sha256(convert_to(v_key, 'UTF8')), 'hex'),
    v_plan.id,
    v_plan.monthly_credits
  )
  returning id into v_id;

  return query select v_key, v_id, substr(v_key, 1, 12), v_plan.id, v_plan.monthly_credits;
end;
$$;

--   select api_revoke_key('<key id>');
create or replace function api_revoke_key(p_key_id uuid)
returns text
language plpgsql security definer set search_path = public, pg_temp
as $$
begin
  update api_keys set status = 'revoked' where id = p_key_id;
  if not found then
    raise exception 'key_not_found';
  end if;
  return 'revoked';
end;
$$;

-- Moves a key to another plan. With p_refill (default) the key gets the new
-- plan's full allowance now and a fresh month; top-up credits are kept.
--   select api_set_plan('<key id>', 'growth');
create or replace function api_set_plan(p_key_id uuid, p_plan_id text, p_refill boolean default true)
returns jsonb
language plpgsql security definer set search_path = public, pg_temp
as $$
declare
  v_plan api_plans%rowtype;
  k      api_keys%rowtype;
begin
  select * into v_plan from api_plans p where p.id = p_plan_id;
  if not found then
    raise exception 'unknown plan: %', p_plan_id;
  end if;

  update api_keys
     set plan_id                = v_plan.id,
         plan_credits_remaining = case when p_refill then v_plan.monthly_credits else plan_credits_remaining end,
         period_reset_at        = case when p_refill then now() + interval '1 month' else period_reset_at end
   where id = p_key_id
   returning * into k;
  if not found then
    raise exception 'key_not_found';
  end if;

  return jsonb_build_object(
    'plan_id',                 k.plan_id,
    'plan_credits_remaining',  k.plan_credits_remaining,
    'topup_credits_remaining', k.topup_credits_remaining,
    'period_reset_at',         k.period_reset_at
  );
end;
$$;

-- ── 6. Permissions: service role only ────────────────────────────────────
-- Supabase gives anon/authenticated access to new public objects by
-- default. Take it back, so the browser's anon key can reach none of this.

revoke all on
  api_plans, api_keys, api_usage, api_credit_costs, api_rate_windows,
  api_ip_rate_windows, api_credit_grants,
  api_public_places, api_public_place_images, api_public_categories
from public, anon, authenticated;

grant select, insert, update, delete on
  api_plans, api_keys, api_usage, api_credit_costs, api_rate_windows,
  api_ip_rate_windows, api_credit_grants
to service_role;

grant select on api_public_places, api_public_place_images, api_public_categories to service_role;

revoke all on sequence api_usage_id_seq, api_credit_grants_id_seq from public, anon, authenticated;
grant usage, select on sequence api_usage_id_seq, api_credit_grants_id_seq to service_role;

revoke all on function reset_plan_credits(uuid)                                    from public, anon, authenticated;
revoke all on function consume_credits(uuid, integer)                              from public, anon, authenticated;
revoke all on function grant_credits(uuid, integer, text, text, text)              from public, anon, authenticated;
revoke all on function api_authorize(text, text)                                   from public, anon, authenticated;
revoke all on function api_places_nearby(double precision, double precision, integer, text, integer)
                                                                                   from public, anon, authenticated;
revoke all on function api_create_key(text, text, text)                            from public, anon, authenticated;
revoke all on function api_revoke_key(uuid)                                        from public, anon, authenticated;
revoke all on function api_set_plan(uuid, text, boolean)                           from public, anon, authenticated;

grant execute on function reset_plan_credits(uuid)                                 to service_role;
grant execute on function consume_credits(uuid, integer)                           to service_role;
grant execute on function grant_credits(uuid, integer, text, text, text)           to service_role;
grant execute on function api_authorize(text, text)                                to service_role;
grant execute on function api_places_nearby(double precision, double precision, integer, text, integer)
                                                                                   to service_role;
grant execute on function api_create_key(text, text, text)                         to service_role;
grant execute on function api_revoke_key(uuid)                                     to service_role;
grant execute on function api_set_plan(uuid, text, boolean)                        to service_role;

-- Let the API see the new objects straight away.
notify pgrst, 'reload schema';

-- ── 7. Verification ──────────────────────────────────────────────────────
-- 1. RLS on, no policies (expect 7 rows, all true / 0):
--      select c.relname, c.relrowsecurity,
--             (select count(*) from pg_policies p where p.tablename = c.relname) as policies
--        from pg_class c where c.relname like 'api\_%' and c.relkind = 'r';
-- 2. The anon key can reach nothing (expect 0 rows):
--      select table_name, grantee, privilege_type from information_schema.role_table_grants
--       where table_name like 'api\_%' and grantee in ('anon', 'authenticated', 'PUBLIC');
-- 3. Only public columns (expect id, name, description, type, area, lat,
--    lng, rating, review_count, image_count, search_text):
--      select column_name from information_schema.columns where table_name = 'api_public_places';
-- 4. Places exposed (about 648):  select count(*) from api_public_places;
