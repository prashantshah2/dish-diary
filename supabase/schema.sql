-- Dish Diary — Phase 1 database setup
-- Paste this whole file into Supabase → SQL Editor → New query → Run.
-- Safe to re-run only on an empty project (it creates tables).

-- ─────────────────────────────────────────────────────────────
-- Tables
-- ─────────────────────────────────────────────────────────────

create table public.restaurants (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (char_length(trim(name)) between 1 and 120),
  address     text check (char_length(address) <= 300),
  city        text check (char_length(city) <= 80),
  cuisine     text check (char_length(cuisine) <= 40),
  price_level smallint check (price_level between 1 and 4),
  osm_id      text check (char_length(osm_id) <= 40), -- map place it was picked from, e.g. 'N2501812416'
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text check (char_length(author_name) <= 40),
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Prevent obvious duplicates: same name at the same address, or the same map place.
create unique index restaurants_name_address_key
  on public.restaurants (lower(trim(name)), lower(trim(coalesce(address, ''))));
create unique index restaurants_osm_id_key
  on public.restaurants (osm_id) where osm_id is not null;

create table public.dishes (
  id            uuid primary key default gen_random_uuid(),
  restaurant_id uuid not null references public.restaurants (id) on delete cascade,
  name          text not null check (char_length(trim(name)) between 1 and 120),
  created_by    uuid default auth.uid() references auth.users (id) on delete set null,
  author_name   text check (char_length(author_name) <= 40),
  is_hidden     boolean not null default false,
  created_at    timestamptz not null default now()
);

create unique index dishes_restaurant_name_key
  on public.dishes (restaurant_id, lower(trim(name)));

create table public.reviews (
  id          uuid primary key default gen_random_uuid(),
  dish_id     uuid not null references public.dishes (id) on delete cascade,
  user_id     uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text check (char_length(author_name) <= 40),
  liked       boolean not null,
  rating      smallint check (rating between 1 and 5),
  note        text check (char_length(note) <= 1000),
  visited_on  date,
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (dish_id, user_id) -- one review per person per dish (they can edit it)
);

create table public.reports (
  id          uuid primary key default gen_random_uuid(),
  target_type text not null check (target_type in ('restaurant', 'dish', 'review')),
  target_id   uuid not null,
  reason      text check (char_length(reason) <= 500),
  reporter_id uuid default auth.uid() references auth.users (id) on delete set null,
  created_at  timestamptz not null default now(),
  unique (target_type, target_id, reporter_id)
);

create index dishes_restaurant_idx on public.dishes (restaurant_id);
create index reviews_dish_idx on public.reviews (dish_id);

-- ─────────────────────────────────────────────────────────────
-- Summary views (security_invoker = the caller's RLS rules apply)
-- ─────────────────────────────────────────────────────────────

create view public.dish_summaries with (security_invoker = true) as
select
  d.id, d.restaurant_id, d.name, d.author_name, d.created_at,
  count(v.id)                         as review_count,
  count(v.id) filter (where v.liked)     as likes,
  count(v.id) filter (where not v.liked) as dislikes,
  round(avg(v.rating), 1)             as avg_rating
from public.dishes d
left join public.reviews v on v.dish_id = d.id
group by d.id;

create view public.restaurant_summaries with (security_invoker = true) as
select
  r.id, r.name, r.address, r.city, r.cuisine, r.price_level,
  r.author_name, r.created_by, r.created_at,
  (select count(*) from public.dishes d where d.restaurant_id = r.id) as dish_count,
  (select count(*) from public.reviews v
     join public.dishes d on d.id = v.dish_id
    where d.restaurant_id = r.id)                                   as review_count
from public.restaurants r;

-- ─────────────────────────────────────────────────────────────
-- Permissions: everyone can read; signed-in (incl. anonymous) users can write
-- only the columns listed. created_by / user_id / is_hidden are never
-- writable from the app, so ownership comes from auth.uid() defaults.
-- ─────────────────────────────────────────────────────────────

revoke all on public.restaurants, public.dishes, public.reviews, public.reports
  from anon, authenticated;

grant select on public.restaurants, public.dishes, public.reviews,
                public.dish_summaries, public.restaurant_summaries
  to anon, authenticated;

grant insert (name, address, city, cuisine, price_level, osm_id, author_name)
  on public.restaurants to authenticated;
grant update (name, address, city, cuisine, price_level, author_name)
  on public.restaurants to authenticated;

grant insert (restaurant_id, name, author_name) on public.dishes to authenticated;

grant insert (dish_id, author_name, liked, rating, note, visited_on)
  on public.reviews to authenticated;
grant update (author_name, liked, rating, note, visited_on, updated_at)
  on public.reviews to authenticated;
grant delete on public.reviews to authenticated;

grant insert (target_type, target_id, reason) on public.reports to authenticated;

-- ─────────────────────────────────────────────────────────────
-- Row-level security
-- ─────────────────────────────────────────────────────────────

alter table public.restaurants enable row level security;
alter table public.dishes      enable row level security;
alter table public.reviews     enable row level security;
alter table public.reports     enable row level security;

create policy "Visible restaurants are public"
  on public.restaurants for select to anon, authenticated
  using (not is_hidden);
create policy "Signed-in users add restaurants"
  on public.restaurants for insert to authenticated
  with check (created_by = (select auth.uid()));
create policy "Creators edit their restaurants"
  on public.restaurants for update to authenticated
  using (created_by = (select auth.uid()))
  with check (created_by = (select auth.uid()));

create policy "Visible dishes are public"
  on public.dishes for select to anon, authenticated
  using (not is_hidden);
create policy "Signed-in users add dishes"
  on public.dishes for insert to authenticated
  with check (created_by = (select auth.uid()));

create policy "Visible reviews are public"
  on public.reviews for select to anon, authenticated
  using (not is_hidden);
create policy "Signed-in users add reviews"
  on public.reviews for insert to authenticated
  with check (user_id = (select auth.uid()));
create policy "Authors edit their reviews"
  on public.reviews for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));
