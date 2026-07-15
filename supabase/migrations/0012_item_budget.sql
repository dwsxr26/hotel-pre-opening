-- Florence Pre-Opening — locked per-line Budget for OS&E orders
-- Run this in the Supabase SQL editor after 0011_item_comment.sql.
--
-- budget is the "locked-in" figure (a snapshot of qty x unit price at load).
-- The live Total (qty x unit price) can then drift from it as an "actual".

alter table public.items add column if not exists budget numeric not null default 0;
update public.items set budget = qty * unit_price where budget = 0;
