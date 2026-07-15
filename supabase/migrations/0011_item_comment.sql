-- Florence Pre-Opening — add a free-text comment to order items
-- Run this in the Supabase SQL editor after 0010_service_close.sql.
-- Shown in the grid's "Files & Comments" column.

alter table public.items add column if not exists comment text not null default '';
