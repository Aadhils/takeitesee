-- Phase 17: optimize customer requirements and proposal read RLS auth initplans.
--
-- Only row-independent auth.uid() calls are wrapped in scalar subqueries.
-- Existing authenticated role, customer ownership, provider participation,
-- Super Admin access, and Admin scoped-access helpers remain unchanged.
-- These policies are SELECT-only.
--
-- Requirement/proposal creation, mutation, acceptance, lifecycle/status behavior,
-- marketplace messaging, review INSERT behavior, and all Cashfree, payment, refund,
-- payout, and finance policies are intentionally outside this migration.

alter policy customer_requirements_owner_admin_read
  on public.customer_requirements
  using (
    customer_id = (select auth.uid())
    or is_super_admin()
    or admin_can_manage(null::uuid, null::uuid, null::uuid, null::uuid)
  );

alter policy customer_requirement_events_owner_admin_read
  on public.customer_requirement_events
  using (
    exists (
      select 1
      from public.customer_requirements r
      where r.id = customer_requirement_events.requirement_id
        and (
          r.customer_id = (select auth.uid())
          or is_super_admin()
          or admin_can_manage(null::uuid, null::uuid, null::uuid, null::uuid)
        )
    )
  );

alter policy requirement_proposals_participant_admin_read
  on public.requirement_proposals
  using (
    provider_user_id = (select auth.uid())
    or exists (
      select 1
      from public.customer_requirements r
      where r.id = requirement_proposals.requirement_id
        and r.customer_id = (select auth.uid())
    )
    or is_super_admin()
    or admin_can_manage(null::uuid, null::uuid, null::uuid, null::uuid)
  );

alter policy requirement_proposal_events_participant_admin_read
  on public.requirement_proposal_events
  using (
    exists (
      select 1
      from public.requirement_proposals p
      join public.customer_requirements r
        on r.id = p.requirement_id
      where p.id = requirement_proposal_events.proposal_id
        and (
          p.provider_user_id = (select auth.uid())
          or r.customer_id = (select auth.uid())
          or is_super_admin()
          or admin_can_manage(null::uuid, null::uuid, null::uuid, null::uuid)
        )
    )
  );
