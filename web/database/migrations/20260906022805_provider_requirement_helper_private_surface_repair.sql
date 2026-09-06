create or replace function public.provider_service_matches_requirement(
  target_service_id uuid,
  target_requirement_id uuid,
  target_provider_user_id uuid default auth.uid()
)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.services s
    join public.service_ecosystem_scope ses on ses.service_id=s.id and ses.enabled=true
    join public.customer_requirements r on r.id=target_requirement_id
    where s.id=target_service_id
      and r.status='open'
      and ses.location_id=r.location_id
      and public.requirement_category_matches_scope(ses.category_id,r.category_id)
      and s.status='active'::public.service_status
      and s.active=true
      and private.provider_owner_is_verified(s.provider_type::text,s.professional_id,s.business_id)
      and private.provider_profile_is_complete(s.provider_type::text,s.professional_id,s.business_id)
      and private.provider_trust_allows_marketplace(s.provider_type::text,s.professional_id,s.business_id)
      and private.service_scope_is_launchable(s.id)
      and (
        exists(select 1 from public.professional_profiles pp where pp.id=s.professional_id and pp.user_id=target_provider_user_id)
        or exists(select 1 from public.businesses b where b.id=s.business_id and b.owner_user_id=target_provider_user_id)
      )
  );
$$;

revoke execute on function public.provider_service_matches_requirement(uuid,uuid,uuid) from public, anon, authenticated;
grant execute on function public.provider_service_matches_requirement(uuid,uuid,uuid) to service_role;

drop function if exists public.provider_owner_is_verified(text,uuid,uuid);
