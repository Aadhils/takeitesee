-- Phase 17: optimize marketplace requirement-job, block, and moderation read RLS auth initplans.
--
-- Only row-independent auth.uid() calls are wrapped in scalar subqueries.
-- Existing authenticated role, customer/provider participant ownership, blocker ownership,
-- reporter visibility, and row-dependent Admin/Super Admin requirement-scope checks remain
-- unchanged. These policies are SELECT-only.
--
-- Requirement-job mutation, user-block writes, moderation handling/admin actions,
-- review INSERT behavior, and all Cashfree, payment, refund, payout, and finance policies
-- are intentionally outside this migration.

alter policy marketplace_requirement_jobs_participant_read
  on public.marketplace_requirement_jobs
  using (
    exists (
      select 1
      from public.customer_requirements r
      join public.requirement_proposals p
        on p.id = marketplace_requirement_jobs.proposal_id
      where r.id = marketplace_requirement_jobs.requirement_id
        and (
          r.customer_id = (select auth.uid())
          or p.provider_user_id = (select auth.uid())
        )
    )
  );

alter policy marketplace_user_blocks_own_read
  on public.marketplace_user_blocks
  using (
    blocker_user_id = (select auth.uid())
  );

alter policy marketplace_moderation_reports_reporter_read
  on public.marketplace_moderation_reports
  using (
    reporter_user_id = (select auth.uid())
    or public.marketplace_admin_can_view_requirement(requirement_id)
  );

alter policy marketplace_moderation_report_events_reporter_read
  on public.marketplace_moderation_report_events
  using (
    exists (
      select 1
      from public.marketplace_moderation_reports r
      where r.id = marketplace_moderation_report_events.report_id
        and (
          r.reporter_user_id = (select auth.uid())
          or public.marketplace_admin_can_view_requirement(r.requirement_id)
        )
    )
  );
