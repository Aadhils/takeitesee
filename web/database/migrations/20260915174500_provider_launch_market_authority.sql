-- Make Super Admin application market availability authoritative for Provider service launch.
--
-- Existing platform_locations remain the geographic registry, while application_locations
-- decides which active locations an application can actually launch into.
-- Finance, payments, recurrence, recovery, and settlement behavior are intentionally untouched.

create or replace function private.service_scope_is_launchable(p_service_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select exists(
    select 1
    from public.services s
    join public.service_ecosystem_scope ses on ses.service_id=s.id
    join public.platform_applications pa on pa.id=ses.application_id
    join public.platform_categories pc on pc.id=ses.category_id and pc.application_id=ses.application_id
    join public.platform_locations pl on pl.id=ses.location_id
    join public.application_locations al
      on al.application_id=ses.application_id
     and al.location_id=ses.location_id
     and al.enabled=true
    where s.id=p_service_id
      and ses.enabled=true
      and pa.status='active'
      and pc.active=true
      and pl.active=true
      and btrim(coalesce(s.category,''))=pc.name
      and btrim(coalesce(s.location,''))=pl.name
  );
$$;
revoke all on function private.service_scope_is_launchable(uuid) from public;

create or replace function public.get_provider_launch_options()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.businesses where owner_user_id=auth.uid())
     and not exists(select 1 from public.professional_profiles where user_id=auth.uid()) then
    raise exception 'Provider account is required.';
  end if;

  return jsonb_build_object(
    'applications', coalesce((
      select jsonb_agg(jsonb_build_object('id',pa.id,'code',pa.code,'name',pa.name) order by pa.sort_order,pa.name)
      from public.platform_applications pa
      where pa.status='active'
    ), '[]'::jsonb),
    'categories', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pc.id,
        'application_id',pc.application_id,
        'code',pc.code,
        'name',pc.name,
        'parent_id',pc.parent_id
      ) order by pc.sort_order,pc.name)
      from public.platform_categories pc
      join public.platform_applications pa on pa.id=pc.application_id
      where pc.active=true and pa.status='active'
    ), '[]'::jsonb),
    'locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pl.id,
        'type',pl.type::text,
        'code',pl.code,
        'name',pl.name,
        'country_code',pl.country_code,
        'timezone',pl.timezone
      ) order by pl.name)
      from public.platform_locations pl
      where pl.active=true
        and exists(
          select 1
          from public.application_locations al
          join public.platform_applications pa on pa.id=al.application_id and pa.status='active'
          where al.location_id=pl.id and al.enabled=true
        )
    ), '[]'::jsonb),
    'application_locations', coalesce((
      select jsonb_agg(jsonb_build_object(
        'application_id',al.application_id,
        'location_id',al.location_id
      ) order by al.application_id,al.location_id)
      from public.application_locations al
      join public.platform_applications pa on pa.id=al.application_id
      join public.platform_locations pl on pl.id=al.location_id
      where al.enabled=true
        and pa.status='active'
        and pl.active=true
    ), '[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_provider_launch_options() from public,anon;
grant execute on function public.get_provider_launch_options() to authenticated;

create or replace function public.submit_service_launch_request(
  target_service_id uuid,
  target_application_id uuid,
  target_category_id uuid,
  target_location_id uuid
)
returns public.service_launch_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  req public.service_launch_requests%rowtype;
  owned boolean:=false;
  ptype text;
  professional_id_value uuid;
  business_id_value uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select id into business_id_value from public.businesses where owner_user_id=auth.uid() limit 1;
  if business_id_value is not null then
    ptype:='business';
  else
    select id into professional_id_value from public.professional_profiles where user_id=auth.uid() limit 1;
    ptype:='professional';
  end if;
  if coalesce(business_id_value,professional_id_value) is null then raise exception 'Provider account is required.'; end if;

  select exists(
    select 1 from public.services s
    where s.id=target_service_id
      and ((ptype='business' and s.business_id=business_id_value) or (ptype='professional' and s.professional_id=professional_id_value))
  ) into owned;
  if not owned then raise exception 'Service was not found or is not owned by this provider.'; end if;
  if not public.provider_profile_is_complete(ptype,professional_id_value,business_id_value) then raise exception 'Complete your provider profile before requesting service launch.'; end if;
  if exists(select 1 from public.services where id=target_service_id and status='active'::public.service_status) then raise exception 'This service is already active.'; end if;
  if not exists(select 1 from public.platform_applications where id=target_application_id and status='active') then raise exception 'Selected application is not available.'; end if;
  if not exists(select 1 from public.platform_categories where id=target_category_id and application_id=target_application_id and active=true) then raise exception 'Selected category is not available for this application.'; end if;
  if not exists(select 1 from public.platform_locations where id=target_location_id and active=true) then raise exception 'Selected location is not available.'; end if;
  if not exists(
    select 1 from public.application_locations
    where application_id=target_application_id and location_id=target_location_id and enabled=true
  ) then raise exception 'Selected location is not enabled for this application.'; end if;
  if exists(select 1 from public.service_launch_requests where service_id=target_service_id and status='pending') then raise exception 'A launch request is already awaiting review for this service.'; end if;
  if exists(select 1 from public.service_ecosystem_scope where service_id=target_service_id and enabled=true and application_id=target_application_id and category_id=target_category_id and location_id=target_location_id) then raise exception 'This service already has the requested approved scope.'; end if;

  insert into public.service_launch_requests(applicant_user_id,service_id,requested_application_id,requested_category_id,requested_location_id,status)
  values(auth.uid(),target_service_id,target_application_id,target_category_id,target_location_id,'pending')
  returning * into req;
  insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note)
  values(req.id,auth.uid(),'provider','submitted','Service launch scope submitted for platform review.');
  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(auth.uid(),'service_launch_submitted','Service launch requested','Your service category and location request is awaiting platform review.','/provider/setup');
  return req;
