-- Launch readiness: keep marketplace-disclosure trigger helpers non-callable through API roles.
-- Non-finance security hardening only.

revoke all on function public.require_provider_marketplace_disclosure_on_verification_approval() from public, anon, authenticated, service_role;
revoke all on function public.copy_provider_marketplace_disclosure_after_verification() from public, anon, authenticated, service_role;
