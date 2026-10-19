# Dish Diary

See which dishes people liked (and which to skip) at restaurants near you.
One Expo codebase runs as a website (Vercel) and as an iPhone app.

**Stack:** Expo + Expo Router (TypeScript) · Supabase (Postgres, anonymous auth, RLS) · Cloudflare Turnstile (CAPTCHA) · Vercel (web hosting)

## Project layout

```
src/app/                 screens (Expo Router: every file is a route)
  index.tsx              restaurant list, search, cuisine filter
  restaurant/new.tsx     add a restaurant
  restaurant/[id].tsx    dishes grouped Must try / Mixed / Skip (two panes on wide screens)
  dish/[id].tsx          one dish's reviews (phone)
  about.tsx              privacy + community rules
src/components/          UI pieces (app-shell = sidebar / bottom nav, turnstile, review form…)
src/lib/                 supabase client, auth, theme + breakpoints, types
supabase/schema.sql      tables, security rules, rate limits, auto-hide on reports
.github/workflows/       keep-alive ping so the free Supabase project doesn't pause
```

## Layout by screen width

| Width | Layout |
|---|---|
| < 700px (phone) | single column, bottom navigation |
| 700–1099px (tablet) | sidebar; restaurant page shows dish list + reviews side by side |
| ≥ 1100px (desktop) | same, restaurant cards in 3 columns, content capped at 1100px |

Breakpoints live in `src/lib/theme.ts` (`useBreakpoint`).

## One-time setup

1. **Database:** Supabase → SQL Editor → New query → paste `supabase/schema.sql` → Run.
2. **Auth:** Supabase → Authentication → enable *Anonymous sign-ins* and *CAPTCHA (Turnstile)* with your Turnstile **secret** key.
3. **Keys:** fill in `.env` (copied from `.env.example`). Only public keys go here.
4. **Existing projects only:** run any files in `supabase/migrations/` that you haven't run yet
   (SQL Editor → paste → Run). `schema.sql` already includes them for new projects.

## Restaurant lookup

"Find the restaurant" on the add form searches [Photon](https://photon.komoot.io)
(free OpenStreetMap search by komoot — no key or account). Results are limited to ~30 km
around the visitor when they share location, falling back to everywhere if nothing matches.
Picking a result fills name, street and city and stores the OpenStreetMap id (`osm_id`) so the
same place can't be added twice. The public instance is fair-use and throttles heavy traffic;
results must stay credited "© OpenStreetMap contributors". Code: `src/lib/place-lookup.ts`.

## Run locally

```bash
npm install
npx expo start        # press w for web, or scan the QR code with Expo Go on your iPhone
```

## Deploy the website (Vercel)

1. Push this repo to GitHub.
2. Vercel → Add New → Project → import the repo (settings come from `vercel.json`).
3. Vercel → Project → Settings → Environment Variables: add the `EXPO_PUBLIC_*` values from `.env`.
4. Add the Vercel hostname to your Turnstile widget's hostname list.

## Keep Supabase awake

GitHub repo → Settings → Secrets and variables → Actions → add `SUPABASE_URL` and `SUPABASE_KEY`.
The workflow pings the database every 3 days. (GitHub disables scheduled workflows after 60 days
without commits — re-enable it from the Actions tab if that happens.)

## Install on your own iPhone (free, by cable)

Needs Xcode + CocoaPods. With the phone plugged in and Developer Mode on:

```bash
npx expo run:ios --device --configuration Release
```

Free Apple IDs: the app expires after 7 days; re-run to reinstall.

## Admin mode

Admins sign in at `/admin` (link at the bottom of About) with an emailed sign-in link, then see
Edit / Hide / Delete on every restaurant, dish and review (hidden ones too, with a badge), a
Reports list, and **Download Excel file** (one workbook: Restaurants, Dishes, Reviews, Reports;
web only). Code: `src/app/admin.tsx`, `src/components/admin-tools.tsx`, `src/lib/export.ts`.

Setup (once):
1. Run `supabase/migrations/003_admin.sql` in the SQL Editor.
2. Authentication → **URL Configuration**: Site URL = the Vercel address; add
   `https://<your-site>/**` and `http://localhost:8081/**` under Redirect URLs.
   (Supabase's default email template is used as-is — free projects can't edit it.)
3. Authentication → Users → **Add user → Create new user** with your email (auto-confirm on).
   Supabase's built-in email only delivers to your project team's addresses and a few per hour.
4. SQL Editor: `insert into public.admins (user_id) select id from auth.users where email = 'you@example.com';`

Only accounts in `public.admins` get admin rights; the sign-in never creates accounts.

## Moderation

- Reports: Supabase → Table Editor → `reports`.
- Anything reported by 3 different people is hidden automatically (`is_hidden = true`). Set it back to `false` to restore.
