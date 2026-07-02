-- Florence Pre-Opening — file attachments (PDF invoices, order-confirmation emails)
-- Run this in the Supabase SQL editor after 0004_order_fields.sql.
--
-- Files live in Supabase Storage (the `attachments` bucket), NOT in the database
-- or the grid, so the table stays fast. The tables below only hold small
-- metadata rows. A file can be linked to many line items (many-to-many).

-- 1. Private storage bucket for the files.
insert into storage.buckets (id, name, public)
values ('attachments', 'attachments', false)
on conflict (id) do nothing;

-- 2. Metadata + link tables.
create table if not exists public.attachments (
  id           uuid primary key default gen_random_uuid(),
  path         text not null,
  filename     text not null,
  size         bigint,
  content_type text,
  uploaded_by  uuid references auth.users (id),
  created_at   timestamptz not null default now()
);

create table if not exists public.item_attachments (
  item_id       uuid not null references public.items (id) on delete cascade,
  attachment_id uuid not null references public.attachments (id) on delete cascade,
  primary key (item_id, attachment_id)
);
create index if not exists item_attachments_item_idx on public.item_attachments (item_id);

-- 3. RLS: any signed-in team member can read/add/remove.
alter table public.attachments enable row level security;
alter table public.item_attachments enable row level security;

drop policy if exists "attachments read"   on public.attachments;
drop policy if exists "attachments insert" on public.attachments;
drop policy if exists "attachments delete" on public.attachments;
create policy "attachments read"   on public.attachments for select to authenticated using (true);
create policy "attachments insert" on public.attachments for insert to authenticated with check (true);
create policy "attachments delete" on public.attachments for delete to authenticated using (true);

drop policy if exists "item_attachments read"   on public.item_attachments;
drop policy if exists "item_attachments insert" on public.item_attachments;
drop policy if exists "item_attachments delete" on public.item_attachments;
create policy "item_attachments read"   on public.item_attachments for select to authenticated using (true);
create policy "item_attachments insert" on public.item_attachments for insert to authenticated with check (true);
create policy "item_attachments delete" on public.item_attachments for delete to authenticated using (true);

-- 4. Storage object policies for the bucket (signed-in team members).
drop policy if exists "attachments objects read"   on storage.objects;
drop policy if exists "attachments objects insert" on storage.objects;
drop policy if exists "attachments objects delete" on storage.objects;
create policy "attachments objects read"   on storage.objects for select to authenticated using (bucket_id = 'attachments');
create policy "attachments objects insert" on storage.objects for insert to authenticated with check (bucket_id = 'attachments');
create policy "attachments objects delete" on storage.objects for delete to authenticated using (bucket_id = 'attachments');
