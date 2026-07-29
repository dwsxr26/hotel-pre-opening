-- Florence Pre-Opening — payment status for service invoices + per-user export log.
-- Run this in the Supabase SQL editor after 0013_allowed_members.sql.

-- 1. Each service invoice ("actual") is still to be paid at the next payment
--    run, already settled by card, or paid by bank (the bookkeeper ticks this
--    once a payment run is settled, locking in the actual). Forecast rows ignore this.
alter table public.service_entries
  add column if not exists pay_status text not null default 'to_be_paid'
    check (pay_status in ('to_be_paid', 'paid_by_card', 'paid_by_bank'));

-- 2. Log of bookkeeper exports ("payment runs"). "Last download" for a user is
--    the most recent created_at among their own rows — used to offer an export
--    of only the invoices added since then. RLS scopes rows to their owner, so
--    each user's baseline is independent.
create table if not exists public.service_export_runs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null default auth.uid() references auth.users (id) on delete cascade,
  mode       text not null default 'all' check (mode in ('all', 'new')),
  count      integer not null default 0,
  created_at timestamptz not null default now()
);
create index if not exists service_export_runs_user_idx
  on public.service_export_runs (user_id, created_at desc);

alter table public.service_export_runs enable row level security;

drop policy if exists "service_export_runs read" on public.service_export_runs;
drop policy if exists "service_export_runs write" on public.service_export_runs;
create policy "service_export_runs read" on public.service_export_runs
  for select to authenticated using (user_id = auth.uid());
create policy "service_export_runs write" on public.service_export_runs
  for insert to authenticated with check (user_id = auth.uid());