create policy "Authors delete their reviews"
  on public.reviews for delete to authenticated
  using (user_id = (select auth.uid()));

create policy "Signed-in users report content"
  on public.reports for insert to authenticated
  with check (reporter_id = (select auth.uid()));
-- No select policy on reports: only you (in the dashboard) can read them.

-- ─────────────────────────────────────────────────────────────
-- Spam protection: per-user hourly limits on new entries
-- ─────────────────────────────────────────────────────────────

create function public.enforce_rate_limit() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  recent int;
begin
  execute format(
    'select count(*) from public.%I where %I = $1 and created_at > now() - interval ''1 hour''',
    TG_TABLE_NAME, TG_ARGV[0])
  into recent using auth.uid();
  if recent >= TG_ARGV[1]::int then
    raise exception 'Slow down — too many new entries in the last hour. Try again later.';
  end if;
  return new;
end $$;

create trigger restaurants_rate_limit before insert on public.restaurants
  for each row execute function public.enforce_rate_limit('created_by', '10');
create trigger dishes_rate_limit before insert on public.dishes
  for each row execute function public.enforce_rate_limit('created_by', '30');
create trigger reviews_rate_limit before insert on public.reviews
  for each row execute function public.enforce_rate_limit('user_id', '30');
create trigger reports_rate_limit before insert on public.reports
  for each row execute function public.enforce_rate_limit('reporter_id', '20');

-- Keep updated_at current on review edits.
create function public.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger reviews_touch before update on public.reviews
  for each row execute function public.touch_updated_at();

-- ─────────────────────────────────────────────────────────────
-- Moderation: auto-hide anything reported by 3 different people.
-- To review: Table Editor → reports. To restore: set is_hidden = false.
-- ─────────────────────────────────────────────────────────────

create function public.auto_hide_reported() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  reporters int;
begin
  select count(distinct reporter_id) into reporters
    from public.reports
   where target_type = new.target_type and target_id = new.target_id;

  if reporters >= 3 then
    case new.target_type
      when 'restaurant' then update public.restaurants set is_hidden = true where id = new.target_id;
      when 'dish'       then update public.dishes      set is_hidden = true where id = new.target_id;
      when 'review'     then update public.reviews     set is_hidden = true where id = new.target_id;
    end case;
  end if;
  return new;
end $$;

create trigger reports_auto_hide after insert on public.reports
  for each row execute function public.auto_hide_reported();

-- Trigger functions must not be callable directly through the API.
revoke execute on function public.enforce_rate_limit(), public.touch_updated_at(),
  public.auto_hide_reported() from public, anon, authenticated;

-- ═════════════════════════════════════════════════════════════
-- Admin mode (same as migrations/003_admin.sql)
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Who is an admin. Managed only from the dashboard / SQL Editor:
-- no API access at all (RLS on, no policies, no grants).
-- ─────────────────────────────────────────────────────────────

create table public.admins (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table public.admins enable row level security;
revoke all on public.admins from anon, authenticated;

create function public.is_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admins where user_id = (select auth.uid()));
$$;
revoke execute on function public.is_admin() from public;
grant execute on function public.is_admin() to anon, authenticated;

