-- Allow authorized Admin review sessions to read draft services only when the
-- service participates in a launch request visible to that Admin scope.
--
-- get_service_launch_review_queue() runs as SECURITY INVOKER. Its request rows
-- were already visible through service_launch_requests RLS, but the inner join
-- to public.services removed pending draft services because services RLS only
-- allowed owners or launch-ready public services. This made the Admin UI show
-- Pending 0 even while a real launch request existed.
--
-- Keep the grant narrow: the service becomes readable to an authenticated Admin
-- only when a service_launch_request for that service is itself inside the
-- Admin/Super Admin review scope. Anonymous access and service mutations are
-- unchanged. Finance, payments, recurrence, recovery and settlement are
-- intentionally untouched.

drop policy if exists services_admin_launch_review_read on public.services;
create policy services_admin_launch_review_read
on public.services
for select
to authenticated
using (
  exists (
    select 1
    from public.service_launch_requests r
    where r.service_id = services.id
      and (
        private.is_super_admin()
        or private.admin_can_view(
          r.requested_application_id,
          r.requested_location_id,
          r.requested_category_id,
          r.service_id
        )
      )
  )
);
