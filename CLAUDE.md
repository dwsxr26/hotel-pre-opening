# CLAUDE.md

Guidance for Claude Code (and humans) working in this repo.

## What this is

**Florence Pre-Opening** — a shared pre-opening spend & order tracker for the
hotel *The Usual · Florence*. A small team uses it to track OS&E procurement
(line items, orders, arrivals) and a monthly services/opex forecast against
budget. Single-page app, real-time collaborative, invite-only.

## Stack

- **Vite 8 + React 19** (plain JSX, no TypeScript), plain CSS (no framework).
- **Supabase**: Postgres + Auth (magic link *and* password) + Row-Level
  Security + Realtime + Storage (file attachments).
- **@tanstack/react-table** + **@tanstack/react-virtual** for the orders grid.
- **lucide-react** icons, **@fontsource/inter** for type.
- Deployed on **Vercel** (Vite preset, build → `dist`).

**Workflow**: solo builder for now — work on `main`, and pushing to `main`
deploys to Vercel automatically. No PR/preview step. So a push is a release:
run `npm run build` locally first if a change is risky.

Shared conventions with two sibling apps (`my-pipeline`, `my-tasks`): same
stack, same data-layer shape, same env-var names.

## Commands

```bash
npm run dev              # local dev server (http://localhost:5173)
npm run build            # production build → dist/
npm run lint             # eslint
npm run seed             # load supabase/seed/items.json into the items table
npm run seed:services    # load supabase/seed/services.json into service_lines
npm run export:evidence  # download all attachments + manifest.csv into evidence/
```

There is **no test suite**. Verify changes with `npm run lint` and by running
the app.

## Environment

Copy `.env.example` → `.env.local`:

- `VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY` — browser (Vite exposes
  only `VITE_`-prefixed vars). These two also go in Vercel project settings.
- `SUPABASE_SERVICE_ROLE_KEY` — **server-side only**, used by the seed/export
  scripts. Never ship it to the browser or add it to Vercel.

## Architecture

Single-page app; [src/App.jsx](src/App.jsx) is the hub. It holds all top-level
state, loads data, wires the two tabs, and owns cross-cutting behaviour (undo
stack, optimistic edits, realtime refresh).

**Two tabs** (`TABS` in App.jsx):
- `orders` — labelled **"OS&E Orders"**: the big line-item grid.
- `services` — labelled **"Overview"**: the monthly services forecast.

### Layers

- **`src/data/*`** — the only place that talks to Supabase. One module per
  table/domain (`items`, `categories`, `departments`, `profiles`, `members`,
  `attachments`, `services`, `viewPrefs`). Each exports plain async CRUD
  functions that `throw` on error; callers handle the error. See
  [src/data/items.js](src/data/items.js) for the canonical shape (a shared
  `COLUMNS` string, `fetch/update/add/updateMany/delete`, plus a realtime
  `subscribe*` returning an unsubscribe fn).
- **`src/lib/*`** — pure logic, no React, no Supabase:
  - [format.js](src/lib/format.js) — money (`€0` → `"-"`) and date formatting.
  - [departments.js](src/lib/departments.js) — `DEPARTMENTS` list +
    `allocateDepartment()` (best-effort category→department at seed time;
    overridable per row in the UI).
  - [serviceCalc.js](src/lib/serviceCalc.js) — the services forecast engine:
    `SERVICE_MONTHS` axis (Jan-2025 → Sep-2027), `PAST_CUTOFF` (Jun-2026),
    `computeLine()` / `aggregate()`. Invoices consume forecast; a closed month
    counts only what was invoiced.
  - [constants.js](src/lib/constants.js) — `STATUSES`, colours, filterable
    columns, `CONFIRM_EDIT_COLUMNS`, `PINNED_COLUMNS`, `DEFAULT_COLUMN_ORDER`,
    `COLUMNS_VERSION`.
  - [filtering.js](src/lib/filtering.js), [people.js](src/lib/people.js),
    [csv.js](src/lib/csv.js).
- **`src/hooks/*`** — `useAuth` (session), `useViewPrefs` (per-user grid state
  persisted to the `view_prefs` table via RLS).
- **`src/components/*`** — presentational + interactive UI.
  `components/cells/*` are the per-column inline editors for the orders grid;
  `components/services/*` is the whole Overview module.

### Data model (Supabase)

Migrations live in `supabase/migrations/`, numbered `0001…0014`, applied in
order via the Supabase SQL editor. Key tables: `items`, `categories`,
`departments`, `view_prefs`, `profiles`, `allowed_members` (invite allowlist),
`attachments`, `service_lines`, `service_entries`, `service_month_close`,
`service_export_runs` (per-user payment-run log). RLS is on everywhere.
Admin-only writes are enforced in SQL (client shows an alert on the resulting
error — never trust the client for authz).

## Conventions & gotchas

- **Optimistic edits everywhere**: update local state first, call Supabase, and
  revert + `alert()` on error. Single edits also push an **undo** entry
  (Ctrl/Cmd+Z, last 30 actions) — see `onEdit`/`onBulkEdit`/`undo` in App.jsx.
- **Confirm-before-save columns**: `package`, `item`, `category`, `unit_price`
  require a confirmation dialog (`CONFIRM_EDIT_COLUMNS`). Everything else edits
  inline with no prompt.
- **Graceful degradation on missing migrations**: services data and the
  allowlist load in their own `try/catch` so an un-run migration (0007, 0013)
  degrades that feature instead of breaking the Orders tab. Preserve this when
  touching load logic.
- **`COLUMNS_VERSION`**: bump it whenever `DEFAULT_COLUMN_ORDER` changes — saved
  per-user views with an older version get their column order/sizing reset.
- **Realtime**: `subscribeItems` triggers a full reload when a teammate edits.
- **Money**: forecast/budget stored **ex-VAT**; default VAT 22%. Prefer
  `Math.round` to cents to avoid floating-point `€0.00` showing as non-zero
  (see recent commits on this).
- **Payment run**: service invoices carry a `pay_status` (`to_be_paid` /
  `paid_by_card` / `paid_by_bank`; only `to_be_paid` is exported, so ticking an
  invoice paid drops it from the next run). The Overview toolbar's "Payment run"
  button
  ([PaymentRunModal](src/components/services/PaymentRunModal.jsx) →
  [paymentRun.js](src/data/paymentRun.js)) zips a summary CSV + evidence files
  for all `to_be_paid` invoices, or only those added since the current user's
  last export (tracked in `service_export_runs`). Uses `fflate` for zipping.
- **Windows / PowerShell** is the primary shell here; a Bash tool is also
  available for POSIX scripts.

## Source spreadsheets

The app was originally seeded from Excel models. Those files are **no longer
used** by the app — the database is the source of truth and the seed JSON lives
in `supabase/seed/`. Do not reintroduce spreadsheet files as a data source.
