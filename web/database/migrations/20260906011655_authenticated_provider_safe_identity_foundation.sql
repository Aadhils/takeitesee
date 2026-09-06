create or replace function public.get_public_provider_identity(
  target_provider_type text,
  target_provider_id uuid
)
returns table (
  provider_type text,
  provider_id uuid,
  display_name text,
  location text,
  verified boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select 'professional'::text, p.id, p.headline, p.service_area, p.verified
  from public.professional_profiles p
  where target_provider_type = 'professional'
    and p.id = target_provider_id
    and p.verified = true
    and private.provider_marketplace_disclosure_is_complete('professional', p.id, null)
  union all
  select 'business'::text, b.id, b.name, b.location, b.verified
  from public.businesses b
  where target_provider_type = 'business'
    and b.id = target_provider_id
    and b.verified = true
    and private.provider_marketplace_disclosure_is_complete('business', null, b.id);
$$;

revoke all on function public.get_public_provider_identity(text, uuid) from public;
grant execute on function public.get_public_provider_identity(text, uuid) to anon, authenticated, service_role;
