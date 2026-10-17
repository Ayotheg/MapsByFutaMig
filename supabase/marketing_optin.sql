-- ════════════════════════════════════════════════════════════════════════
-- marketing_optin — "Send me updates" consent → Resend contacts (segment)
-- ════════════════════════════════════════════════════════════════════════
--
-- Safe to re-run. Builds on supabase/welcome_email.sql (same pg_net + Vault
-- pattern, same webhook secret).
--
-- Flow:
--   • Email signup: AuthFlow's "Create your account" checkbox →
--     signUp metadata `marketing_opt_in` → when the user becomes confirmed,
--     send_welcome_email_on_confirm() copies it into profiles (C3 below).
--   • Google / anyone signed in: set_marketing_consent(opt_in) RPC — the
--     one-time map prompt (MarketingOptInPrompt.jsx) and the account card's
--     "Email updates" switch. This RPC is the ONLY client write path;
--     profiles still has no UPDATE policy.
--   • profiles.marketing_opt_in changes → trigger → pg_net POST to the
--     `sync-resend-contact` Edge Function → Resend contact created /
--     resubscribed / marked unsubscribed (never deleted).
--
-- No backfill on purpose: the existing subscribers are already in Resend.
-- Signup and profile updates are never blocked: pg_net is async and every
-- error here is downgraded to a warning.
--
-- ── ONE-TIME VAULT SETUP (not a secret, but kept beside welcome_fn_url) ──
--   select vault.create_secret(
--     'https://vzjlarvtssybglwzfrhi.supabase.co/functions/v1/sync-resend-contact',
--     'sync_fn_url');
-- The x-webhook-secret reuses the existing `welcome_webhook_secret`.
--
-- Pause:  alter table public.profiles disable trigger on_profile_marketing_opt_in_changed;
-- Resume: alter table public.profiles enable  trigger on_profile_marketing_opt_in_changed;
-- ════════════════════════════════════════════════════════════════════════

-- C1. Consent columns.
alter table public.profiles
  add column if not exists marketing_opt_in    boolean     not null default false,
  add column if not exists marketing_opt_in_at timestamptz null,
  add column if not exists resend_synced_at    timestamptz null;

-- C2. Consent RPC — the signed-in user's own row only.
create or replace function public.set_marketing_consent(opt_in boolean)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Not signed in';
  end if;
  if opt_in is null then
    raise exception 'opt_in is required';
  end if;
  update public.profiles
     set marketing_opt_in = opt_in,
         marketing_opt_in_at = now()
   where id = auth.uid();
  -- No profile row (handle_new_user swallowed an error): fail loudly so
  -- the client shows "couldn't save" instead of a choice that went nowhere.
  if not found then
    raise exception 'No profile row for this user';
  end if;
end;
$$;

revoke all on function public.set_marketing_consent(boolean) from public, anon;
grant execute on function public.set_marketing_consent(boolean) to authenticated;

-- C3. Carry the email-signup choice across confirmation. This is the
-- existing welcome trigger function (welcome_email.sql B3.3) with one
-- added block; the welcome behaviour is unchanged.
--
-- Trigger order: on INSERT, Postgres runs same-event triggers by name, so
-- on_auth_user_confirmed_welcome runs BEFORE on_auth_user_created
-- (handle_new_user) and the profile row may not exist yet. Hence an upsert
-- here; handle_new_user's `on conflict do nothing` then leaves it alone.
-- For email/password users confirmation is a later UPDATE, so the row
-- already exists.
--
-- The block has its own exception handler so a failure here can never roll
-- back or skip the welcome email.
create or replace function public.send_welcome_email_on_confirm()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
begin
  -- OLD can't be referenced in the WHEN clause of a combined
  -- INSERT OR UPDATE trigger, so the null → set check lives here.
  if new.email_confirmed_at is null
     or (tg_op = 'UPDATE' and old.email_confirmed_at is not null) then
    return new;
  end if;

  -- Marketing opt-in ticked at signup (marketing_optin.sql C3).
  begin
    if coalesce((new.raw_user_meta_data->>'marketing_opt_in')::boolean, false) then
      insert into public.profiles as p (id, marketing_opt_in, marketing_opt_in_at)
      values (new.id, true, now())
      on conflict (id) do update
        set marketing_opt_in = true, marketing_opt_in_at = now()
        where p.marketing_opt_in = false;
    end if;
  exception when others then
    raise warning 'marketing opt-in copy failed for user %: %', new.id, sqlerrm;
  end;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'welcome_fn_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'welcome_webhook_secret' limit 1;

  if v_url is null or v_secret is null then
    raise warning 'send_welcome_email_on_confirm: vault secrets missing, skipping user %', new.id;
    return new;
  end if;

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret),
    body    := jsonb_build_object(
                 'user_id', new.id,
                 'email',   new.email,
                 'name',    coalesce(new.raw_user_meta_data->>'full_name',
                                     new.raw_user_meta_data->>'name'))
  );
  return new;
