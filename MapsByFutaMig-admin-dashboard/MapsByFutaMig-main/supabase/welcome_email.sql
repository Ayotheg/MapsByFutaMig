-- ════════════════════════════════════════════════════════════════════════
-- welcome_email — send the Resend welcome template once per confirmed user
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Safe to re-run.
--
-- Flow: auth.users row becomes confirmed → trigger below → pg_net POSTs to
-- the `send-welcome-email` Edge Function → function sends via Resend and
-- stamps profiles.welcome_email_sent_at.
--
-- Fires when:
--   • INSERT with email_confirmed_at already set   (Google OAuth sign-ups)
--   • UPDATE that moves email_confirmed_at from null → set (email/password
--     users clicking the confirmation link)
-- Never fires for unconfirmed users, later logins, or existing users.
--
-- Signup is never blocked: pg_net is async (the request goes out after the
-- transaction commits) and any error here is downgraded to a warning.
--
-- Does NOT touch on_auth_user_created / handle_new_user (profiles creation).
--
-- ── ONE-TIME VAULT SETUP (run yourself, do NOT commit the real secret) ───
--   select vault.create_secret(
--     'https://vzjlarvtssybglwzfrhi.supabase.co/functions/v1/send-welcome-email',
--     'welcome_fn_url');
--   select vault.create_secret('<same value as WELCOME_WEBHOOK_SECRET>',
--     'welcome_webhook_secret');
-- To change one later:
--   select vault.update_secret(
--     (select id from vault.secrets where name = 'welcome_webhook_secret'),
--     '<new value>');
--
-- Pause:  alter table auth.users disable trigger on_auth_user_confirmed_welcome;
-- Resume: alter table auth.users enable  trigger on_auth_user_confirmed_welcome;
-- ════════════════════════════════════════════════════════════════════════

-- B1. "Sent" marker. No backfill on purpose.
alter table public.profiles
  add column if not exists welcome_email_sent_at timestamptz null;

-- B3.1 Async HTTP from Postgres.
create extension if not exists pg_net with schema extensions;

-- B3.3 Trigger function.
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

-- B3.4 Trigger.
drop trigger if exists on_auth_user_confirmed_welcome on auth.users;
create trigger on_auth_user_confirmed_welcome
  after insert or update of email_confirmed_at on auth.users
  for each row
  when (new.email_confirmed_at is not null)
  execute function public.send_welcome_email_on_confirm();

-- Verification:
--   select tgname, pg_get_triggerdef(oid) from pg_trigger
--     where tgrelid = 'auth.users'::regclass and not tgisinternal;
--   select id, status_code, content, error_msg, created
--     from net._http_response order by created desc limit 10;
--   select id, welcome_email_sent_at from public.profiles
--     where welcome_email_sent_at is not null;
