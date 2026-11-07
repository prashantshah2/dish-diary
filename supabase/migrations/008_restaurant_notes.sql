-- Dish Diary — migration 008: comments and a visit date on restaurants.
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- visited_on is text so it can hold just a month ("2026-10") or an exact day ("2026-10-18").
-- Both sort correctly as plain strings.
--
-- To remove everything this adds, re-run the restaurant_summaries view from 004_location.sql, then:
--   alter table public.restaurants drop column notes, drop column visited_on;

alter table public.restaurants
  add column notes      text check (char_length(notes) <= 1000),
  add column visited_on text check (visited_on ~ '^\d{4}-(0[1-9]|1[0-2])(-(0[1-9]|[12]\d|3[01]))?$');

-- The app may set them when adding (and admins / creators when editing).
grant insert (notes, visited_on) on public.restaurants to authenticated;
grant update (notes, visited_on) on public.restaurants to authenticated;

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
  r.lng,
  r.notes,
  r.visited_on
from public.restaurants r;