end;
$$;
revoke all on function public.submit_service_launch_request(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.submit_service_launch_request(uuid,uuid,uuid,uuid) to authenticated;

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
set search_path=''
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
      and ((ptype='business' and s.business_id=business_id_value) or (ptype='professional' and s.professional_id=professional_id_value))
  ) into owned;
  if not owned then raise exception 'Service was not found or is not owned by this provider workspace.'; end if;
  if not public.provider_profile_is_complete(ptype,professional_id_value,business_id_value) then raise exception 'Complete your provider profile before requesting service launch.'; end if;
  if exists(select 1 from public.services where id=target_service_id and status='active'::public.service_status) then raise exception 'This service is already active.'; end if;
  if not exists(select 1 from public.platform_applications where id=target_application_id and status='active') then raise exception 'Selected application is not available.'; end if;
  if not exists(select 1 from public.platform_categories where id=target_category_id and application_id=target_application_id and active=true) then raise exception 'Selected category is not available for this application.'; end if;
  if not exists(select 1 from public.platform_locations where id=target_location_id and active=true) then raise exception 'Selected location is not available.'; end if;
  if not exists(
    select 1 from public.application_locations
    where application_id=target_application_id and location_id=target_location_id and enabled=true
  ) then raise exception 'Selected location is not enabled for this application.'; end if;
  if exists(select 1 from public.service_launch_requests where service_id=target_service_id and status='pending') then raise exception 'A launch request is already awaiting review for this service.'; end if;
  if exists(select 1 from public.service_ecosystem_scope where service_id=target_service_id and enabled=true and application_id=target_application_id and category_id=target_category_id and location_id=target_location_id) then raise exception 'This service already has the requested approved scope.'; end if;

  insert into public.service_launch_requests(applicant_user_id,service_id,requested_application_id,requested_category_id,requested_location_id,status)
  values(auth.uid(),target_service_id,target_application_id,target_category_id,target_location_id,'pending')
  returning * into req;
  insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note)
  values(req.id,auth.uid(),'provider','submitted','Service launch scope submitted for platform review.');
  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(auth.uid(),'service_launch_submitted','Service launch requested','Your service category and location request is awaiting platform review.','/provider/setup');
  return req;
end;
$$;
revoke all on function public.submit_service_launch_request_for_type(text,uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.submit_service_launch_request_for_type(text,uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.review_service_launch_request(
  target_request_id uuid,
  decision text,
  reviewer_note text default null
)
returns public.service_launch_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  req public.service_launch_requests%rowtype;
  note_value text:=nullif(btrim(coalesce(reviewer_note,'')),'');
  category_name_value text;
  location_name_value text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if decision not in ('approve','changes_requested','reject') then raise exception 'Choose approve, changes_requested, or reject.'; end if;
  select * into req from public.service_launch_requests where id=target_request_id and status='pending' for update;
  if not found then raise exception 'Pending service launch request was not found.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(req.requested_application_id,req.requested_location_id,req.requested_category_id,req.service_id)) then raise exception 'Manage permission for this service scope is required.'; end if;
  if req.applicant_user_id=auth.uid() then raise exception 'You cannot review your own service launch request.'; end if;
  if decision<>'approve' and (note_value is null or char_length(note_value)<3) then raise exception 'A review reason is required.'; end if;
  if note_value is not null and char_length(note_value)>1200 then raise exception 'Review note must be 1200 characters or fewer.'; end if;

  if decision='approve' then
    if not exists(select 1 from public.platform_applications where id=req.requested_application_id and status='active') then raise exception 'Requested application is no longer active.'; end if;
    select name into category_name_value from public.platform_categories where id=req.requested_category_id and application_id=req.requested_application_id and active=true;
    select name into location_name_value from public.platform_locations where id=req.requested_location_id and active=true;
    if category_name_value is null or location_name_value is null then raise exception 'Requested category or location is no longer active.'; end if;
    if not exists(
      select 1 from public.application_locations
      where application_id=req.requested_application_id and location_id=req.requested_location_id and enabled=true
    ) then raise exception 'Requested location is no longer enabled for this application.'; end if;

    insert into public.service_ecosystem_scope(service_id,application_id,category_id,location_id,enabled,created_at,updated_at)
    values(req.service_id,req.requested_application_id,req.requested_category_id,req.requested_location_id,true,now(),now())
    on conflict (service_id) do update set
      application_id=excluded.application_id,
      category_id=excluded.category_id,
      location_id=excluded.location_id,
      enabled=true,
      updated_at=now();
    update public.services set category=category_name_value,location=location_name_value,updated_at=now() where id=req.service_id;
    update public.service_launch_requests set status='approved',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note)
    values(req.id,auth.uid(),'admin','approved',coalesce(note_value,'Service category and location approved.'));
    insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
    values(req.applicant_user_id,'service_launch_approved','Service launch scope approved','Your service category and location are approved. If verification is complete, you can activate the service.','/provider/setup');
  elsif decision='changes_requested' then
    update public.service_launch_requests set status='changes_requested',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','changes_requested',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body,target_path) values(req.applicant_user_id,'service_launch_changes','Service launch needs changes',note_value,'/provider/setup');
  else
    update public.service_launch_requests set status='rejected',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','rejected',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body,target_path) values(req.applicant_user_id,'service_launch_rejected','Service launch request not approved',note_value,'/provider/setup');
  end if;
  return req;
end;
$$;
revoke all on function public.review_service_launch_request(uuid,text,text) from public,anon;
grant execute on function public.review_service_launch_request(uuid,text,text) to authenticated;
