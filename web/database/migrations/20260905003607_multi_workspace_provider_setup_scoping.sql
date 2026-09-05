create or replace function public.get_provider_setup_readiness_for_type(requested_provider_type text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  ptype text:=lower(btrim(coalesce(requested_provider_type,'')));
  provider_id uuid;
  professional_id_value uuid;
  business_id_value uuid;
  verified_value boolean:=false;
  profile_complete_value boolean:=false;
  services_total_value integer:=0;
  services_scoped_value integer:=0;
  services_active_value integer:=0;
  pending_launch_value integer:=0;
  service_rows jsonb:='[]'::jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if ptype not in ('professional','business') then raise exception 'Provider type must be professional or business.'; end if;

  if ptype='business' then
    select id,verified into business_id_value,verified_value
    from public.businesses where owner_user_id=auth.uid() limit 1;
    if business_id_value is null then raise exception 'Business provider account is required.'; end if;
    provider_id:=business_id_value;
  else
    select id,verified into professional_id_value,verified_value
    from public.professional_profiles where user_id=auth.uid() limit 1;
    if professional_id_value is null then raise exception 'Professional provider account is required.'; end if;
    provider_id:=professional_id_value;
  end if;

  profile_complete_value:=public.provider_profile_is_complete(ptype,professional_id_value,business_id_value);

  select count(*)::int,
         count(*) filter (where public.service_scope_is_launchable(s.id))::int,
         count(*) filter (where s.status='active'::public.service_status and s.active=true)::int
  into services_total_value,services_scoped_value,services_active_value
  from public.services s
  where (ptype='business' and s.business_id=provider_id)
     or (ptype='professional' and s.professional_id=provider_id);

  select count(*)::int into pending_launch_value
  from public.service_launch_requests r
  join public.services s on s.id=r.service_id
  where r.applicant_user_id=auth.uid()
    and r.status='pending'
    and ((ptype='business' and s.business_id=provider_id)
      or (ptype='professional' and s.professional_id=provider_id));

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'name',x.name,'status',x.status,'scope_enabled',x.scope_enabled,
    'application_id',x.application_id,'application_name',x.application_name,
    'category_id',x.category_id,'category_name',x.category_name,
    'location_id',x.location_id,'location_name',x.location_name,
    'launch_ready',(verified_value and profile_complete_value and x.scope_enabled)
  ) order by x.created_at desc),'[]'::jsonb)
  into service_rows
  from (
    select s.id,s.name,s.status::text,s.created_at,
           public.service_scope_is_launchable(s.id) as scope_enabled,
           ses.application_id,pa.name as application_name,
           ses.category_id,pc.name as category_name,
           ses.location_id,pl.name as location_name
    from public.services s
    left join public.service_ecosystem_scope ses on ses.service_id=s.id and ses.enabled=true
    left join public.platform_applications pa on pa.id=ses.application_id
    left join public.platform_categories pc on pc.id=ses.category_id
    left join public.platform_locations pl on pl.id=ses.location_id
    where (ptype='business' and s.business_id=provider_id)
       or (ptype='professional' and s.professional_id=provider_id)
  ) x;

  return jsonb_build_object(
    'provider_type',ptype,
    'provider_id',provider_id,
    'profile_complete',profile_complete_value,
    'verified',verified_value,
    'services_total',services_total_value,
    'services_scoped',services_scoped_value,
    'services_active',services_active_value,
    'pending_launch_requests',pending_launch_value,
    'first_service_created',services_total_value>0,
    'first_service_scoped',services_scoped_value>0,
    'marketplace_live',services_active_value>0,
    'progress_percent',(
      ((case when profile_complete_value then 1 else 0 end)+
       (case when verified_value then 1 else 0 end)+
       (case when services_total_value>0 then 1 else 0 end)+
       (case when services_scoped_value>0 then 1 else 0 end)+
       (case when services_active_value>0 then 1 else 0 end))*20
    ),
    'services',service_rows
  );
end;
$$;

revoke all on function public.get_provider_setup_readiness_for_type(text) from public,anon;
grant execute on function public.get_provider_setup_readiness_for_type(text) to authenticated;

create or replace function public.submit_service_launch_request_for_type(
  requested_provider_type text,
  target_service_id uuid,
  target_application_id uuid,
  target_category_id uuid,
  target_location_id uuid
)
returns public.service_launch_requests
language plpgsql
security definer
set search_path = ''
as $$
declare
  req public.service_launch_requests%rowtype;
  ptype text:=lower(btrim(coalesce(requested_provider_type,'')));
  professional_id_value uuid;
  business_id_value uuid;
  owned boolean:=false;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if ptype not in ('professional','business') then raise exception 'Provider type must be professional or business.'; end if;

  if ptype='business' then
    select id into business_id_value from public.businesses where owner_user_id=auth.uid() limit 1;
    if business_id_value is null then raise exception 'Business provider account is required.'; end if;
  else
    select id into professional_id_value from public.professional_profiles where user_id=auth.uid() limit 1;
    if professional_id_value is null then raise exception 'Professional provider account is required.'; end if;
  end if;

  select exists(
    select 1 from public.services s
    where s.id=target_service_id
      and ((ptype='business' and s.business_id=business_id_value)
        or (ptype='professional' and s.professional_id=professional_id_value))
  ) into owned;
  if not owned then raise exception 'Service was not found or is not owned by this provider workspace.'; end if;
  if not public.provider_profile_is_complete(ptype,professional_id_value,business_id_value) then
    raise exception 'Complete your provider profile before requesting service launch.';
  end if;
  if exists(select 1 from public.services where id=target_service_id and status='active'::public.service_status) then
    raise exception 'This service is already active.';
  end if;
  if not exists(select 1 from public.platform_applications where id=target_application_id and status='active') then
    raise exception 'Selected application is not available.';
  end if;
  if not exists(select 1 from public.platform_categories where id=target_category_id and application_id=target_application_id and active=true) then
    raise exception 'Selected category is not available for this application.';
  end if;
  if not exists(select 1 from public.platform_locations where id=target_location_id and active=true) then
    raise exception 'Selected location is not available.';
  end if;
  if exists(select 1 from public.service_launch_requests where service_id=target_service_id and status='pending') then
    raise exception 'A launch request is already awaiting review for this service.';
  end if;
  if exists(
    select 1 from public.service_ecosystem_scope
    where service_id=target_service_id and enabled=true
      and application_id=target_application_id
      and category_id=target_category_id
      and location_id=target_location_id
  ) then
    raise exception 'This service already has the requested approved scope.';
  end if;

  insert into public.service_launch_requests(
    applicant_user_id,service_id,requested_application_id,requested_category_id,requested_location_id,status
  ) values (
    auth.uid(),target_service_id,target_application_id,target_category_id,target_location_id,'pending'
  ) returning * into req;

  insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note)
  values(req.id,auth.uid(),'provider','submitted','Service launch scope submitted for platform review.');
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(auth.uid(),'service_launch_submitted','Service launch requested','Your service category and location request is awaiting platform review.');
  return req;
end;
$$;

revoke all on function public.submit_service_launch_request_for_type(text,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.submit_service_launch_request_for_type(text,uuid,uuid,uuid,uuid) to authenticated;
