-- Launch readiness: restore the provider-services trust-status bridge after Phase 17 moved
-- provider_trust_status() behind the private schema.
--
-- Keep the trust primitive private. Expose only a SECURITY INVOKER compatibility wrapper
-- that authenticated/anon users cannot execute; server-side provider services use service_role.
-- Finance/Cashfree/payment/refund/payout/recovery state is untouched.

create or replace function public.provider_trust_status(
  p_provider_type text,
  p_professional_id uuid,
  p_business_id uuid
)
returns text
language sql
stable
security invoker
set search_path = ''
as $$
  select private.provider_trust_status(
    p_provider_type,
    p_professional_id,
    p_business_id
  );
$$;

revoke all on function public.provider_trust_status(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.provider_trust_status(text, uuid, uuid)
  to service_role;
