-- Phase 17: optimize and harden the completed-booking customer review INSERT boundary.
--
-- Row-independent auth.uid() calls are wrapped in scalar subqueries so Postgres can
-- evaluate the authenticated user once per statement.
--
-- Existing customer ownership, completed booking, service/provider identity, service-completed
-- closeout, open review-window, and one-review-per-booking semantics remain unchanged.
--
-- Direct customer inserts are additionally constrained to the same values used by the
-- application review route: a newly submitted review must be published and must not
-- pre-populate provider-response fields. Provider responses continue through the existing
-- guarded provider response workflow.
--
-- Review read/admin moderation policies and all Cashfree, payment, refund, payout, and
-- finance policies are intentionally outside this migration.

alter policy customers_insert_completed_booking_review
  on public.reviews
  with check (
    customer_id = (select auth.uid())
    and status = 'published'
    and provider_response is null
    and provider_responded_at is null
    and provider_response_updated_at is null
    and exists (
      select 1
      from public.bookings b
      join public.booking_closeouts c on c.booking_id = b.id
      join public.booking_closeout_policies p on p.policy_key = 'default'
      where b.id = reviews.booking_id
        and b.customer_id = (select auth.uid())
        and b.status = 'completed'
        and b.service_id = reviews.service_id
        and b.provider_type::text = reviews.provider_type
        and coalesce(b.professional_id::text, '') = coalesce(reviews.professional_id::text, '')
        and coalesce(b.business_id::text, '') = coalesce(reviews.business_id::text, '')
        and c.attendance_outcome = 'service_completed'
        and c.closed_at is null
        and c.service_completed_at is not null
        and now() <= c.service_completed_at + make_interval(days => p.review_window_days)
    )
  );
