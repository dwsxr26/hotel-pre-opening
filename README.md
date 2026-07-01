# Florence Pre-Opening

Shared pre-opening spend & order tracker for The Usual · Florence. Vite + React
front end, Supabase (Postgres + Auth) backend, deployed on Vercel — same stack
as our other apps.

## What it does

- **Orders grid** — 508 seeded line items. Click any header to **sort**; click
  the funnel icon to **filter** (checkbox list for categorical columns, contains
  search for free-text ones). Drag a header's grip to **reorder** columns, drag
  its right edge to **resize**. **Package** and **Item** stay pinned while you
  scroll right.
- **Per-user views** — each person's sort, filters, column widths and order are
  saved to their own account (`view_prefs` table). Changing your view never
  affects anyone else's.
- **Editing** — Owner, Status, Qty, Supplier, Invoice/order no., Est. arrival and
  Description edit inline with no prompt. **Package, Item, Category and Unit price
  require a confirmation** before saving.
- **Department** — dropdown (Marketing, Legal, HR, OS&E, F&B, Corporate),
  auto-allocated from category/item at seed time and overridable per row.
- **Category** — dropdown with an inline **“+ Add new category…”** that creates
  the category for the whole team.
- **Formatting** — €0 shows as `-`; empty arrival dates show only a calendar icon.
- **Summaries** — “Summary by owner” and “Summary by supplier” tabs with totals
  and a per-status breakdown.

## One-time setup

1. **Create a Supabase project** (https://supabase.com → New project).
2. In the project's **SQL Editor**, paste and run
   [`supabase/migrations/0001_init.sql`](supabase/migrations/0001_init.sql).
   This creates the `items`, `categories` and `view_prefs` tables with RLS.
3. In **Authentication → Providers**, make sure **Email** is enabled (magic link).
4. Copy `.env.example` to `.env.local` and fill in, from **Project Settings → API**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (the `anon` / publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (the `service_role` key — used only by the seed
     script, never shipped to the browser)
5. **Seed the data:** `npm install` then `npm run seed`. This loads the 508 items
   and their categories.

## Run locally

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173`, sign in with your email (magic link),
and you're in.

## Deploy to Vercel

- Import the repo in Vercel. Framework preset: **Vite**. Build: `npm run build`,
  output: `dist`.
- Add the two `VITE_` env vars in the Vercel project settings (do **not** add the
  service-role key there).
- Add your Vercel URL to Supabase **Authentication → URL Configuration** (Site URL
  + redirect URLs) so magic links redirect back correctly.

## Project layout

```
supabase/migrations/0001_init.sql   schema + RLS
supabase/seed/items.json            the 508 rows (extracted from the sketch)
scripts/seed.mjs                    loads items + categories into Supabase
src/lib/format.js                   money (€0 → "-") + date formatting
src/lib/departments.js              category/item → department allocation
src/data/*                          Supabase CRUD (items, categories, viewPrefs)
src/hooks/*                         useAuth, useViewPrefs
src/components/OrdersTable.jsx      the TanStack data grid
src/components/cells/*              per-column editors
src/components/Summary.jsx          owner & supplier summaries
```
