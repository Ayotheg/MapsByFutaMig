-- ════════════════════════════════════════════════════════════════════════
-- Place reviews — working ratings + a public, privacy-safe review list
-- ════════════════════════════════════════════════════════════════════════
--
-- MUST BE RUN MANUALLY in the Supabase SQL Editor. Nothing in the app
-- applies this automatically. Safe to re-run: every statement is
-- idempotent.
--
-- What this fixes (found by checking the live database, Oct 2026):
--
--  1. Every waypoint still shows review_count = 0 / avg_rating null.
--     `reviews_after_insert` is the trigger meant to roll new reviews into
--     `waypoints.avg_rating` / `review_count`. Same failure as the one
--     profile_stats.sql fixed for profiles: a trigger running with the
--     reviewer's rights (anon/authenticated), who have no UPDATE access to
--     `waypoints`, so RLS silently filters the UPDATE to zero rows. It was
--     also insert-only. Replaced with a security definer trigger on
--     INSERT/UPDATE/DELETE that always recomputes from the real rows, and
--     every waypoint is backfilled.
--
--  2. `reviews` has only an INSERT policy (reviews_insert_public), so the
--     app can save a review but nobody can read one back — the place card
--     can never list them. Rather than a public SELECT policy (which would
--     expose `user_id`), reviews are read through `get_place_reviews()`,
--     which returns only rating, comment, date and the reviewer's first
--     name ("null" for anonymous/guest reviews, shown as "Anonymous").
--     The name comes from auth.users metadata, same source and same
--     first-word rule as marketing_optin.sql — but never the email.
--
-- Requires: reviews(id, waypoint_id text, rating, comment, created_at,
-- user_id) and waypoints(id text, avg_rating numeric, review_count int),
-- all already live.
-- ════════════════════════════════════════════════════════════════════════


-- ── 0. Pre-flight (read-only) ───────────────────────────────────────────
-- Reports how far the stored counters are from the real rows. Expect a
-- mismatch before running this file (that is the bug in item 1).
do $$
declare total integer; stale integer;
begin
  select count(*) into total from public.reviews;
  select count(*) into stale
    from public.waypoints w
   where w.review_count is distinct from
         (select count(*) from public.reviews r where r.waypoint_id = w.id);
  raise notice 'reviews_read.sql: % review(s) in total, % waypoint(s) with a stale review_count', total, stale;
end $$;


-- ── 1. Waypoint rating — always recomputed from the real rows ────────────
-- security definer is REQUIRED (see item 1 above): definer rights bypass
-- RLS as table owner, so the UPDATE on `waypoints` actually lands.

create or replace function public.recompute_waypoint_rating() returns trigger
  security definer
  set search_path = public
as $$
declare
  old_wp text;
  new_wp text;
begin
  if tg_op in ('UPDATE', 'DELETE') then old_wp := old.waypoint_id; end if;
  if tg_op in ('INSERT', 'UPDATE') then new_wp := new.waypoint_id; end if;

  if old_wp is not null then
    update public.waypoints w
       set review_count = s.n, avg_rating = s.avg
      from (select count(*)::int as n, round(avg(rating)::numeric, 2) as avg
              from public.reviews where waypoint_id = old_wp) s
     where w.id = old_wp;
  end if;
  if new_wp is not null and new_wp is distinct from old_wp then
    update public.waypoints w
       set review_count = s.n, avg_rating = s.avg
      from (select count(*)::int as n, round(avg(rating)::numeric, 2) as avg
              from public.reviews where waypoint_id = new_wp) s
     where w.id = new_wp;
  end if;
  return null;
end;
$$ language plpgsql;

-- Replaces the old insert-only, invoker-rights trigger. (Its function is
-- left in place, unused; drop it once you've confirmed its name.)
drop trigger if exists reviews_after_insert on public.reviews;
drop trigger if exists reviews_after_change_waypoint_rating on public.reviews;
create trigger reviews_after_change_waypoint_rating
  after insert or delete or update of rating, waypoint_id on public.reviews
  for each row execute function public.recompute_waypoint_rating();

-- Backfill every waypoint from the real rows (places with no reviews go
-- back to 0 / null).
update public.waypoints w
   set review_count = s.n,
       avg_rating   = s.avg
  from (select w2.id,
               count(r.waypoint_id)::int as n,
               round(avg(r.rating)::numeric, 2) as avg
          from public.waypoints w2
          left join public.reviews r on r.waypoint_id = w2.id
         group by w2.id) s
 where w.id = s.id
   and (w.review_count is distinct from s.n or w.avg_rating is distinct from s.avg);


-- ── 2. Public review list for the place card ─────────────────────────────
-- Newest first, paged (the card shows 5, then "Show more"). security
-- definer so it can read `reviews` and the reviewer's name in auth.users
-- without opening either table to the public; it only ever returns the
-- columns below.

create or replace function public.get_place_reviews(
  p_waypoint_id text,
  p_limit integer default 5,
  p_offset integer default 0
)
returns table (id text, rating integer, comment text, created_at timestamptz, reviewer_name text)
  security definer
  set search_path = public
  stable
as $$
  select
    r.id::text,
    r.rating::integer,
    r.comment,
    r.created_at,
    case
      when r.user_id is null then null  -- guest review → "Anonymous" in the app
      else coalesce(
        (regexp_split_to_array(
           nullif(btrim(coalesce(u.raw_user_meta_data->>'full_name',
                                 u.raw_user_meta_data->>'name',
                                 u.raw_user_meta_data->>'display_name', '')), ''),
           '\s+'))[1],
        'FUTA student')                 -- signed in but no name set; never the email
    end as reviewer_name
  from public.reviews r
  left join auth.users u on u.id = r.user_id
  where r.waypoint_id = p_waypoint_id
  order by r.created_at desc, r.id desc
  limit least(greatest(coalesce(p_limit, 5), 1), 50)
  offset greatest(coalesce(p_offset, 0), 0);
$$ language sql;

revoke all on function public.get_place_reviews(text, integer, integer) from public;
grant execute on function public.get_place_reviews(text, integer, integer) to anon, authenticated;


-- ── Verification (run after the above) ──────────────────────────────────
-- 1. Counters match the real rows — should return 0 rows:
--      select w.id, w.review_count,
--             (select count(*) from reviews r where r.waypoint_id = w.id) as actual
--        from waypoints w
--       where w.review_count <> (select count(*) from reviews r where r.waypoint_id = w.id);
--
-- 2. Submit a review in the app, then:
--      select review_count, avg_rating from waypoints where id = '<that place id>';
--    → count went up by 1, average updated.
--`
-- 3. The list works for the public role:
--      set role anon;
--      select * from get_place_reviews('<that place id>');
--      reset role;
--    → your review, with reviewer_name = your first name (or null if you
--      reviewed as a guest). No user_id or email anywhere in the result.
