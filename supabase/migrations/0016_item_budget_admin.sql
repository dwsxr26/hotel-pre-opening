-- Florence Pre-Opening — admin-only Budget edits on OS&E order lines.
-- Run this in the Supabase SQL editor after 0015_item_invoices.sql.
--
-- The per-line Budget (0012) is the locked-in figure. Anyone on the team can
-- edit the operational fields of a line, but only an admin may change its
-- Budget — e.g. when a package is split across suppliers and the €1,000 line
-- becomes two €500 lines. The UI hides the Budget editor from non-admins; this
-- trigger enforces it for real, so a direct API call can't bypass it.
--
-- is_admin() was created in 0008. Server-side scripts (seed/export) use the
-- service role, which has no auth.uid(), so they are exempt — the guard only
-- bites real signed-in non-admin users.

create or replace function public.enforce_admin_budget()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.budget is distinct from old.budget
     and auth.uid() is not null
     and not public.is_admin() then
    raise exception 'Only admins can change a line''s budget';
  end if;
  return new;
end $$;

drop trigger if exists items_enforce_admin_budget on public.items;
create trigger items_enforce_admin_budget
  before update on public.items
  for each row execute function public.enforce_admin_budget();
