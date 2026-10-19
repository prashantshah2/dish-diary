-- Dish Diary — migration 003: admin mode.
-- Run once in Supabase → SQL Editor → New query → Run.
-- Then make yourself admin (see the bottom of this file).

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
