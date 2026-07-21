-- Florence Pre-Opening — invite-only access
-- Run this in the Supabase SQL editor after 0012_item_budget.sql.
--
-- Until now every signed-in user had full read/write/delete on all data, and
-- anyone could give themselves an account via the magic link. This migration:
--   1. adds an allowlist of email addresses that admins manage from the app,
--   2. seeds it with EVERY existing account so nobody currently using the app
--      is locked out,
--   3. adds a signup gate (wired up as a "Before User Created" auth hook) so a
--      stranger cannot create an account,
--   4. re-gates every table on allowlist membership, so even if the hook is
--      ever misconfigured a stray account sees an empty app.

-- ---------------------------------------------------------------------------
-- 1. The allowlist
-- ---------------------------------------------------------------------------
create table if not exists public.allowed_members (
  email      text primary key,
  added_by   uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

-- Emails are always stored lower-case so comparisons are case-insensitive.
create or replace function public.allowed_members_lower()
returns trigger language plpgsql as $$
begin
  new.email := lower(trim(new.email));
  return new;
end;
$$;

drop trigger if exists trg_allowed_members_lower on public.allowed_members;
create trigger trg_allowed_members_lower
  before insert or update on public.allowed_members
  for each row execute function public.allowed_members_lower();

-- ---------------------------------------------------------------------------
-- 2. Seed with everyone who already has an account (nobody loses access)
-- ---------------------------------------------------------------------------
insert into public.allowed_members (email)
select distinct lower(u.email)
from auth.users u
where u.email is not null and u.email <> ''
on conflict (email) do nothing;

-- ---------------------------------------------------------------------------
-- 3. Membership helper. SECURITY DEFINER so policies don't recurse.
-- ---------------------------------------------------------------------------
create or replace function public.is_member()
returns boolean language sql security definer stable set search_path = public as $$
  select exists (
    select 1 from public.allowed_members
    where email = lower(auth.jwt() ->> 'email')
  )
$$;

-- ---------------------------------------------------------------------------
-- 4. Who can see / change the allowlist
-- ---------------------------------------------------------------------------
alter table public.allowed_members enable row level security;

drop policy if exists "allowed_members read"         on public.allowed_members;
drop policy if exists "allowed_members admin insert" on public.allowed_members;
drop policy if exists "allowed_members admin delete" on public.allowed_members;

-- Members can see the list; only admins can add or remove.
create policy "allowed_members read" on public.allowed_members
  for select to authenticated using (public.is_member());
create policy "allowed_members admin insert" on public.allowed_members
  for insert to authenticated with check (public.is_admin());
create policy "allowed_members admin delete" on public.allowed_members
  for delete to authenticated using (public.is_admin());

-- ---------------------------------------------------------------------------
-- 5. The signup gate — wire this up in the dashboard at
--    Authentication -> Hooks -> "Before User Created" -> this function.
--    Until it is enabled, step 6 still stops strangers seeing any data.
-- ---------------------------------------------------------------------------
create or replace function public.hook_restrict_signup_to_allowlist(event jsonb)
returns jsonb language plpgsql security definer set search_path = public as $$
declare
  addr text;
begin
  addr := lower(event->'user'->>'email');

  if exists (select 1 from public.allowed_members where email = addr) then
    return '{}'::jsonb;  -- on the list: allow the account to be created
  end if;

  return jsonb_build_object(
    'error', jsonb_build_object(
      'message', 'This email has not been invited to the Florence tracker. Ask an admin to add you first.',
      'http_code', 403
    )
  );
end;
$$;

grant usage on schema public to supabase_auth_admin;
grant execute on function public.hook_restrict_signup_to_allowlist(jsonb) to supabase_auth_admin;
revoke execute on function public.hook_restrict_signup_to_allowlist(jsonb) from authenticated, anon, public;

-- ---------------------------------------------------------------------------
-- 6. Re-gate the data tables on membership (replaces the old "using (true)")
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
  p record;
  tables text[] := array[
    'categories', 'items', 'departments',
    'service_lines', 'service_entries', 'service_month_close',
    'attachments', 'item_attachments'
  ];
begin
  foreach t in array tables loop
    if to_regclass('public.' || t) is null then
      continue;  -- table not present in this project; skip
    end if;

    -- Drop whatever policies exist today, then recreate them uniformly.
    for p in select policyname from pg_policies where schemaname = 'public' and tablename = t loop
      execute format('drop policy %I on public.%I', p.policyname, t);
    end loop;

    execute format(
      'create policy "%s member select" on public.%I for select to authenticated using (public.is_member())', t, t);
    execute format(
      'create policy "%s member insert" on public.%I for insert to authenticated with check (public.is_member())', t, t);
    execute format(
      'create policy "%s member update" on public.%I for update to authenticated using (public.is_member()) with check (public.is_member())', t, t);
    execute format(
      'create policy "%s member delete" on public.%I for delete to authenticated using (public.is_member())', t, t);
  end loop;
end $$;

-- Profiles need their own shape: members can read the team, everyone may
-- create/update their OWN row (so first sign-in works), admins may update all.
drop policy if exists "profiles: authenticated read" on public.profiles;
drop policy if exists "profiles: member read"        on public.profiles;
drop policy if exists "profiles: insert own"         on public.profiles;
drop policy if exists "profiles: update own"         on public.profiles;
drop policy if exists "profiles: admin update all"   on public.profiles;

create policy "profiles: member read" on public.profiles
  for select to authenticated using (public.is_member());
create policy "profiles: insert own" on public.profiles
  for insert to authenticated with check (auth.uid() = user_id);
create policy "profiles: update own" on public.profiles
  for update to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
create policy "profiles: admin update all" on public.profiles
  for update to authenticated using (public.is_admin()) with check (true);

-- Evidence/attachment files in storage.
drop policy if exists "attachments objects read"   on storage.objects;
drop policy if exists "attachments objects insert" on storage.objects;
drop policy if exists "attachments objects delete" on storage.objects;

create policy "attachments objects read" on storage.objects
  for select to authenticated using (bucket_id = 'attachments' and public.is_member());
create policy "attachments objects insert" on storage.objects
  for insert to authenticated with check (bucket_id = 'attachments' and public.is_member());
create policy "attachments objects delete" on storage.objects
  for delete to authenticated using (bucket_id = 'attachments' and public.is_member());

-- view_prefs stays own-row only (already correct in 0001) — personal UI state,
-- no need to gate it on membership.
