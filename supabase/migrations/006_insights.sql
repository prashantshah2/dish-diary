-- Dish Diary — migration 006: admin Insights (reporting functions only).
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- Adds four read-only functions; no tables or data change. Each refuses to run unless the
-- caller is an admin (public.is_admin()). Dates are the viewer's local calendar days
-- (p_tz, e.g. 'America/New_York'); weeks start on Monday.
--
-- To remove everything this adds:
--   drop function if exists public.insights_activity(date, date, text, text);
--   drop function if exists public.insights_totals(date, date, text);
--   drop function if exists public.insights_content(date, date, text);
--   drop function if exists public.insights_capacity();
--   drop function if exists public.insights_counts(date, date, text);

-- ─────────────────────────────────────────────────────────────
-- Activity per day or week. Counts everything posted (hidden or not): it measures usage.
-- Contributors = distinct people who posted a review, restaurant or dish. Posts without an
-- account id (e.g. imported, or the account was deleted) are told apart by author name.
-- ─────────────────────────────────────────────────────────────

create function public.insights_activity(p_start date, p_end date, p_bucket text, p_tz text default 'UTC')
returns table (
  bucket date,
  reviews bigint,
  restaurants bigint,
  dishes bigint,
  photos bigint,
  contributors bigint,
  account_contributors bigint,
  anonymous_contributors bigint
)
language plpgsql stable security definer set search_path = '' as $$
declare
  first_bucket date;
  last_bucket date;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_bucket not in ('day', 'week') then raise exception 'Group by must be day or week.'; end if;
  if p_end < p_start then raise exception 'The end date is before the start date.'; end if;
  if p_end - p_start > 3660 then raise exception 'Pick a range of 10 years or less.'; end if;

  first_bucket := date_trunc(p_bucket, p_start::timestamp)::date;
  last_bucket  := date_trunc(p_bucket, p_end::timestamp)::date;

  return query
  with events as (
    select 'review'::text as kind, (v.created_at at time zone p_tz)::date as day, v.user_id as uid, v.author_name as who
      from public.reviews v
    union all
    select 'restaurant', (r.created_at at time zone p_tz)::date, r.created_by, r.author_name from public.restaurants r
    union all
    select 'dish', (d.created_at at time zone p_tz)::date, d.created_by, d.author_name from public.dishes d
    union all
    select 'photo', (p.created_at at time zone p_tz)::date, p.user_id, null from public.review_photos p
  ),
  in_range as (
    select e.kind,
           date_trunc(p_bucket, e.day::timestamp)::date as bkt,
           coalesce(e.uid::text, 'name:' || coalesce(e.who, '?')) as person,
           coalesce(u.is_anonymous, true) as anonymous   -- no account id → treat as anonymous
      from events e
      left join auth.users u on u.id = e.uid
     where e.day between p_start and p_end
  ),
  buckets as (
    select gs::date as bkt
      from generate_series(first_bucket::timestamp, last_bucket::timestamp, ('1 ' || p_bucket)::interval) gs
  )
  select b.bkt,
         count(*) filter (where i.kind = 'review'),
         count(*) filter (where i.kind = 'restaurant'),
         count(*) filter (where i.kind = 'dish'),
         count(*) filter (where i.kind = 'photo'),
         count(distinct i.person) filter (where i.kind <> 'photo'),
         count(distinct i.person) filter (where i.kind <> 'photo' and not i.anonymous),
         count(distinct i.person) filter (where i.kind <> 'photo' and i.anonymous)
    from buckets b
    left join in_range i on i.bkt = b.bkt
   group by b.bkt
   order by b.bkt;
end $$;

-- Totals for a range (helper used by insights_totals).
create function public.insights_counts(p_start date, p_end date, p_tz text)
returns jsonb
language sql stable security definer set search_path = '' as $$
  with events as (
    select 'review'::text as kind, (v.created_at at time zone p_tz)::date as day,
           coalesce(v.user_id::text, 'name:' || coalesce(v.author_name, '?')) as person from public.reviews v
    union all
    select 'restaurant', (r.created_at at time zone p_tz)::date,
           coalesce(r.created_by::text, 'name:' || coalesce(r.author_name, '?')) from public.restaurants r
    union all
    select 'dish', (d.created_at at time zone p_tz)::date,
           coalesce(d.created_by::text, 'name:' || coalesce(d.author_name, '?')) from public.dishes d
    union all
    select 'photo', (p.created_at at time zone p_tz)::date, null from public.review_photos p
  )
  select jsonb_build_object(
    'reviews',      count(*) filter (where kind = 'review'),
    'restaurants',  count(*) filter (where kind = 'restaurant'),
    'dishes',       count(*) filter (where kind = 'dish'),
    'photos',       count(*) filter (where kind = 'photo'),
    'contributors', count(distinct person) filter (where kind <> 'photo')
  )
  from events
  where day between p_start and p_end;
$$;