-- ─────────────────────────────────────────────────────────────
-- Admins can see (incl. hidden), edit, hide and delete everything.
-- ─────────────────────────────────────────────────────────────

create policy "Admins see all restaurants" on public.restaurants for select to authenticated
  using ((select public.is_admin()));
create policy "Admins edit restaurants" on public.restaurants for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete restaurants" on public.restaurants for delete to authenticated
  using ((select public.is_admin()));

create policy "Admins see all dishes" on public.dishes for select to authenticated
  using ((select public.is_admin()));
create policy "Admins edit dishes" on public.dishes for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete dishes" on public.dishes for delete to authenticated
  using ((select public.is_admin()));

create policy "Admins see all reviews" on public.reviews for select to authenticated
  using ((select public.is_admin()));
create policy "Admins edit reviews" on public.reviews for update to authenticated
  using ((select public.is_admin())) with check ((select public.is_admin()));
create policy "Admins delete reviews" on public.reviews for delete to authenticated
  using ((select public.is_admin()));

create policy "Admins read reports" on public.reports for select to authenticated
  using ((select public.is_admin()));
create policy "Admins dismiss reports" on public.reports for delete to authenticated
  using ((select public.is_admin()));

-- Column permissions the admin screens need. RLS above still limits these
-- to admins (and, for restaurants/reviews, to authors editing their own).
grant update (is_hidden) on public.restaurants, public.reviews to authenticated;
grant update (name, is_hidden) on public.dishes to authenticated;
grant delete on public.restaurants, public.dishes to authenticated;
grant select, delete on public.reports to authenticated;

-- Authors may edit their own posts, but only admins may hide/unhide —
-- otherwise someone could unhide their own post after moderation.
-- (Not security definer on purpose: current_user is 'authenticated' for app
-- requests, but the owner when the auto-hide trigger hides something.)
create function public.guard_moderation() returns trigger
language plpgsql set search_path = '' as $$
begin
  if new.is_hidden is distinct from old.is_hidden
     and current_user = 'authenticated'
     and not public.is_admin() then
    raise exception 'Only admins can hide or unhide entries.';
  end if;
  return new;
end $$;
revoke execute on function public.guard_moderation() from public, anon, authenticated;

create trigger restaurants_guard_moderation before update on public.restaurants
  for each row execute function public.guard_moderation();
create trigger dishes_guard_moderation before update on public.dishes
  for each row execute function public.guard_moderation();
create trigger reviews_guard_moderation before update on public.reviews
  for each row execute function public.guard_moderation();

-- ─────────────────────────────────────────────────────────────
-- Summary views: expose is_hidden (admins see hidden rows, with a badge)
-- and count only visible reviews. New columns go last, as required.
-- ─────────────────────────────────────────────────────────────

create or replace view public.dish_summaries with (security_invoker = true) as
select
  d.id, d.restaurant_id, d.name, d.author_name, d.created_at,
  count(v.id)    filter (where not v.is_hidden)                 as review_count,
  count(v.id)    filter (where not v.is_hidden and v.liked)     as likes,
  count(v.id)    filter (where not v.is_hidden and not v.liked) as dislikes,
  round(avg(v.rating) filter (where not v.is_hidden), 1)        as avg_rating,
  d.is_hidden
from public.dishes d
left join public.reviews v on v.dish_id = d.id
group by d.id;

create or replace view public.restaurant_summaries with (security_invoker = true) as
select
  r.id, r.name, r.address, r.city, r.cuisine, r.price_level,
  r.author_name, r.created_by, r.created_at,
  (select count(*) from public.dishes d where d.restaurant_id = r.id and not d.is_hidden) as dish_count,
  (select count(*) from public.reviews v
     join public.dishes d on d.id = v.dish_id
    where d.restaurant_id = r.id and not v.is_hidden and not d.is_hidden)                as review_count,
  r.is_hidden
from public.restaurants r;

-- ─────────────────────────────────────────────────────────────
-- Make yourself admin (after creating your user under
-- Authentication → Users → Add user). Replace the email and run:
--
--   insert into public.admins (user_id)
--   select id from auth.users where email = 'you@example.com';
-- ─────────────────────────────────────────────────────────────

-- ═════════════════════════════════════════════════════════════
-- Restaurant coordinates for "Near me" (same as migrations/004_location.sql)
-- ═════════════════════════════════════════════════════════════

