-- Florence Pre-Opening — admin role
-- Run this in the Supabase SQL editor after 0007_services.sql.
--
-- Admins can edit service budgets/owners and promote other admins. Diederik is
-- seeded as the first admin.

alter table public.profiles add column if not exists is_admin boolean not null default false;
update public.profiles set is_admin = true where lower(email) = 'dschol@crossroadsre.com';

-- SECURITY DEFINER helper so admin-checking policies don't recurse on profiles.
create or replace function public.is_admin()
returns boolean language sql security definer stable set search_path = public as $$
  select coalesce((select is_admin from public.profiles where user_id = auth.uid()), false)
$$;

-- Admins may update any profile (e.g. toggle is_admin). Own-row update policy
-- from 0002 still applies for everyone else.
drop policy if exists "profiles: admin update all" on public.profiles;
create policy "profiles: admin update all" on public.profiles
  for update to authenticated using (public.is_admin()) with check (true);