-- Range totals plus the previous period of the same length, for "change vs previous".
create function public.insights_totals(p_start date, p_end date, p_tz text default 'UTC')
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  len int := p_end - p_start + 1;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_end < p_start then raise exception 'The end date is before the start date.'; end if;
  return jsonb_build_object(
    'current',  public.insights_counts(p_start, p_end, p_tz),
    'previous', public.insights_counts(p_start - len, p_start - 1, p_tz),
    'days', len
  );
end $$;

-- ─────────────────────────────────────────────────────────────
-- What people are eating, for reviews posted in the range. Visible content only.
-- Verdicts use the app's rule: ≥70% liked = Must try, ≤30% = Skip, otherwise Mixed.
-- ─────────────────────────────────────────────────────────────

create function public.insights_content(p_start date, p_end date, p_tz text default 'UTC')
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_end < p_start then raise exception 'The end date is before the start date.'; end if;

  with rv as (
    select v.id, v.liked, v.rating, v.note, d.id as dish_id, d.name as dish, r.id as restaurant_id,
           r.name as restaurant, coalesce(nullif(trim(r.cuisine), ''), 'Not set') as cuisine,
           coalesce(nullif(trim(r.city), ''), 'Not set') as city,
           exists (select 1 from public.review_photos p where p.review_id = v.id) as has_photo
      from public.reviews v
      join public.dishes d on d.id = v.dish_id
      join public.restaurants r on r.id = d.restaurant_id
     where not v.is_hidden and not d.is_hidden and not r.is_hidden
       and (v.created_at at time zone p_tz)::date between p_start and p_end
  ),
  per_dish as (
    select dish_id, dish, restaurant,
           count(*) filter (where liked) as likes,
           count(*) filter (where not liked) as dislikes
      from rv group by dish_id, dish, restaurant
  ),
  verdicts as (
    select case when likes::numeric / (likes + dislikes) >= 0.7 then 'must_try'
                when likes::numeric / (likes + dislikes) <= 0.3 then 'skip'
                else 'mixed' end as verdict
      from per_dish
  )
  select jsonb_build_object(
    'cuisines', coalesce((select jsonb_agg(x order by x.reviews desc, x.name)
                            from (select cuisine as name, count(*) as reviews from rv group by cuisine) x), '[]'),
    'verdicts', jsonb_build_object(
        'must_try', (select count(*) from verdicts where verdict = 'must_try'),
        'mixed',    (select count(*) from verdicts where verdict = 'mixed'),
        'skip',     (select count(*) from verdicts where verdict = 'skip')),
    'top_restaurants', coalesce((select jsonb_agg(x order by x.reviews desc, x.name)
                            from (select restaurant as name, count(*) as reviews
                                    from rv group by restaurant_id, restaurant
                                    order by count(*) desc, restaurant limit 10) x), '[]'),
    'most_liked', coalesce((select jsonb_agg(x order by x.likes desc, x.dish)
                            from (select dish, restaurant, likes, dislikes from per_dish
                                   where likes > 0 order by likes desc, dislikes, dish limit 5) x), '[]'),
    'most_skipped', coalesce((select jsonb_agg(x order by x.dislikes desc, x.dish)
                            from (select dish, restaurant, likes, dislikes from per_dish
                                   where dislikes > 0 order by dislikes desc, likes, dish limit 5) x), '[]'),
    'cities', coalesce((select jsonb_agg(x order by x.restaurants desc, x.name)
                            from (select city as name, count(distinct restaurant_id) as restaurants
                                    from rv group by city) x), '[]'),
    'detail', jsonb_build_object(
        'reviews',     (select count(*) from rv),
        'with_photo',  (select count(*) from rv where has_photo),
        'with_note',   (select count(*) from rv where nullif(trim(note), '') is not null),
        'with_rating', (select count(*) from rv where rating is not null))
  ) into result;

  return result;
end $$;

-- ─────────────────────────────────────────────────────────────
-- Free-tier capacity, right now.
-- ─────────────────────────────────────────────────────────────

create function public.insights_capacity()
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  return jsonb_build_object(
    'database_bytes', pg_database_size(current_database()),
    'photo_bytes', coalesce((select sum((o.metadata->>'size')::bigint)
                               from storage.objects o where o.bucket_id = 'review-photos'), 0),
    'photo_files', (select count(*) from storage.objects o where o.bucket_id = 'review-photos'),
    'busiest_uploader_24h', coalesce((select max(n) from (
        select count(*) as n from public.review_photos
         where created_at > now() - interval '24 hours' group by user_id) t), 0)
  );
end $$;

-- Only signed-in callers can even try; the functions themselves then require admin.
revoke execute on function public.insights_activity(date, date, text, text) from public, anon;
revoke execute on function public.insights_totals(date, date, text) from public, anon;
revoke execute on function public.insights_content(date, date, text) from public, anon;
revoke execute on function public.insights_capacity() from public, anon;
revoke execute on function public.insights_counts(date, date, text) from public, anon, authenticated;
grant execute on function public.insights_activity(date, date, text, text) to authenticated;
grant execute on function public.insights_totals(date, date, text) to authenticated;
grant execute on function public.insights_content(date, date, text) to authenticated;
grant execute on function public.insights_capacity() to authenticated;
