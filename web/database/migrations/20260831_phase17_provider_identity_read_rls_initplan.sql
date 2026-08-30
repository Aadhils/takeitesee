-- Phase 17: optimize provider identity and onboarding read-policy auth initplans.
--
-- Only row-independent auth.uid() calls are wrapped in scalar subqueries.
-- Existing owner/applicant checks plus Admin/Super Admin authorization paths
-- remain unchanged. All policies in this migration are SELECT-only.
--
-- Cashfree, payment, refund, payout, and finance policies are intentionally
-- outside this migration.

alter policy businesses_owner_read
  on public.businesses
  using ((owner_user_id = (select auth.uid())) or is_super_admin());

alter policy professionals_owner_read
  on public.professional_profiles
  using ((user_id = (select auth.uid())) or is_super_admin());

alter policy provider_applications_select_owned_or_platform_admin
  on public.provider_applications
  using (
    (applicant_user_id = (select auth.uid()))
    or is_super_admin()
    or admin_can_view(null::uuid, null::uuid, null::uuid, null::uuid)
  );

alter policy provider_application_events_select_owned_or_platform_admin
  on public.provider_application_events
  using (
    exists (
      select 1
      from public.provider_applications pa
      where pa.id = provider_application_events.application_id
        and (
          (pa.applicant_user_id = (select auth.uid()))
          or is_super_admin()
          or admin_can_view(null::uuid, null::uuid, null::uuid, null::uuid)
        )
    )
  );

alter policy provider_verification_requests_private_read
  on public.provider_verification_requests
  using (
    (applicant_user_id = (select auth.uid()))
    or is_super_admin()
    or admin_can_view(null::uuid, null::uuid, null::uuid, null::uuid)
  );

alter policy provider_verification_events_private_read
  on public.provider_verification_events
  using (
    exists (
      select 1
      from public.provider_verification_requests r
      where r.id = provider_verification_events.verification_request_id
        and (
          (r.applicant_user_id = (select auth.uid()))
          or is_super_admin()
          or admin_can_view(null::uuid, null::uuid, null::uuid, null::uuid)
        )
    )
  );

alter policy provider_verification_documents_private_read
  on public.provider_verification_documents
  using (
    (applicant_user_id = (select auth.uid()))
    or is_super_admin()
    or admin_can_view(null::uuid, null::uuid, null::uuid, null::uuid)
  );

alter policy provider_trust_states_private_read
  on public.provider_trust_states
  using (
    (owner_user_id = (select auth.uid()))
    or is_super_admin()
    or admin_can_view(null::uuid, null::uuid, null::uuid, null::uuid)
  );

alter policy provider_trust_events_private_read
  on public.provider_trust_events
  using (
    exists (
      select 1
      from public.provider_trust_states s
      where s.id = provider_trust_events.trust_state_id
        and (
          (s.owner_user_id = (select auth.uid()))
          or is_super_admin()
          or admin_can_view(null::uuid, null::uuid, null::uuid, null::uuid)
        )
    )
  );

alter policy service_launch_requests_private_read
  on public.service_launch_requests
  using (
    (applicant_user_id = (select auth.uid()))
    or is_super_admin()
    or admin_can_view(requested_application_id, requested_location_id, requested_category_id, service_id)
  );

alter policy service_launch_events_private_read
  on public.service_launch_events
  using (
    exists (
      select 1
      from public.service_launch_requests r
      where r.id = service_launch_events.launch_request_id
        and (
          (r.applicant_user_id = (select auth.uid()))
          or is_super_admin()
          or admin_can_view(r.requested_application_id, r.requested_location_id, r.requested_category_id, r.service_id)
        )
    )
  );
