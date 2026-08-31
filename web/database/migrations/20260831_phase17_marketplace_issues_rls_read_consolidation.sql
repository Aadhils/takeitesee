-- Phase 17: consolidate overlapping authenticated SELECT policies on marketplace issues.
--
-- Preserve the exact existing Customer reporter, Provider-owner, and scoped Admin read union on
-- public.marketplace_issues and public.marketplace_issue_events while reducing six permissive
-- SELECT policies to two. The existing scoped Admin UPDATE policy on marketplace_issues remains
-- unchanged.
--
-- Canonical rollback-only verification used synthetic issue/event rows and isolated Customer,
-- Provider owner, delegated Admin, and unrelated authenticated personas. Full visible synthetic-ID
-- sets matched before/after exactly, including Admin access to a non-participant issue/event.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state remain HOLD.

drop policy if exists marketplace_issues_admin_read_scoped on public.marketplace_issues;
drop policy if exists marketplace_issues_customer_read_own on public.marketplace_issues;
drop policy if exists marketplace_issues_provider_read_owned on public.marketplace_issues;

create policy marketplace_issues_read_authorized
on public.marketplace_issues
for select
to authenticated
using (
  reported_by = (select auth.uid())
  or exists (
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
  or exists (
    select 1
    from public.service_ecosystem_scope ses
    where ses.service_id = marketplace_issues.service_id
      and ses.enabled = true
      and private.admin_can_view(
        ses.application_id,
        ses.location_id,
        ses.category_id,
        ses.service_id
      )
  )
);

drop policy if exists marketplace_issue_events_admin_read_scoped on public.marketplace_issue_events;
drop policy if exists marketplace_issue_events_customer_read on public.marketplace_issue_events;
drop policy if exists marketplace_issue_events_provider_read on public.marketplace_issue_events;

create policy marketplace_issue_events_read_authorized
on public.marketplace_issue_events
for select
to authenticated
using (
  exists (
    select 1
    from public.marketplace_issues i
    where i.id = marketplace_issue_events.issue_id
      and i.reported_by = (select auth.uid())
  )
  or exists (
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
  or exists (
    select 1
    from public.marketplace_issues i
    join public.service_ecosystem_scope ses
      on ses.service_id = i.service_id
     and ses.enabled = true
    where i.id = marketplace_issue_events.issue_id
      and private.admin_can_view(
        ses.application_id,
        ses.location_id,
        ses.category_id,
        ses.service_id
      )
  )
);
