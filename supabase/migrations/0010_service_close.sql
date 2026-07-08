-- Florence Pre-Opening — richer month-close for Services
-- Run this in the Supabase SQL editor after 0009_item_vat.sql.
--
-- auto_from tags forecast entries created automatically by a month close (roll
-- forward / pro-rata / next-month reductions) so reopening a month can remove
-- exactly those. Also widen the allowed close dispositions.

alter table public.service_entries add column if not exists auto_from date;

alter table public.service_month_close drop constraint if exists service_month_close_disposition_check;
alter table public.service_month_close
  add constraint service_month_close_disposition_check
  check (disposition in ('cancelled', 'rolled', 'reduced', 'closed'));
