-- Phase 17: consolidate overlapping authenticated SELECT policies on booking closeout tables.
--
-- Customer, Provider owner, and scoped Admin read access currently live in three permissive
-- SELECT policies per table. Replace them with one authenticated SELECT policy per table whose
-- predicate is the exact existing OR-union of those authorization paths.
--
-- Canonical rollback-only verification isolated all four relevant personas:
-- - Customer participant: visible before and after.
-- - Provider owner: visible before and after.
-- - Delegated Admin on a non-participant booking: visible before and after.
-- - Unrelated authenticated user: hidden before and after.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are
-- intentionally untouched by this migration.

-- booking_closeouts

drop policy if exists booking_closeouts_admin_read on public.booking_closeouts;
drop policy if exists booking_closeouts_customer_read on public.booking_closeouts;
drop policy if exists booking_closeouts_provider_read on public.booking_closeouts;

create policy booking_closeouts_read
on public.booking_closeouts
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_closeouts.booking_id
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

-- booking_closeout_events

drop policy if exists booking_closeout_events_admin_read on public.booking_closeout_events;
drop policy if exists booking_closeout_events_customer_read on public.booking_closeout_events;
drop policy if exists booking_closeout_events_provider_read on public.booking_closeout_events;

create policy booking_closeout_events_read
on public.booking_closeout_events
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_closeout_events.booking_id
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