-- Coordinates of the restaurant, from the map search pick or by looking up the address.
alter table public.restaurants
  add column lat double precision check (lat between -90 and 90),
  add column lng double precision check (lng between -180 and 180);

create index restaurants_lat_lng_idx on public.restaurants (lat, lng);

-- The app may set them when adding (and admins / creators when editing).
grant insert (lat, lng) on public.restaurants to authenticated;
grant update (lat, lng) on public.restaurants to authenticated;

-- Expose them on the summary view (new columns go last, as required).
create or replace view public.restaurant_summaries with (security_invoker = true) as
select
  r.id, r.name, r.address, r.city, r.cuisine, r.price_level,
  r.author_name, r.created_by, r.created_at,
  (select count(*) from public.dishes d where d.restaurant_id = r.id and not d.is_hidden) as dish_count,
  (select count(*) from public.reviews v
     join public.dishes d on d.id = v.dish_id
    where d.restaurant_id = r.id and not v.is_hidden and not d.is_hidden)                as review_count,
  r.is_hidden,
  r.lat,
  r.lng
from public.restaurants r;

-- ═════════════════════════════════════════════════════════════
-- Photos on reviews (same as migrations/005_photos.sql)
-- ═════════════════════════════════════════════════════════════

-- ─────────────────────────────────────────────────────────────
-- Storage bucket: public read (cacheable URLs), uploads limited by size and type.
-- ─────────────────────────────────────────────────────────────

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('review-photos', 'review-photos', true, 1048576, '{image/jpeg}')
on conflict (id) do nothing;

-- Uploads go to "<your user id>/<review id>/<file>.jpg" — only into your own folder.
create policy "Upload review photos to own folder" on storage.objects for insert to authenticated
  with check (
    bucket_id = 'review-photos'
    and (storage.foldername(name))[1] = (select auth.uid()::text)
  );

-- Delete your own files; admins can delete any.
create policy "Delete own review photos" on storage.objects for delete to authenticated
  using (
    bucket_id = 'review-photos'
    and ((storage.foldername(name))[1] = (select auth.uid()::text) or (select public.is_admin()))
  );

-- ─────────────────────────────────────────────────────────────
-- Which photos belong to which review.
-- ─────────────────────────────────────────────────────────────

create table public.review_photos (
  id         uuid primary key default gen_random_uuid(),
  review_id  uuid not null references public.reviews (id) on delete cascade,
  user_id    uuid default auth.uid() references auth.users (id) on delete set null,
  path       text not null unique check (char_length(path) <= 300),
  thumb_path text not null check (char_length(thumb_path) <= 300),
  width      int check (width between 1 and 10000),
  height     int check (height between 1 and 10000),
  bytes      int not null default 0 check (bytes between 0 and 2200000), -- full + thumbnail
  created_at timestamptz not null default now()
);
create index review_photos_review_idx on public.review_photos (review_id);

alter table public.review_photos enable row level security;

revoke all on public.review_photos from anon, authenticated;
grant select on public.review_photos to anon, authenticated;
grant insert (review_id, path, thumb_path, width, height, bytes) on public.review_photos to authenticated;
grant delete on public.review_photos to authenticated;

-- Visible whenever its review is visible (so hidden reviews hide their photos; admins see all).
create policy "Photos of visible reviews are public" on public.review_photos for select to anon, authenticated
  using (exists (select 1 from public.reviews r where r.id = review_id));

-- Only the review's author adds photos, stored under their own folder.
create policy "Authors add photos to their reviews" on public.review_photos for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and path like (select auth.uid()::text) || '/%'
    and thumb_path like (select auth.uid()::text) || '/%'
    and exists (select 1 from public.reviews r where r.id = review_id and r.user_id = (select auth.uid()))
  );

create policy "Authors and admins remove photos" on public.review_photos for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- 3 photos per review, 10 per person per day.
create function public.enforce_photo_limits() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if (select count(*) from public.review_photos where review_id = new.review_id) >= 3 then
    raise exception 'A review can have at most 3 photos.';
  end if;
  if (select count(*) from public.review_photos
       where user_id = new.user_id and created_at > now() - interval '24 hours') >= 10 then
    raise exception 'Photo limit reached: 10 per day. Try again tomorrow.';
  end if;
  return new;
end $$;
revoke execute on function public.enforce_photo_limits() from public, anon, authenticated;

create trigger review_photos_limits before insert on public.review_photos
  for each row execute function public.enforce_photo_limits();

-- ═════════════════════════════════════════════════════════════
-- Admin Insights reporting functions (same as migrations/006_insights.sql)
-- ═════════════════════════════════════════════════════════════
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
