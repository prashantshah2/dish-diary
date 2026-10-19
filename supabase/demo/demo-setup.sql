-- Dish Diary — DEMO DATA for README screenshots.
-- Fictional restaurants/reviews with fixed ids (de000000-…). Safe to re-run. Remove with demo-cleanup.sql.
-- Demo restaurants appear alongside the real ones. Remove them with Admin → "Remove demo data" (or demo-cleanup.sql).

-- Start clean if an earlier demo load exists.
delete from public.restaurants where id::text like 'de000000-0000-4000-8000-%';

insert into public.restaurants (id, name, cuisine, price_level, address, city, lat, lng, author_name) values
  ('de000000-0000-4000-8000-000000000001', 'Saffron Table', 'Indian', 2, '14 Gordons Corner Rd', 'Manalapan', 40.3195, -74.336, 'Priya'),
  ('de000000-0000-4000-8000-000000000002', 'Nonna Lucia Trattoria', 'Italian', 3, '220 Main St', 'Freehold', 40.2601, -74.2746, 'Jordan'),
  ('de000000-0000-4000-8000-000000000003', 'Taqueria El Sol', 'Mexican', 1, '85 Route 9 N', 'Englishtown', 40.3049, -74.3104, 'Alex'),
  ('de000000-0000-4000-8000-000000000004', 'Kumo Ramen', 'Japanese', 2, '400 Route 9 S', 'Marlboro', 40.3417, -74.2988, 'Sam'),
  ('de000000-0000-4000-8000-000000000005', 'Morning Crumb Bakery', 'Bakery', 1, '9 Water St', 'Englishtown', 40.2968, -74.359, 'Mom'),
  ('de000000-0000-4000-8000-000000000006', 'Harbor Light Pub', 'Bar', 2, '1 Harbor Rd', 'Matawan', 40.4147, -74.2299, 'Dad');

insert into public.dishes (id, restaurant_id, name, author_name) values
  ('de000000-0000-4000-8000-000000000101', 'de000000-0000-4000-8000-000000000001', 'Paneer Butter Masala', 'Priya'),
  ('de000000-0000-4000-8000-000000000102', 'de000000-0000-4000-8000-000000000001', 'Garlic Naan', 'Sam'),
  ('de000000-0000-4000-8000-000000000103', 'de000000-0000-4000-8000-000000000001', 'Chana Masala', 'Dad'),
  ('de000000-0000-4000-8000-000000000104', 'de000000-0000-4000-8000-000000000001', 'Malai Kofta', 'Alex'),
  ('de000000-0000-4000-8000-000000000105', 'de000000-0000-4000-8000-000000000001', 'Palak Paneer', 'Mom'),
  ('de000000-0000-4000-8000-000000000106', 'de000000-0000-4000-8000-000000000001', 'Mango Lassi', 'Alex'),
  ('de000000-0000-4000-8000-000000000107', 'de000000-0000-4000-8000-000000000002', 'Cacio e Pepe', 'Jordan'),
  ('de000000-0000-4000-8000-000000000108', 'de000000-0000-4000-8000-000000000002', 'Margherita Pizza', 'Sam'),
  ('de000000-0000-4000-8000-000000000109', 'de000000-0000-4000-8000-000000000002', 'Wild Mushroom Risotto', 'Priya'),
  ('de000000-0000-4000-8000-000000000110', 'de000000-0000-4000-8000-000000000002', 'Eggplant Parmigiana', 'Dad'),
  ('de000000-0000-4000-8000-000000000111', 'de000000-0000-4000-8000-000000000002', 'Tiramisu', 'Mom'),
  ('de000000-0000-4000-8000-000000000112', 'de000000-0000-4000-8000-000000000003', 'Mushroom Tacos', 'Alex'),
  ('de000000-0000-4000-8000-000000000113', 'de000000-0000-4000-8000-000000000003', 'Street Corn (Elote)', 'Jordan'),
  ('de000000-0000-4000-8000-000000000114', 'de000000-0000-4000-8000-000000000003', 'Bean and Cheese Burrito', 'Sam'),
  ('de000000-0000-4000-8000-000000000115', 'de000000-0000-4000-8000-000000000003', 'Spinach and Mushroom Quesadilla', 'Priya'),
  ('de000000-0000-4000-8000-000000000116', 'de000000-0000-4000-8000-000000000004', 'Miso Vegetable Ramen', 'Sam'),
  ('de000000-0000-4000-8000-000000000117', 'de000000-0000-4000-8000-000000000004', 'Vegetable Gyoza', 'Priya'),
  ('de000000-0000-4000-8000-000000000118', 'de000000-0000-4000-8000-000000000004', 'Agedashi Tofu', 'Mom'),
  ('de000000-0000-4000-8000-000000000119', 'de000000-0000-4000-8000-000000000004', 'Spicy Tofu Ramen', 'Dad'),
  ('de000000-0000-4000-8000-000000000120', 'de000000-0000-4000-8000-000000000005', 'Almond Croissant', 'Mom'),
  ('de000000-0000-4000-8000-000000000121', 'de000000-0000-4000-8000-000000000005', 'Cinnamon Roll', 'Priya'),
  ('de000000-0000-4000-8000-000000000122', 'de000000-0000-4000-8000-000000000006', 'Beer-Battered Onion Rings', 'Dad'),
  ('de000000-0000-4000-8000-000000000123', 'de000000-0000-4000-8000-000000000006', 'Black Bean Burger', 'Jordan'),
  ('de000000-0000-4000-8000-000000000124', 'de000000-0000-4000-8000-000000000006', 'Mac and Cheese', 'Alex'),
  ('de000000-0000-4000-8000-000000000125', 'de000000-0000-4000-8000-000000000004', 'Avocado Roll', 'Mom'),
  ('de000000-0000-4000-8000-000000000126', 'de000000-0000-4000-8000-000000000004', 'Sweet Potato Tempura Roll', 'Jordan');

