-- Launch readiness: add covering indexes for non-finance Provider onboarding foreign keys.
--
-- Supabase Performance Advisor and a live catalog check identified these foreign keys as lacking
-- covering indexes. Add simple btree indexes for Provider application, verification, trust, service
-- launch, and operational-settings joins without changing RLS, data, workflow state, or behavior.
--
-- Cashfree, payment, cash-collection, refund, payout, recovery, settlement, and finance tables,
-- columns, indexes, activation, state, configuration, functions, and policies remain HOLD and are
-- intentionally untouched.

create index if not exists provider_application_events_actor_user_id_idx
  on public.provider_application_events using btree (actor_user_id);

create index if not exists provider_applications_reviewed_by_idx
  on public.provider_applications using btree (reviewed_by);

create index if not exists provider_trust_events_actor_user_id_idx
  on public.provider_trust_events using btree (actor_user_id);

create index if not exists provider_trust_states_changed_by_idx
  on public.provider_trust_states using btree (changed_by);

create index if not exists provider_verification_events_actor_user_id_idx
  on public.provider_verification_events using btree (actor_user_id);

create index if not exists provider_verification_requests_business_id_idx
  on public.provider_verification_requests using btree (business_id);

create index if not exists provider_verification_requests_professional_id_idx
  on public.provider_verification_requests using btree (professional_id);

create index if not exists provider_verification_requests_reviewed_by_idx
  on public.provider_verification_requests using btree (reviewed_by);

create index if not exists service_launch_events_actor_user_id_idx
  on public.service_launch_events using btree (actor_user_id);

create index if not exists service_launch_requests_requested_application_id_idx
  on public.service_launch_requests using btree (requested_application_id);

create index if not exists service_launch_requests_requested_category_id_idx
  on public.service_launch_requests using btree (requested_category_id);

create index if not exists service_launch_requests_requested_location_id_idx
  on public.service_launch_requests using btree (requested_location_id);

create index if not exists service_launch_requests_reviewed_by_idx
  on public.service_launch_requests using btree (reviewed_by);

create index if not exists service_operational_settings_application_id_idx
  on public.service_operational_settings using btree (application_id);

create index if not exists service_operational_settings_category_id_idx
  on public.service_operational_settings using btree (category_id);

create index if not exists service_operational_settings_location_id_idx
  on public.service_operational_settings using btree (location_id);

create index if not exists service_operational_settings_updated_by_idx
  on public.service_operational_settings using btree (updated_by);
