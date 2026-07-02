-- Florence Pre-Opening — make departments a shared, editable list (like categories)
-- Run this in the Supabase SQL editor after 0005_attachments.sql.

create table if not exists public.departments (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- Seed the six defaults.
insert into public.departments (name)
values ('Marketing'), ('Legal'), ('HR'), ('OS&E'), ('F&B'), ('Corporate')
on conflict (name) do nothing;

alter table public.departments enable row level security;

drop policy if exists "departments read"   on public.departments;
drop policy if exists "departments insert" on public.departments;
drop policy if exists "departments update" on public.departments;
drop policy if exists "departments delete" on public.departments;
create policy "departments read"   on public.departments for select to authenticated using (true);
create policy "departments insert" on public.departments for insert to authenticated with check (true);
create policy "departments update" on public.departments for update to authenticated using (true) with check (true);
create policy "departments delete" on public.departments for delete to authenticated using (true);
