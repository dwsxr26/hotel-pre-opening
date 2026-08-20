-- Florence Pre-Opening — let a pending overspend clear when the invoice is removed.
-- Run this in the Supabase SQL editor after 0017_service_overspend.sql.
--
-- If an over-budget invoice was a mistake and is deleted (or reduced back within
-- budget), the month should stop being yellow. The app deletes the still-pending
-- approval on save; members need delete rights for that — but only while it is
-- pending. Approved records stay (they are history and moved real budget).

drop policy if exists "overspend member delete pending" on public.service_overspend_approvals;
create policy "overspend member delete pending" on public.service_overspend_approvals
  for delete to authenticated using (public.is_member() and status = 'pending');
