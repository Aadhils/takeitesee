-- Phase 17: optimize customer/provider booking ownership RLS auth initplans.
--
-- Only row-independent auth.uid() calls are wrapped in scalar subqueries.
-- Existing customer ownership, provider ownership, policy names, commands,
-- roles, and write checks remain unchanged. No booking lifecycle/status logic
-- is modified by this migration.
--
-- Cashfree, payment, refund, payout, and finance policies are intentionally
-- outside this migration.

alter policy bookings_insert_owned
  on public.bookings
  with check (customer_id = (select auth.uid()));

alter policy bookings_select_owned
  on public.bookings
  using (customer_id = (select auth.uid()));

alter policy history_select_owned
  on public.booking_status_history
  using (
    exists (
      select 1
      from public.bookings b
      where b.id = booking_status_history.booking_id
        and b.customer_id = (select auth.uid())
    )
  );

alter policy bookings_provider_read_owned
  on public.bookings
  using (
    (
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
  );

alter policy history_select_provider_owned
  on public.booking_status_history
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
