-- Florence Pre-Opening — add VAT % to order items
-- Run this in the Supabase SQL editor after 0008_admin.sql.
-- "Unit price incl. VAT" is derived in the app from unit_price and vat_pct.

alter table public.items add column if not exists vat_pct numeric not null default 22;
