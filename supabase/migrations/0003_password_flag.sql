-- Florence Pre-Opening — track whether a user has set a password.
-- Run this in the Supabase SQL editor after 0002_profiles.sql.
--
-- New teammates sign in the first time via magic link (passwordless). We then
-- prompt them to set a password; this flag records that they've done so, so we
-- stop prompting. Existing users (flag defaults false) get prompted once.

alter table public.profiles
  add column if not exists password_set boolean not null default false;
