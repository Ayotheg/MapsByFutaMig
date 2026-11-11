-- ════════════════════════════════════════════════════════════════════════
-- auth_email_status — lets the sign-in card tell "wrong password" apart
-- from "no account yet"
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Safe to re-run.
--
-- Supabase's signInWithPassword returns the same `invalid_credentials`
-- error for a wrong password and for an email with no account. The sign-in
-- flow (src/features/auth/AuthFlow.jsx) needs to know which it was, so it
-- can either say "Wrong password" or move on to "Create your account".
-- The client only calls this AFTER a failed password sign-in.
--
-- Returns:
--   'none'     — no account with this email
--   'password' — account exists and has a password
--   'oauth'    — account exists but has no password (Google sign-up)
--
-- Note: this reveals whether an email is registered, which the requested
-- flow inherently does anyway (new emails are sent to "Create account").
-- Until this is run, the app falls back to showing "Wrong password" with
-- a "Create an account" link.
-- ════════════════════════════════════════════════════════════════════════

create or replace function public.auth_email_status(p_email text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select case
               when u.encrypted_password is not null and u.encrypted_password <> ''
                 then 'password'
               else 'oauth'
             end
      from auth.users u
      where lower(u.email) = lower(trim(p_email))
      limit 1
    ),
    'none'
  );
$$;

revoke all on function public.auth_email_status(text) from public;
grant execute on function public.auth_email_status(text) to anon, authenticated;

-- Verification:
--   select public.auth_email_status('someone-who-does-not-exist@example.com');  -- 'none'
