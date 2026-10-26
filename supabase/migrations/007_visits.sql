-- Dish Diary — migration 007: visitor analytics (visits, unique visitors, signed-in users).
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- One row per visit: an anonymous random device id, a visit id, website/iOS, and the
-- account id only if the visitor is signed in. No IP address, name or location is stored.
-- The app can only add visits through log_visit(); nobody can read the table except
-- through the admin-only insights_visits() report.
--
-- To remove everything this adds:
--   drop function if exists public.insights_visits(date, date, text, text);
--   drop function if exists public.log_visit(uuid, uuid, text);
--   drop table if exists public.visits;

create table public.visits (
  id         bigint generated always as identity primary key,
  visitor_id uuid not null,                 -- random id kept on the device
  session_id uuid not null unique,          -- one per visit (new after 30 min away)
  platform   text not null check (platform in ('web', 'ios', 'android')),
  user_id    uuid references auth.users (id) on delete set null,
  signed_in  boolean not null default false, -- true only for email/password accounts
  created_at timestamptz not null default now()
);
create index visits_created_idx on public.visits (created_at);
create index visits_visitor_idx on public.visits (visitor_id, created_at);

alter table public.visits enable row level security;
revoke all on public.visits from anon, authenticated;   -- no direct reads or writes

-- Records a visit. Quietly ignores bad input, admins (so testing doesn't count),
-- a device logging more than 20 visits an hour, and anything past 20,000 visits a day.
create function public.log_visit(p_visitor uuid, p_session uuid, p_platform text)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  uid uuid := auth.uid();
  is_account boolean := false;
begin
  if p_visitor is null or p_session is null or p_platform not in ('web', 'ios', 'android') then
    return;
  end if;
  if uid is not null then
    if public.is_admin() then return; end if;
    select not coalesce(u.is_anonymous, true) into is_account from auth.users u where u.id = uid;
  end if;
  if (select count(*) from public.visits
       where visitor_id = p_visitor and created_at > now() - interval '1 hour') >= 20 then
    return;
  end if;
  if (select count(*) from public.visits where created_at > now() - interval '24 hours') >= 20000 then
    return;
  end if;
  insert into public.visits (visitor_id, session_id, platform, user_id, signed_in)
  values (p_visitor, p_session, p_platform, uid, coalesce(is_account, false))
  on conflict (session_id) do nothing;
end $$;

revoke execute on function public.log_visit(uuid, uuid, text) from public;
grant execute on function public.log_visit(uuid, uuid, text) to anon, authenticated;

-- Admin report: per day/week (viewer's time zone, weeks start Monday) plus range totals
-- and the previous period of the same length. Unique counts are distinct over each
-- bucket and over the whole range (not sums of daily uniques).
create function public.insights_visits(p_start date, p_end date, p_bucket text, p_tz text default 'UTC')
returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  len int := p_end - p_start + 1;
  result jsonb;
begin
  if not public.is_admin() then raise exception 'Admins only.'; end if;
  if p_bucket not in ('day', 'week') then raise exception 'Group by must be day or week.'; end if;
  if p_end < p_start then raise exception 'The end date is before the start date.'; end if;
  if len > 3660 then raise exception 'Pick a range of 10 years or less.'; end if;

  with v as (
    select visitor_id, user_id, signed_in, platform, (created_at at time zone p_tz)::date as day
      from public.visits
     where (created_at at time zone p_tz)::date between p_start - len and p_end
  ),
  buckets as (
    select gs::date as bkt
      from generate_series(date_trunc(p_bucket, p_start::timestamp),
                           date_trunc(p_bucket, p_end::timestamp),
                           ('1 ' || p_bucket)::interval) gs
  ),
  per_bucket as (
    select b.bkt,
           count(v.visitor_id) as visits,
           count(distinct v.visitor_id) as unique_visitors,
           count(distinct v.user_id) filter (where v.signed_in) as signed_in_users,
           count(v.visitor_id) filter (where v.platform = 'web') as web,
           count(v.visitor_id) filter (where v.platform <> 'web') as app
      from buckets b
      left join v on date_trunc(p_bucket, v.day::timestamp)::date = b.bkt
                 and v.day between p_start and p_end
     group by b.bkt
  )
  select jsonb_build_object(
    'series', coalesce((select jsonb_agg(jsonb_build_object(
                 'bucket', bkt, 'visits', visits, 'unique_visitors', unique_visitors,
                 'signed_in_users', signed_in_users, 'web', web, 'app', app) order by bkt)
               from per_bucket), '[]'),
    'current', (select jsonb_build_object(
                 'visits', count(*), 'unique_visitors', count(distinct visitor_id),
                 'signed_in_users', count(distinct user_id) filter (where signed_in))
               from v where day between p_start and p_end),
    'previous', (select jsonb_build_object(
                 'visits', count(*), 'unique_visitors', count(distinct visitor_id),
                 'signed_in_users', count(distinct user_id) filter (where signed_in))
               from v where day between p_start - len and p_start - 1)
  ) into result;
  return result;
end $$;

revoke execute on function public.insights_visits(date, date, text, text) from public, anon;
grant execute on function public.insights_visits(date, date, text, text) to authenticated;
