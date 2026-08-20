-- Florence Pre-Opening — over-budget (overspend) approval workflow for Services.
-- Run this in the Supabase SQL editor after 0016_item_budget_admin.sql.
--
-- When an invoice pushes a service line's reforecast over its budget and the
-- overspend isn't self-rebalanced (by reducing that line's own future forecast),
-- the invoice is still saved and a PENDING overspend approval is recorded for
-- that (line, month). The month cannot be closed until an admin approves it, via
-- one of two routes:
--   1. 'reallocated' — cut budget from one or more other lines; the total cut is
--      added back onto the over-budget line (a reallocation, project total flat).
--   2. 'accepted'    — a true overspend with a written reason.
-- History (who approved which month, why, and any reductions) is surfaced in the
-- app on the reforecast cell.

-- ---------------------------------------------------------------------------
-- 1. Tables
-- ---------------------------------------------------------------------------
create table if not exists public.service_overspend_approvals (
  id               uuid primary key default gen_random_uuid(),
  line_id          uuid not null references public.service_lines (id) on delete cascade,
  month            date not null,
  status           text not null default 'pending' check (status in ('pending', 'approved')),
  overspend_amount numeric not null default 0,          -- ex VAT, at request time
  method           text check (method in ('reallocated', 'accepted')),
  note             text not null default '',
  requested_by     uuid references auth.users (id),
  requested_at     timestamptz not null default now(),
  approved_by      uuid references auth.users (id),
  approved_at      timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (line_id, month)
);

create table if not exists public.service_overspend_reductions (
  id          uuid primary key default gen_random_uuid(),
  approval_id uuid not null references public.service_overspend_approvals (id) on delete cascade,
  line_id     uuid not null references public.service_lines (id) on delete cascade,  -- the line reduced
  amount      numeric not null default 0,
  created_at  timestamptz not null default now()
);
create index if not exists overspend_reductions_approval_idx
  on public.service_overspend_reductions (approval_id);

drop trigger if exists overspend_approvals_set_updated_at on public.service_overspend_approvals;
create trigger overspend_approvals_set_updated_at before update on public.service_overspend_approvals
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- 2. Block closing a month that has an unapproved overspend
-- ---------------------------------------------------------------------------
create or replace function public.block_close_pending_overspend()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if exists (
    select 1 from public.service_overspend_approvals a
    where a.line_id = new.line_id and a.month = new.month and a.status = 'pending'
  ) then
    raise exception 'This month has an unapproved overspend — an admin must approve it before the month can be closed';
  end if;
  return new;
end $$;

drop trigger if exists service_close_block_overspend on public.service_month_close;
create trigger service_close_block_overspend
  before insert or update on public.service_month_close
  for each row execute function public.block_close_pending_overspend();

-- ---------------------------------------------------------------------------
-- 3. Approve an overspend atomically (admin only). For 'reallocated', p_reductions
--    is a JSON array of { "line_id": uuid, "amount": number }: each line's budget
--    is cut by amount, and the total is added onto the over-budget line's budget.
-- ---------------------------------------------------------------------------
create or replace function public.approve_overspend(
  p_line_id uuid, p_month date, p_method text, p_note text, p_reductions jsonb default '[]'::jsonb
) returns void language plpgsql security definer set search_path = public as $$
declare
  r          record;
  v_total    numeric := 0;
  v_approval uuid;
begin
  if not public.is_admin() then
    raise exception 'Only admins can approve an overspend';
  end if;
  if p_method not in ('reallocated', 'accepted') then
    raise exception 'Unknown approval method %', p_method;
  end if;

  select id into v_approval from public.service_overspend_approvals
    where line_id = p_line_id and month = p_month;
  if v_approval is null then
    raise exception 'No overspend request found for this line/month';
  end if;

  if p_method = 'reallocated' then
    for r in select * from jsonb_to_recordset(coalesce(p_reductions, '[]'::jsonb))
             as x(line_id uuid, amount numeric)
    loop
      if r.amount is null or r.amount <= 0 or r.line_id is null then continue; end if;
      insert into public.service_overspend_reductions (approval_id, line_id, amount)
        values (v_approval, r.line_id, r.amount);
      update public.service_lines set budget = budget - r.amount where id = r.line_id;
      v_total := v_total + r.amount;
    end loop;
    if v_total > 0 then
      update public.service_lines set budget = budget + v_total where id = p_line_id;
    end if;
  end if;

  update public.service_overspend_approvals
    set status = 'approved', method = p_method, note = coalesce(p_note, ''),
        approved_by = auth.uid(), approved_at = now()
    where id = v_approval;
end $$;

grant execute on function public.approve_overspend(uuid, date, text, text, jsonb) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. RLS — members read; members create the pending request; admins approve.
-- ---------------------------------------------------------------------------
alter table public.service_overspend_approvals enable row level security;
alter table public.service_overspend_reductions enable row level security;

drop policy if exists "overspend read"          on public.service_overspend_approvals;
drop policy if exists "overspend insert"        on public.service_overspend_approvals;
drop policy if exists "overspend member repending" on public.service_overspend_approvals;
drop policy if exists "overspend admin update"  on public.service_overspend_approvals;
drop policy if exists "overspend admin delete"  on public.service_overspend_approvals;
create policy "overspend read" on public.service_overspend_approvals
  for select to authenticated using (public.is_member());
create policy "overspend insert" on public.service_overspend_approvals
  for insert to authenticated with check (public.is_member());
-- Members may re-save a still-pending request (upsert -> update), but can never
-- touch an approved row or set the status to approved themselves.
create policy "overspend member repending" on public.service_overspend_approvals
  for update to authenticated
  using (public.is_member() and status = 'pending')
  with check (public.is_member() and status = 'pending');
-- Approval itself runs through the SECURITY DEFINER approve_overspend() function;
-- this admin policy covers any direct correction.
create policy "overspend admin update" on public.service_overspend_approvals
  for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy "overspend admin delete" on public.service_overspend_approvals
  for delete to authenticated using (public.is_admin());

drop policy if exists "overspend reductions read"  on public.service_overspend_reductions;
drop policy if exists "overspend reductions admin" on public.service_overspend_reductions;
create policy "overspend reductions read" on public.service_overspend_reductions
  for select to authenticated using (public.is_member());
create policy "overspend reductions admin" on public.service_overspend_reductions
  for all to authenticated using (public.is_admin()) with check (public.is_admin());
