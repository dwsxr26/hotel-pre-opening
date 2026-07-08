-- Florence Pre-Opening — Services module (contracts/service budgets over time)
-- Run this in the Supabase SQL editor after 0006_departments.sql, then run
--   npm run seed:services
-- to load the 64 budget lines + their monthly forecasts from the Excel model.

-- New shared departments used by Services (and available to Orders too).
insert into public.departments (name) values ('IT'), ('General')
on conflict (name) do nothing;

-- Budget lines (one per service/contract line item).
create table if not exists public.service_lines (
  id         uuid primary key default gen_random_uuid(),
  name       text not null default '',
  department text not null default 'General',
  owner      text not null default '',
  budget     numeric not null default 0,   -- original budget (fixed)
  sort_index integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Monthly breakdown entries: forecast lines and actual invoices.
-- Multiple per (line, month). Invoices may carry a file (in the attachments bucket).
create table if not exists public.service_entries (
  id            uuid primary key default gen_random_uuid(),
  line_id       uuid not null references public.service_lines (id) on delete cascade,
  month         date not null,                       -- first day of the month
  type          text not null default 'forecast' check (type in ('forecast', 'invoice')),
  title         text not null default '',
  amount_ex_vat numeric not null default 0,
  vat_pct       numeric not null default 22,
  file_path     text,
  file_name     text,
  uploaded_by   uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
create index if not exists service_entries_line_idx on public.service_entries (line_id);
create index if not exists service_entries_line_month_idx on public.service_entries (line_id, month);

-- Per line-per-month "close" state (all invoices added → cancel or roll forward).
create table if not exists public.service_month_close (
  id          uuid primary key default gen_random_uuid(),
  line_id     uuid not null references public.service_lines (id) on delete cascade,
  month       date not null,
  disposition text not null default 'cancelled' check (disposition in ('cancelled', 'rolled')),
  created_at  timestamptz not null default now(),
  unique (line_id, month)
);

-- updated_at triggers (function created in 0001).
drop trigger if exists service_lines_set_updated_at on public.service_lines;
create trigger service_lines_set_updated_at before update on public.service_lines
  for each row execute function public.set_updated_at();
drop trigger if exists service_entries_set_updated_at on public.service_entries;
create trigger service_entries_set_updated_at before update on public.service_entries
  for each row execute function public.set_updated_at();

-- RLS: any signed-in team member has full access (same model as items).
alter table public.service_lines enable row level security;
alter table public.service_entries enable row level security;
alter table public.service_month_close enable row level security;

do $$
declare t text;
begin
  foreach t in array array['service_lines', 'service_entries', 'service_month_close'] loop
    execute format('drop policy if exists "%s read" on public.%I', t, t);
    execute format('drop policy if exists "%s write" on public.%I', t, t);
    execute format('drop policy if exists "%s update" on public.%I', t, t);
    execute format('drop policy if exists "%s delete" on public.%I', t, t);
    execute format('create policy "%s read" on public.%I for select to authenticated using (true)', t, t);
    execute format('create policy "%s write" on public.%I for insert to authenticated with check (true)', t, t);
    execute format('create policy "%s update" on public.%I for update to authenticated using (true) with check (true)', t, t);
    execute format('create policy "%s delete" on public.%I for delete to authenticated using (true)', t, t);
  end loop;
end $$;
