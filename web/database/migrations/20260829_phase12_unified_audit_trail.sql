-- Phase 12 Module 6: unified booking + payment audit trail.
-- Keep admin history access aligned with the same service-scoped authorization used by bookings.

-- Module 5 initially allowed any delegated admin with any view scope to read payment events.
-- Tighten that policy so an admin can read an event only when the underlying booking's service
-- is inside a scope that admin_can_view() authorizes for the current user.
drop policy if exists payment_events_admin_read on public.booking_payment_events;
create policy payment_events_admin_read
on public.booking_payment_events
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.service_ecosystem_scope ses
      on ses.service_id = b.service_id
     and ses.enabled = true
    where b.id = booking_payment_events.booking_id
      and public.admin_can_view(
        ses.application_id,
        ses.location_id,
        ses.category_id,
        ses.service_id
      )
  )
);

-- Booking status history already supports customer and provider reads. Add the corresponding
-- scoped-admin policy so the admin audit page can use the same immutable lifecycle records.
drop policy if exists history_select_admin_scoped on public.booking_status_history;
create policy history_select_admin_scoped
on public.booking_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    join public.service_ecosystem_scope ses
      on ses.service_id = b.service_id
     and ses.enabled = true
    where b.id = booking_status_history.booking_id
      and public.admin_can_view(
        ses.application_id,
        ses.location_id,
        ses.category_id,
        ses.service_id
      )
  )
);