exception when others then
  raise warning 'send_welcome_email_on_confirm failed for user %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.send_welcome_email_on_confirm() from public, anon, authenticated;

-- C4. Sync trigger on profiles. INSERT is covered too, for the C3 case
-- where the upsert creates the row with marketing_opt_in already true.
-- Updates that don't touch marketing_opt_in (e.g. the function stamping
-- resend_synced_at) don't fire it.
create or replace function public.sync_marketing_consent_to_resend()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_url    text;
  v_secret text;
  v_email  text;
  v_meta   jsonb;
  v_name   text;
begin
  if tg_op = 'UPDATE' and new.marketing_opt_in is not distinct from old.marketing_opt_in then
    return new;
  end if;
  if tg_op = 'INSERT' and not new.marketing_opt_in then
    return new;
  end if;

  select u.email, u.raw_user_meta_data into v_email, v_meta
    from auth.users u where u.id = new.id;
  if v_email is null then
    raise warning 'sync_marketing_consent_to_resend: no email for user %, skipping', new.id;
    return new;
  end if;

  select decrypted_secret into v_url
    from vault.decrypted_secrets where name = 'sync_fn_url' limit 1;
  select decrypted_secret into v_secret
    from vault.decrypted_secrets where name = 'welcome_webhook_secret' limit 1;
  if v_url is null or v_secret is null then
    raise warning 'sync_marketing_consent_to_resend: vault secrets missing, skipping user %', new.id;
    return new;
  end if;

  -- First word of the name (Google: full_name/name; email signup:
  -- display_name), else the email prefix.
  v_name := nullif(btrim(coalesce(v_meta->>'full_name', v_meta->>'name', v_meta->>'display_name', '')), '');
  v_name := (regexp_split_to_array(coalesce(v_name, split_part(v_email, '@', 1)), '\s+'))[1];

  perform net.http_post(
    url     := v_url,
    headers := jsonb_build_object(
                 'Content-Type', 'application/json',
                 'x-webhook-secret', v_secret),
    body    := jsonb_build_object(
                 'user_id',    new.id,
                 'email',      v_email,
                 'first_name', v_name,
                 'opt_in',     new.marketing_opt_in)
  );
  return new;
exception when others then
  raise warning 'sync_marketing_consent_to_resend failed for user %: %', new.id, sqlerrm;
  return new;
end;
$$;

revoke all on function public.sync_marketing_consent_to_resend() from public, anon, authenticated;

drop trigger if exists on_profile_marketing_opt_in_changed on public.profiles;
create trigger on_profile_marketing_opt_in_changed
  after insert or update of marketing_opt_in on public.profiles
  for each row
  execute function public.sync_marketing_consent_to_resend();

-- Verification:
--   select id, marketing_opt_in, marketing_opt_in_at, resend_synced_at
--     from public.profiles where marketing_opt_in_at is not null;
--   select id, status_code, content, error_msg, created
--     from net._http_response order by created desc limit 10;
