-- Phase 17: optimize Marketplace Issues read RLS auth initplans.
--
-- Only row-independent auth.uid() calls are wrapped in scalar subqueries.
-- Existing authenticated role, customer reporter ownership, provider booking
-- ownership, professional ownership, and business ownership requirements remain
-- unchanged. These policies are SELECT-only.
--
-- Issue creation, mutation, resolution workflow, Admin scoped access, and all
-- Cashfree, payment, refund, payout, and finance policies are intentionally
-- outside this migration.

alter policy marketplace_issues_customer_read_own
  on public.marketplace_issues
  using (
    reported_by = (select auth.uid())
  );

alter policy marketplace_issues_provider_read_owned
  on public.marketplace_issues
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = marketplace_issues.booking_id
        and (
          exists (
            select 1
            from public.professional_profiles p
            where p.id = b.professional_id
              and p.user_id = (select auth.uid())
          )
          or exists (
            select 1
            from public.businesses biz
            where biz.id = b.business_id
              and biz.owner_user_id = (select auth.uid())
          )
        )
    )
  );

alter policy marketplace_issue_events_customer_read
  on public.marketplace_issue_events
  using (
    exists (
      select 1
      from public.marketplace_issues i
      where i.id = marketplace_issue_events.issue_id
        and i.reported_by = (select auth.uid())
    )
  );

alter policy marketplace_issue_events_provider_read
  on public.marketplace_issue_events
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = marketplace_issue_events.booking_id
        and (
          exists (
            select 1
            from public.professional_profiles p
            where p.id = b.professional_id
              and p.user_id = (select auth.uid())
          )
          or exists (
            select 1
            from public.businesses biz
            where biz.id = b.business_id
              and biz.owner_user_id = (select auth.uid())
          )
        )
    )
  );
