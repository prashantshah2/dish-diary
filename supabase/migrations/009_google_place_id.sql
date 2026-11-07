-- Dish Diary — migration 009: remember the Google place a restaurant was picked from.
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- Google's terms allow storing place IDs indefinitely (not its names, addresses or
-- coordinates), so this is the only Google value kept. Used to spot duplicates,
-- like osm_id.
--
-- To remove: alter table public.restaurants drop column google_place_id;

alter table public.restaurants
  add column google_place_id text check (char_length(google_place_id) <= 300);

create unique index restaurants_google_place_id_key
  on public.restaurants (google_place_id) where google_place_id is not null;

grant insert (google_place_id) on public.restaurants to authenticated;
