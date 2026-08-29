-- Phase 12: allow a signed-in provider to read lifecycle history for bookings they own.
-- Customer access remains covered by the existing history_select_owned policy.

drop policy if exists history_select_provider_owned on public.booking_status_history;
create policy history_select_provider_owned
on public.booking_status_history
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_status_history.booking_id
      and (
        exists (
          select 1
          from public.professional_profiles p
          where p.id = b.professional_id
            and p.user_id = auth.uid()
        )
        or exists (
          select 1
          from public.businesses biz
          where biz.id = b.business_id
            and biz.owner_user_id = auth.uid()
        )
      )
  )
);
