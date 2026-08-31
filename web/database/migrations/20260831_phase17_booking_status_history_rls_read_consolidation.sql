-- Phase 17: consolidate overlapping authenticated SELECT policies on booking_status_history.
--
-- Customer, Provider owner, and scoped Admin read access currently live in three permissive
-- SELECT policies. Replace them with one authenticated SELECT policy whose predicate is the exact
-- existing OR-union of those authorization paths.
--
-- Canonical rollback-only verification isolated all relevant personas against live history rows:
-- - Customer participant: visible before and after.
-- - Provider owner: visible before and after.
-- - Delegated Admin on a non-participant booking: visible before and after.
-- - Unrelated authenticated user: hidden before and after.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are
-- intentionally untouched by this migration.

drop policy if exists history_select_admin_scoped on public.booking_status_history;
drop policy if exists history_select_owned on public.booking_status_history;
drop policy if exists history_select_provider_owned on public.booking_status_history;

create policy history_select_authorized
on public.booking_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_status_history.booking_id
      and (
        b.customer_id = (select auth.uid())
        or exists (
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
        or exists (
          select 1
          from public.service_ecosystem_scope ses
          where ses.service_id = b.service_id
            and ses.enabled = true
            and private.admin_can_view(
              ses.application_id,
              ses.location_id,
              ses.category_id,
              ses.service_id
            )
        )
      )
  )
);
