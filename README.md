# Florence Pre-Opening

Shared pre-opening spend & order tracker for The Usual · Florence. Vite + React
front end, Supabase (Postgres + Auth + Storage) backend, deployed on Vercel —
same stack as our other apps. Invite-only, real-time collaborative.

## What it does

Two tabs:

### OS&E Orders — the line-item grid
- Click any header to **sort**; click the funnel to **filter** (checkbox list
  for categorical columns, contains-search for free-text ones). Drag a header's
  grip to **reorder** columns, drag its right edge to **resize**. **Package** and
  **Item** stay pinned while you scroll right.
- **Per-user views** — each person's sort, filters, column widths and order are
  saved to their own account (`view_prefs` table). Changing your view never
  affects anyone else's.
- **Editing** — Owner, Status, Qty, Supplier, Invoice/order no., dates and
  Description edit inline with no prompt. **Package, Item, Category and Unit
  price require a confirmation** before saving.
- **Invoices** — the last column holds one invoice/receipt per line item
  (Description / payment status / ex-VAT / VAT % / total + one evidence file).
  There is exactly one invoice per line: if a package is split across suppliers,
  add a new line and an admin re-budgets it. The grid shows an
  **Invoiced (ex VAT)** column and a live total, and the Metrics panel rolls
  invoices into an **Invoiced** figure.
- **Budget** — the per-line locked budget is **admin-only**: admins edit it
  (with a confirmation), everyone else sees it read-only. Enforced in the DB.
- **Department** — dropdown, auto-allocated from category/item at seed time and
  overridable per row.
- **Category** — dropdown with an inline **"+ Add new category…"** that creates
  the category for the whole team.
- **Formatting** — €0 shows as `-`; empty dates show only a calendar icon.

### Overview — the monthly services/opex forecast
- Per-line monthly forecast vs. invoices across Jan-2025 → Sep-2027, with
  month-close (cancel / roll-forward / rebalance) and an Excl/Incl-VAT toggle.
- **Overspend approvals** — if an invoice pushes a line over budget and isn't
  self-rebalanced, it still saves and the month goes **yellow** (pending). The
  month can't be closed until an **admin** approves it — either by reallocating
  budget from other lines (which updates those lines) or accepting the overspend
  with a written reason. A flag on the Reforecast cell opens the full history.

### Payment run (bookkeeper export)
- The Overview toolbar's **Payment run** button zips a summary CSV plus every
  evidence file for all invoices marked **To be paid** — across **both** the
  services forecast and OS&E order invoices (a `Source` column distinguishes
  them) — or only those added since your last download.

## One-time setup

1. **Create a Supabase project** (https://supabase.com → New project).
2. In the project's **SQL Editor**, run the migrations in
   [`supabase/migrations/`](supabase/migrations/) **in order**, `0001…0018`.
   They create every table with RLS, the file-attachment bucket, the invite
   allowlist, the invoice table, the admin-only budget guard and the overspend-approval workflow.
3. In **Authentication → Providers**, make sure **Email** is enabled (magic link
   and password). Wire the "Before User Created" hook from `0013` to gate signup
   to the allowlist.
4. Copy `.env.example` to `.env.local` and fill in, from **Project Settings → API**:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_PUBLISHABLE_KEY` (the `anon` / publishable key)
   - `SUPABASE_SERVICE_ROLE_KEY` (the `service_role` key — used only by the
     seed/export scripts, never shipped to the browser)
5. **Seed the data:** `npm install`, then `npm run seed` (OS&E items +
   categories) and `npm run seed:services` (the services budget lines).

## Run locally

```bash
npm install
npm run dev
```

Open the printed `http://localhost:5173`, sign in with your email, and you're in.

## Commands

```bash
npm run dev              # local dev server
npm run build            # production build → dist/
npm run lint             # eslint
npm run seed             # load supabase/seed/items.json into the items table
npm run seed:services    # load supabase/seed/services.json into service_lines
npm run export:evidence  # download all evidence (order + service invoices) + manifest.csv
```

There is no test suite — verify changes with `npm run lint` and by running the app.

## Deploy to Vercel

- Import the repo in Vercel. Framework preset: **Vite**. Build: `npm run build`,
  output: `dist`.
- Add the two `VITE_` env vars in the Vercel project settings (do **not** add the
  service-role key there).
- Add your Vercel URL to Supabase **Authentication → URL Configuration** (Site URL
  + redirect URLs) so magic links redirect back correctly.
- Pushing to `main` deploys automatically.

## Project layout

```
supabase/migrations/*               schema + RLS, numbered 0001…0018
supabase/seed/*                     seed JSON for items + services
scripts/*                           seed + evidence-export scripts
src/lib/*                           pure logic (format, departments, serviceCalc, csv…)
src/data/*                          Supabase CRUD (one module per table/domain)
src/hooks/*                         useAuth, useViewPrefs
src/components/OrdersTable.jsx      the TanStack data grid
src/components/cells/*              per-column editors (incl. InvoicesCell)
src/components/InvoicesModal.jsx    per-line invoice editor
src/components/services/*           the whole Overview module + payment run
```
