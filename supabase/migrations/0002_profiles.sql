-- Florence Pre-Opening — team profiles
-- Run this in the Supabase SQL editor after 0001_init.sql.
--
-- Each signed-in teammate gets a profile with their first and last name.
-- The app shows them as "First L." (e.g. "Diederik S.") in the Owner dropdown.

create table if not exists public.profiles (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  email      text,
  first_name text not null default '',
  last_name  text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Reuse the updated_at trigger function created in 0001.
drop trigger if exists profiles_set_updated_at on public.profiles;
create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

alter table public.profiles enable row level security;

-- Everyone signed in can read all profiles (to populate the Owner dropdown)...
create policy "profiles: authenticated read" on public.profiles
  for select to authenticated using (true);

-- ...but can only create / edit their own.
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
