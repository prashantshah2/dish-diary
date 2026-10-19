-- Dish Diary — migration 004: restaurant map coordinates, for "Near me".
-- Run once in Supabase → SQL Editor → New query → Run.
-- If you decide against "Near me", you can leave this in place: the columns are unused
-- and harmless, and the app on main simply ignores them.

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
