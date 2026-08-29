-- Phase 12 Module 8: enforce closeout SLA rules even for direct Supabase writes.

-- Support cases must be opened through the guarded security-definer RPC so that
-- SLA checks, one-active-case rules, audit events and notifications cannot be bypassed.
drop policy if exists marketplace_issues_customer_insert_owned_booking on public.marketplace_issues;

-- Reviews remain a normal customer insert, but the database itself enforces the
-- configured review window and service-completed attendance outcome.
drop policy if exists customers_insert_completed_booking_review on public.reviews;
create policy customers_insert_completed_booking_review
on public.reviews
for insert
to authenticated
with check (
  customer_id = auth.uid()
  and exists (
    select 1
    from public.bookings b
    join public.booking_closeouts c on c.booking_id = b.id
    join public.booking_closeout_policies p on p.policy_key = 'default'
    where b.id = reviews.booking_id
      and b.customer_id = auth.uid()
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