-- Saffron Table 'Paneer Butter Masala' review by Priya is owned by the admin account, so you can attach a photo to it in the app.
insert into public.reviews (id, dish_id, user_id, author_name, liked, rating, note, visited_on) values
  ('de000000-0000-4000-8000-000000000201', 'de000000-0000-4000-8000-000000000101', (select id from auth.users where email = 'pshahmrk1@gmail.com'), 'Priya', true, 5, 'Creamy and smoky, soft paneer. Order extra naan for the sauce.', '2026-09-28'),
  ('de000000-0000-4000-8000-000000000202', 'de000000-0000-4000-8000-000000000101', null, 'Sam', true, 4, 'Generous portion. Mild — ask for spicy if you like heat.', '2026-10-04'),
  ('de000000-0000-4000-8000-000000000203', 'de000000-0000-4000-8000-000000000101', null, 'Mom', true, 5, 'Best in the area. We got it twice.', '2026-10-11'),
  ('de000000-0000-4000-8000-000000000204', 'de000000-0000-4000-8000-000000000102', null, 'Sam', true, 5, 'Fluffy and buttery, comes out hot.', '2026-10-04'),
  ('de000000-0000-4000-8000-000000000205', 'de000000-0000-4000-8000-000000000102', null, 'Priya', true, 4, null, '2026-09-28'),
  ('de000000-0000-4000-8000-000000000206', 'de000000-0000-4000-8000-000000000103', null, 'Dad', true, 5, 'Hearty, tangy, perfectly spiced.', '2026-10-11'),
  ('de000000-0000-4000-8000-000000000207', 'de000000-0000-4000-8000-000000000103', null, 'Jordan', true, 4, 'Great with rice.', '2026-09-20'),
  ('de000000-0000-4000-8000-000000000208', 'de000000-0000-4000-8000-000000000104', null, 'Alex', true, 4, 'Rich sauce, light koftas.', '2026-10-02'),
  ('de000000-0000-4000-8000-000000000209', 'de000000-0000-4000-8000-000000000104', null, 'Mom', false, 3, 'Too sweet for me.', '2026-10-11'),
  ('de000000-0000-4000-8000-000000000210', 'de000000-0000-4000-8000-000000000105', null, 'Mom', false, 2, 'Bland and watery this time.', '2026-10-11'),
  ('de000000-0000-4000-8000-000000000211', 'de000000-0000-4000-8000-000000000105', null, 'Jordan', false, 2, 'Paneer was rubbery.', '2026-09-20'),
  ('de000000-0000-4000-8000-000000000212', 'de000000-0000-4000-8000-000000000106', null, 'Alex', true, 5, 'Thick and cold — perfect with spicy food.', '2026-10-02'),
  ('de000000-0000-4000-8000-000000000213', 'de000000-0000-4000-8000-000000000107', null, 'Jordan', true, 5, 'Silky sauce, lots of pepper. Worth the price.', '2026-10-09'),
  ('de000000-0000-4000-8000-000000000214', 'de000000-0000-4000-8000-000000000107', null, 'Priya', true, 4, 'Small portion but delicious.', '2026-10-12'),
  ('de000000-0000-4000-8000-000000000215', 'de000000-0000-4000-8000-000000000108', null, 'Sam', true, 4, 'Wood-fired, chewy crust.', '2026-09-30'),
  ('de000000-0000-4000-8000-000000000216', 'de000000-0000-4000-8000-000000000108', null, 'Dad', true, 4, 'Simple and fresh.', '2026-10-05'),
  ('de000000-0000-4000-8000-000000000217', 'de000000-0000-4000-8000-000000000109', null, 'Priya', true, 4, 'Earthy and creamy.', '2026-10-12'),
  ('de000000-0000-4000-8000-000000000218', 'de000000-0000-4000-8000-000000000109', null, 'Alex', false, 3, 'A little undercooked.', '2026-09-14'),
  ('de000000-0000-4000-8000-000000000219', 'de000000-0000-4000-8000-000000000110', null, 'Dad', false, 2, 'Greasy and heavy.', '2026-10-05'),
  ('de000000-0000-4000-8000-000000000220', 'de000000-0000-4000-8000-000000000110', null, 'Alex', false, 2, 'Skip it — soggy.', '2026-09-14'),
  ('de000000-0000-4000-8000-000000000221', 'de000000-0000-4000-8000-000000000111', null, 'Mom', true, 5, 'Light and not too sweet — share it.', '2026-10-05'),
  ('de000000-0000-4000-8000-000000000222', 'de000000-0000-4000-8000-000000000112', null, 'Alex', true, 5, 'Smoky mushrooms, great salsa verde.', '2026-10-13'),
  ('de000000-0000-4000-8000-000000000223', 'de000000-0000-4000-8000-000000000112', null, 'Sam', true, 5, 'Cheap and amazing. Get three.', '2026-10-07'),
  ('de000000-0000-4000-8000-000000000224', 'de000000-0000-4000-8000-000000000112', null, 'Jordan', true, 4, null, '2026-10-01'),
  ('de000000-0000-4000-8000-000000000225', 'de000000-0000-4000-8000-000000000113', null, 'Jordan', true, 4, 'Messy but worth it.', '2026-10-01'),
  ('de000000-0000-4000-8000-000000000226', 'de000000-0000-4000-8000-000000000114', null, 'Sam', true, 4, 'Huge — two meals.', '2026-10-07'),
  ('de000000-0000-4000-8000-000000000227', 'de000000-0000-4000-8000-000000000114', null, 'Priya', false, 3, 'Mostly rice.', '2026-09-25'),
  ('de000000-0000-4000-8000-000000000228', 'de000000-0000-4000-8000-000000000115', null, 'Priya', true, 4, 'Crispy and cheesy.', '2026-09-25'),
  ('de000000-0000-4000-8000-000000000229', 'de000000-0000-4000-8000-000000000116', null, 'Sam', true, 5, 'Rich broth, loaded with vegetables and corn.', '2026-10-10'),
  ('de000000-0000-4000-8000-000000000230', 'de000000-0000-4000-8000-000000000116', null, 'Alex', true, 4, 'Come hungry.', '2026-10-03'),
  ('de000000-0000-4000-8000-000000000231', 'de000000-0000-4000-8000-000000000117', null, 'Priya', true, 4, 'Crispy bottoms, juicy filling.', '2026-10-10'),
  ('de000000-0000-4000-8000-000000000232', 'de000000-0000-4000-8000-000000000118', null, 'Mom', true, 5, 'Silky tofu in a light broth.', '2026-10-03'),
  ('de000000-0000-4000-8000-000000000233', 'de000000-0000-4000-8000-000000000119', null, 'Dad', true, 4, 'Good heat.', '2026-10-03'),
  ('de000000-0000-4000-8000-000000000234', 'de000000-0000-4000-8000-000000000119', null, 'Mom', false, 3, 'Too salty for me.', '2026-10-03'),
  ('de000000-0000-4000-8000-000000000235', 'de000000-0000-4000-8000-000000000120', null, 'Mom', true, 5, 'Flaky, sells out by 10am.', '2026-10-12'),
  ('de000000-0000-4000-8000-000000000236', 'de000000-0000-4000-8000-000000000120', null, 'Jordan', true, 5, 'Go early!', '2026-10-06'),
  ('de000000-0000-4000-8000-000000000237', 'de000000-0000-4000-8000-000000000121', null, 'Priya', true, 4, 'Huge and gooey.', '2026-10-06'),
  ('de000000-0000-4000-8000-000000000238', 'de000000-0000-4000-8000-000000000122', null, 'Dad', true, 4, 'Crispy, not greasy.', '2026-10-08'),
  ('de000000-0000-4000-8000-000000000239', 'de000000-0000-4000-8000-000000000123', null, 'Jordan', true, 4, 'Holds together, nice char.', '2026-10-08'),
  ('de000000-0000-4000-8000-000000000240', 'de000000-0000-4000-8000-000000000123', null, 'Sam', false, 2, 'Dry and bland.', '2026-09-27'),
  ('de000000-0000-4000-8000-000000000241', 'de000000-0000-4000-8000-000000000125', null, 'Mom', true, 4, 'Simple and fresh — ripe avocado, rice seasoned just right.', '2026-10-10'),
  ('de000000-0000-4000-8000-000000000242', 'de000000-0000-4000-8000-000000000125', null, 'Alex', true, 4, 'Good starter to share.', '2026-10-03'),
  ('de000000-0000-4000-8000-000000000243', 'de000000-0000-4000-8000-000000000126', null, 'Jordan', true, 5, 'Crispy sweet potato with a sweet soy glaze. My favorite roll here.', '2026-10-03'),
  ('de000000-0000-4000-8000-000000000244', 'de000000-0000-4000-8000-000000000126', null, 'Priya', true, 5, 'Warm, crunchy and sweet — order two.', '2026-10-10'),
  ('de000000-0000-4000-8000-000000000245', 'de000000-0000-4000-8000-000000000126', null, 'Dad', true, 4, null, '2026-10-03');

-- An earlier version of this script hid the real restaurants; make sure they're visible.
update public.restaurants set is_hidden = false where id in (
  '769c5743-13e4-405e-b58d-07b9d2dde157',
  '0451fa0e-c5d8-44f9-a1a4-05bb942eec24',
  '9946958d-8ec5-4c4e-8562-443a76a55309',
  'abdfdd58-03d3-4878-8b5b-d2fa739dc1d5',
  '292bd5e8-c840-43d3-9a55-8baa7296d882',
  '2b0020c3-7c22-4d8d-ad4e-a037a0e312cd',
  'f9a3c8be-fe65-4806-ad61-e97ac9da1f3d'
);
