-- Florence Pre-Opening — add Order date and split Invoice # / Order #
-- Run this in the Supabase SQL editor after 0003_password_flag.sql.
--
-- - order_date: the date an order was placed (separate from est_arrival).
-- - invoice_no: new "Invoice #" column. The old single "Invoice / order no."
--   values (in order_no) move here, and order_no becomes the empty "Order #".

alter table public.items add column if not exists order_date date;
alter table public.items add column if not exists invoice_no text not null default '';

-- Move existing combined values into Invoice #, then clear Order # to be filled in.
update public.items set invoice_no = order_no where invoice_no = '' and coalesce(order_no, '') <> '';
update public.items set order_no = '' where coalesce(order_no, '') <> '';
