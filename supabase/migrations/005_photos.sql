-- Dish Diary — migration 005: photos on reviews.
-- Run once in Supabase → SQL Editor → New query → Run.
--
-- Photos are shrunk on the device (~150–250 KB + ~25 KB thumbnail) before upload, and the
-- limits below are enforced here so the free 1 GB lasts: 1 MB per file, JPEG only,
-- 3 photos per review, 10 photos per person per day.

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
