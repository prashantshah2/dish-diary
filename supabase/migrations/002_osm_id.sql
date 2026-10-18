-- Dish Diary — migration 002: remember which map place a restaurant came from.
-- Run once in Supabase → SQL Editor → New query → Run (projects created before this change).
-- New projects get this from schema.sql already.

-- OpenStreetMap id of the place picked in "Find the restaurant", e.g. 'N2501812416'.
alter table public.restaurants
  add column osm_id text check (char_length(osm_id) <= 40);

-- The same map place can only be added once.
create unique index restaurants_osm_id_key
  on public.restaurants (osm_id) where osm_id is not null;

-- Let the app set it when adding a restaurant (other columns unchanged).
grant insert (osm_id) on public.restaurants to authenticated;
