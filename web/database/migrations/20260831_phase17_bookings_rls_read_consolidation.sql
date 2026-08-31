-- Phase 17: consolidate overlapping authenticated SELECT policies on public.bookings.
--
-- Customer, Provider owner, and scoped Admin read access currently live in three permissive
-- SELECT policies. Replace them with one authenticated SELECT policy whose predicate is the exact
-- existing OR-union of those authorization paths.
--
-- The existing bookings INSERT policy is intentionally unchanged. No booking status, payment,
-- cash-collection, refund, payout, recovery, settlement, or finance columns/behavior are changed.
--
-- Canonical rollback-only verification compared full visible booking-id sets for an isolated
-- Customer, Provider owner, delegated Admin, and unrelated authenticated user before and after.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state remain HOLD.

drop policy if exists bookings_admin_read_scoped on public.bookings;
drop policy if exists bookings_provider_read_owned on public.bookings;
drop policy if exists bookings_select_owned on public.bookings;

create policy bookings_read_authorized
on public.bookings
for select
to authenticated
using (
  customer_id = (select auth.uid())
  or (
    business_id is not null
    and exists (
      select 1
      from public.businesses bu
      where bu.id = bookings.business_id
        and bu.owner_user_id = (select auth.uid())
    )
  )
  or (
    professional_id is not null
    and exists (
      select 1
      from public.professional_profiles pp
      where pp.id = bookings.professional_id
        and pp.user_id = (select auth.uid())
    )
  )
  or exists (
    select 1
    from public.service_ecosystem_scope ses
    where ses.service_id = bookings.service_id
      and ses.enabled = true
      and private.admin_can_view(
        ses.application_id,
        ses.location_id,
        ses.category_id,
        ses.service_id
      )
  )
);
