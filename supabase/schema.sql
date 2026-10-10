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
  created_by  uuid default auth.uid() references auth.users (id) on delete set null,
  author_name text check (char_length(author_name) <= 40),
  is_hidden   boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Prevent obvious duplicates: same name at the same address.
create unique index restaurants_name_address_key
  on public.restaurants (lower(trim(name)), lower(trim(coalesce(address, ''))));

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

grant insert (name, address, city, cuisine, price_level, author_name)
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
