-- Availability-aware marketplace search: minimal public live availability read.
--
-- Privacy boundary:
-- - anon may read only Provider identity keys + live work mode + expiry needed to
--   compute the effective marketplace mode.
-- - a live row is visible only when the Provider currently has at least one
--   service that the existing services anon RLS policy allows into the public
--   marketplace.
-- - service eligibility/trust/verification remains authoritative in the
--   services policy; this policy intentionally does not duplicate those rules.
-- - no write access is added and no Business shop/open state is introduced.

revoke all on table public.provider_live_availability from anon;

grant select (
  provider_type,
  professional_id,
  business_id,
  work_mode,
  mode_expires_at
) on table public.provider_live_availability to anon;

drop policy if exists provider_live_availability_public_service_read
  on public.provider_live_availability;

create policy provider_live_availability_public_service_read
on public.provider_live_availability
for select
to anon
using (
  exists (
    select 1
    from public.services s
    where s.active = true
      and s.status = 'active'::public.service_status
      and s.provider_type = provider_live_availability.provider_type
      and (
        (
          provider_live_availability.provider_type = 'professional'::public.provider_type
          and s.professional_id = provider_live_availability.professional_id
          and s.business_id is null
        )
        or
        (
          provider_live_availability.provider_type = 'business'::public.provider_type
          and s.business_id = provider_live_availability.business_id
          and s.professional_id is null
        )
      )
  )
);
