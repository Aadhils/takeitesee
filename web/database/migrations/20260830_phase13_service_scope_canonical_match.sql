-- A mapped scope is launchable only while the service metadata still matches the approved category/location.
create or replace function public.service_scope_is_launchable(p_service_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.services s
    join public.service_ecosystem_scope ses on ses.service_id=s.id
    join public.platform_applications pa on pa.id=ses.application_id
    join public.platform_categories pc on pc.id=ses.category_id and pc.application_id=ses.application_id
    join public.platform_locations pl on pl.id=ses.location_id
    where s.id=p_service_id
      and ses.enabled=true
      and pa.status='active'
      and pc.active=true
      and pl.active=true
      and btrim(coalesce(s.category,''))=pc.name
      and btrim(coalesce(s.location,''))=pl.name
  );
$$;
revoke all on function public.service_scope_is_launchable(uuid) from public;
grant execute on function public.service_scope_is_launchable(uuid) to anon,authenticated,service_role;
