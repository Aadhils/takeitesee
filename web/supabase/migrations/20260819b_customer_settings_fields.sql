-- Adds authenticated customer settings fields to the existing customer_profiles
-- table. Reuses the existing preferred_language column and the existing
-- customer_profiles_self RLS policy (user_id = auth.uid()) — no policy or
-- grant changes are required since that policy already covers all columns
-- on this table.
--
-- Run this migration in Supabase before testing the account settings UI.

alter table public.customer_profiles
  add column if not exists notify_booking_updates boolean not null default true,
  add column if not exists notify_review_reminders boolean not null default true,
  add column if not exists notify_product_updates boolean not null default false,
  add column if not exists reduced_motion boolean not null default false,
  add column if not exists larger_text boolean not null default false,
  add column if not exists use_history_for_recommendations boolean not null default true;
