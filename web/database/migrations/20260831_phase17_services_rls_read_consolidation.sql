-- Phase 17: consolidate overlapping SELECT policies on public.services.
--
-- Anonymous users must continue to see only launch-ready active services. Authenticated users
-- must see the same launch-ready catalog plus services they own, including paused/draft rows.
-- The existing Provider INSERT, UPDATE, and DELETE policies are intentionally unchanged.
--
-- Canonical transaction dry-run verified exact service-id visibility for anon, an authenticated
-- non-owner, and a Provider owner before and after this read-policy split.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are
-- intentionally untouched by this migration.

drop policy if exists services_provider_read_own on public.services;
drop policy if exists services_public_read_launch_ready on public.services;

create policy services_anon_read_launch_ready
on public.services
for select
to anon
using (
  status = 'active'::public.service_status
  and active = true
  and private.provider_owner_is_verified((provider_type)::text, professional_id, business_id)
  and private.provider_profile_is_complete((provider_type)::text, professional_id, business_id)
  and private.service_scope_is_launchable(id)
  and private.provider_trust_allows_marketplace((provider_type)::text, professional_id, business_id)
);

create policy services_authenticated_read
on public.services
for select
to authenticated
using (
  (
    status = 'active'::public.service_status
    and active = true
    and private.provider_owner_is_verified((provider_type)::text, professional_id, business_id)
    and private.provider_profile_is_complete((provider_type)::text, professional_id, business_id)
    and private.service_scope_is_launchable(id)
    and private.provider_trust_allows_marketplace((provider_type)::text, professional_id, business_id)
  )
  or exists (
    select 1
    from public.professional_profiles pp
    where pp.id = services.professional_id
      and pp.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.businesses b
    where b.id = services.business_id
      and b.owner_user_id = (select auth.uid())
  )
);
