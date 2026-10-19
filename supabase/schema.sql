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
