-- Phase 17: optimize Admin self-membership read RLS auth initplans.
--
-- Only row-independent auth.uid() calls are wrapped in scalar subqueries.
-- Existing authenticated role, membership ownership, and active-membership
-- requirements remain unchanged. These policies are SELECT-only.
--
-- Cashfree, payment, refund, payout, and finance policies are intentionally
-- outside this migration.

alter policy admin_memberships_select_self
  on public.admin_memberships
  using (user_id = (select auth.uid()));

alter policy admin_scopes_select_own_membership
  on public.admin_scopes
  using (
    exists (
      select 1
      from public.admin_memberships am
      where am.id = admin_scopes.admin_membership_id
        and am.user_id = (select auth.uid())
        and am.active = true
    )
  );
