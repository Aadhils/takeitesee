-- Phase 17: optimize booking closeout read RLS auth initplans.
--
-- Only row-independent auth.uid() calls are wrapped in scalar subqueries.
-- Existing authenticated role, customer ownership, and provider ownership
-- requirements remain unchanged. These policies are SELECT-only.
--
-- No booking closeout lifecycle/status behavior is modified.
-- Cashfree, payment, refund, payout, and finance policies are intentionally
-- outside this migration.

alter policy booking_closeouts_customer_read
  on public.booking_closeouts
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_closeouts.booking_id
        and b.customer_id = (select auth.uid())
    )
  );

alter policy booking_closeouts_provider_read
  on public.booking_closeouts
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_closeouts.booking_id
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

alter policy booking_closeout_events_customer_read
  on public.booking_closeout_events
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_closeout_events.booking_id
        and b.customer_id = (select auth.uid())
    )
  );

alter policy booking_closeout_events_provider_read
  on public.booking_closeout_events
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_closeout_events.booking_id
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
