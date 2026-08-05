-- Florence Pre-Opening — invoices for OS&E order line items.
-- Run this in the Supabase SQL editor after 0014_service_pay_status.sql.
--
-- Like the Services module's invoices (service_entries of type 'invoice') —
-- amount, VAT %, payment status and one evidence file (stored in the
-- attachments bucket) — but exactly ONE invoice per order line (unique item_id).
-- If a package is split across suppliers, the team adds a new line and an admin
-- re-budgets it, so each line carries its own single receipt. These feed the
-- combined bookkeeper "payment run" export alongside the service invoices.

create table if not exists public.item_invoices (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null unique references public.items (id) on delete cascade,
  title         text not null default '',
  amount_ex_vat numeric not null default 0,
  vat_pct       numeric not null default 22,
  pay_status    text not null default 'to_be_paid'
                  check (pay_status in ('to_be_paid', 'paid_by_card', 'paid_by_bank')),
  file_path     text,
  file_name     text,
  uploaded_by   uuid references auth.users (id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);
-- The unique constraint on item_id already provides the lookup index.

-- updated_at trigger (function created in 0001).
drop trigger if exists item_invoices_set_updated_at on public.item_invoices;
create trigger item_invoices_set_updated_at before update on public.item_invoices
  for each row execute function public.set_updated_at();

-- RLS: any invited team member has full access (same model as items /
-- service_entries after 0013). is_member() was created in 0013.
alter table public.item_invoices enable row level security;

drop policy if exists "item_invoices member select" on public.item_invoices;
drop policy if exists "item_invoices member insert" on public.item_invoices;
drop policy if exists "item_invoices member update" on public.item_invoices;
drop policy if exists "item_invoices member delete" on public.item_invoices;

create policy "item_invoices member select" on public.item_invoices
  for select to authenticated using (public.is_member());
create policy "item_invoices member insert" on public.item_invoices
  for insert to authenticated with check (public.is_member());
create policy "item_invoices member update" on public.item_invoices
  for update to authenticated using (public.is_member()) with check (public.is_member());
create policy "item_invoices member delete" on public.item_invoices
  for delete to authenticated using (public.is_member());
