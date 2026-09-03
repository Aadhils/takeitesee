-- Launch readiness: expose only the current authenticated provider's trust status.
-- Keep the underlying provider_trust_status() primitive private.
-- The SECURITY DEFINER wrapper derives ownership from auth.uid() and accepts no provider ids.
-- Finance/Cashfree/payment/refund/payout/recovery state is untouched.

create or replace function public.provider_current_trust_status(
  p_provider_type text
)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_professional_id uuid;
  v_business_id uuid;
begin
  if auth.uid() is null then
    raise exception 'Authentication is required.';
  end if;

  if p_provider_type = 'professional' then
    select id
      into v_professional_id
      from public.professional_profiles
     where user_id = auth.uid()
     limit 1;

    if v_professional_id is null then
      raise exception 'Professional profile is required.';
    end if;

    return private.provider_trust_status('professional', v_professional_id, null);
  elsif p_provider_type = 'business' then
    select id
      into v_business_id
      from public.businesses
     where owner_user_id = auth.uid()
     limit 1;

    if v_business_id is null then
      raise exception 'Business profile is required.';
    end if;

    return private.provider_trust_status('business', null, v_business_id);
  end if;

  raise exception 'Provider type is invalid.';
end;
$$;

revoke all on function public.provider_current_trust_status(text)
  from public, anon;
grant execute on function public.provider_current_trust_status(text)
  to authenticated, service_role;
