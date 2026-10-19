-- Dish Diary — remove the README screenshot demo data (restaurants with ids de000000-…).
-- Easier: sign in as admin and use "Remove demo data" on the Admin page, which also deletes any
-- photo files attached to demo reviews. If you use this SQL instead, first remove demo photos in
-- the app (Edit → ✕ → Save) so their files are deleted from Storage too.

delete from public.restaurants where id::text like 'de000000-0000-4000-8000-%';  -- cascades to demo dishes, reviews, photo rows
