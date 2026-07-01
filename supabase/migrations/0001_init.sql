-- Florence Pre-Opening — initial schema
-- Run this in the Supabase SQL editor (or via the CLI) on a fresh project.
--
-- Model:
--   items        shared procurement list. Any signed-in team member reads & edits.
--   categories   shared category list, so "add new category" persists for everyone.
--   view_prefs   PER-USER view state (sort / filters / column widths & order).
--                Only the owning user can read or write their own row.

-- ---------------------------------------------------------------------------
-- Extensions
-- ---------------------------------------------------------------------------
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Categories (shared)
-- ---------------------------------------------------------------------------
create table if not exists public.categories (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Items (shared)
-- ---------------------------------------------------------------------------
create table if not exists public.items (
  id           uuid primary key default gen_random_uuid(),
  package      text not null default '',
  item         text not null default '',
  category     text not null default '',
  department   text not null default 'OS&E',
  owner        text not null default '',
  status       text not null default 'Not ordered',
  qty          numeric not null default 0,
  unit_price   numeric not null default 0,
  supplier     text not null default '',
  order_no     text not null default '',
  est_arrival  date,
  ref          text not null default '',
  sort_index   integer not null default 0,   -- preserves the original sheet order
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists items_sort_index_idx on public.items (sort_index);

-- Keep updated_at fresh on every write.
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

drop trigger if exists items_set_updated_at on public.items;
create trigger items_set_updated_at
  before update on public.items
  for each row execute function public.set_updated_at();

-- ---------------------------------------------------------------------------
-- Per-user view preferences
-- ---------------------------------------------------------------------------
create table if not exists public.view_prefs (
  user_id    uuid not null references auth.users (id) on delete cascade,
  key        text not null default 'orders',   -- room for more views later
  value      jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.categories enable row level security;
alter table public.items      enable row level security;
alter table public.view_prefs enable row level security;

-- Categories & items: any authenticated team member has full access.
create policy "categories: authenticated read"   on public.categories for select to authenticated using (true);
create policy "categories: authenticated write"  on public.categories for insert to authenticated with check (true);
create policy "categories: authenticated update" on public.categories for update to authenticated using (true) with check (true);
create policy "categories: authenticated delete" on public.categories for delete to authenticated using (true);

create policy "items: authenticated read"   on public.items for select to authenticated using (true);
create policy "items: authenticated write"  on public.items for insert to authenticated with check (true);
create policy "items: authenticated update" on public.items for update to authenticated using (true) with check (true);
create policy "items: authenticated delete" on public.items for delete to authenticated using (true);

-- View prefs: each user only ever touches their own row.
create policy "view_prefs: own read"   on public.view_prefs for select to authenticated using (auth.uid() = user_id);
create policy "view_prefs: own insert" on public.view_prefs for insert to authenticated with check (auth.uid() = user_id);
create policy "view_prefs: own update" on public.view_prefs for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "view_prefs: own delete" on public.view_prefs for delete to authenticated using (auth.uid() = user_id);
