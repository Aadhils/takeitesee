-- Phase 17: optimize high-traffic non-finance RLS ownership predicates.
--
-- Supabase/Postgres can evaluate auth.uid() once per statement when wrapped in
-- a scalar subquery. These ALTER POLICY statements preserve the existing
-- policy names, commands, roles, ownership predicates, and write checks.
--
-- Cashfree, payment, refund, payout, and finance policies are intentionally
-- outside this migration.

alter policy users_select_self
  on public.users
  using (id = (select auth.uid()));

alter policy users_update_self
  on public.users
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

alter policy customer_profiles_self
  on public.customer_profiles
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

alter policy notifications_select_own
  on public.notifications
  using (recipient_user_id = (select auth.uid()));

alter policy notifications_update_own
  on public.notifications
  using (recipient_user_id = (select auth.uid()))
  with check (recipient_user_id = (select auth.uid()));
