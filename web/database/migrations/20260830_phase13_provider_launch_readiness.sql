-- Phase 13 Module 3: provider setup readiness and controlled service launch.

create table if not exists public.service_launch_requests (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references public.users(id) on delete cascade,
  service_id uuid not null references public.services(id) on delete cascade,
  requested_application_id uuid not null references public.platform_applications(id) on delete restrict,
  requested_category_id uuid not null references public.platform_categories(id) on delete restrict,
  requested_location_id uuid not null references public.platform_locations(id) on delete restrict,
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','rejected','withdrawn')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (review_note is null or char_length(review_note) <= 1200)
);

create unique index if not exists service_launch_requests_one_pending_per_service_idx
  on public.service_launch_requests(service_id) where status='pending';
create index if not exists service_launch_requests_status_created_idx
  on public.service_launch_requests(status, created_at desc);
create index if not exists service_launch_requests_applicant_created_idx
  on public.service_launch_requests(applicant_user_id, created_at desc);

create table if not exists public.service_launch_events (
  id uuid primary key default gen_random_uuid(),
  launch_request_id uuid not null references public.service_launch_requests(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null check (actor_type in ('provider','admin','system')),
  event_type text not null check (event_type in ('submitted','withdrawn','approved','changes_requested','rejected')),
  note text,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 1200)
);
create index if not exists service_launch_events_request_created_idx
  on public.service_launch_events(launch_request_id, created_at);

alter table public.service_launch_requests enable row level security;
alter table public.service_launch_events enable row level security;

drop policy if exists service_launch_requests_private_read on public.service_launch_requests;
create policy service_launch_requests_private_read on public.service_launch_requests
for select to authenticated using (
  applicant_user_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_view(requested_application_id, requested_location_id, requested_category_id, service_id)
);

drop policy if exists service_launch_events_private_read on public.service_launch_events;
create policy service_launch_events_private_read on public.service_launch_events
for select to authenticated using (
  exists (
    select 1 from public.service_launch_requests r
    where r.id=service_launch_events.launch_request_id
      and (
        r.applicant_user_id=auth.uid()
        or public.is_super_admin()
        or public.admin_can_view(r.requested_application_id, r.requested_location_id, r.requested_category_id, r.service_id)
      )
  )
);

revoke insert,update,delete on public.service_launch_requests from anon,authenticated;
revoke insert,update,delete on public.service_launch_events from anon,authenticated;

-- Provider profiles are public only after verification. Owners can always read their own profile.
drop policy if exists businesses_public_read on public.businesses;
drop policy if exists businesses_public_verified_read on public.businesses;
create policy businesses_public_verified_read on public.businesses
for select to anon,authenticated using (verified=true);
drop policy if exists businesses_owner_read on public.businesses;
create policy businesses_owner_read on public.businesses
for select to authenticated using (owner_user_id=auth.uid() or public.is_super_admin());

drop policy if exists professionals_public_read on public.professional_profiles;
drop policy if exists professionals_public_verified_read on public.professional_profiles;
create policy professionals_public_verified_read on public.professional_profiles
for select to anon,authenticated using (verified=true);
drop policy if exists professionals_owner_read on public.professional_profiles;
create policy professionals_owner_read on public.professional_profiles
for select to authenticated using (user_id=auth.uid() or public.is_super_admin());

create or replace function public.provider_profile_is_complete(
  p_provider_type text,
  p_professional_id uuid,
  p_business_id uuid
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select case
    when p_provider_type='professional' then exists(
      select 1 from public.professional_profiles p
      where p.id=p_professional_id
        and char_length(btrim(coalesce(p.headline,''))) >= 2
        and char_length(btrim(coalesce(p.description,''))) >= 20
        and char_length(btrim(coalesce(p.service_area,''))) >= 2
    )
    when p_provider_type='business' then exists(
      select 1 from public.businesses b
      where b.id=p_business_id
        and char_length(btrim(coalesce(b.name,''))) >= 2
        and char_length(btrim(coalesce(b.description,''))) >= 20
        and char_length(btrim(coalesce(b.location,''))) >= 2
    )
    else false
  end;
$$;
revoke all on function public.provider_profile_is_complete(text,uuid,uuid) from public;
grant execute on function public.provider_profile_is_complete(text,uuid,uuid) to anon,authenticated,service_role;

create or replace function public.service_scope_is_launchable(p_service_id uuid)
returns boolean
language sql stable security definer set search_path=''
as $$
  select exists(
    select 1
    from public.service_ecosystem_scope ses
    join public.platform_applications pa on pa.id=ses.application_id
    join public.platform_categories pc on pc.id=ses.category_id and pc.application_id=ses.application_id
    join public.platform_locations pl on pl.id=ses.location_id
    where ses.service_id=p_service_id
      and ses.enabled=true
      and pa.status='active'
      and pc.active=true
      and pl.active=true
  );
$$;
revoke all on function public.service_scope_is_launchable(uuid) from public;
grant execute on function public.service_scope_is_launchable(uuid) to anon,authenticated,service_role;

-- Canonicalize already-approved service metadata before enforcing the gate.
update public.services s
set category=pc.name,
    location=pl.name,
    updated_at=now()
from public.service_ecosystem_scope ses
join public.platform_categories pc on pc.id=ses.category_id
join public.platform_locations pl on pl.id=ses.location_id
where ses.service_id=s.id
  and ses.enabled=true
  and (s.category is distinct from pc.name or s.location is distinct from pl.name);

-- Old active services without a valid platform scope are not production-launchable.
update public.services s
set status='paused'::public.service_status,
    active=false,
    updated_at=now()
where s.status='active'::public.service_status
  and not public.service_scope_is_launchable(s.id);

-- Public service visibility now requires verified owner, complete profile, and approved ecosystem scope.
drop policy if exists services_public_read_verified_active on public.services;
drop policy if exists services_public_read_launch_ready on public.services;
create policy services_public_read_launch_ready on public.services
for select to anon,authenticated using (
  status='active'::public.service_status
  and active=true
  and public.provider_owner_is_verified(provider_type::text,professional_id,business_id)
  and public.provider_profile_is_complete(provider_type::text,professional_id,business_id)
  and public.service_scope_is_launchable(id)
);

-- Direct provider writes remain owner-scoped and cannot bypass the launch gate.
drop policy if exists services_provider_insert_own on public.services;
create policy services_provider_insert_own on public.services for insert to authenticated with check (
  ((exists(select 1 from public.professional_profiles pp where pp.id=services.professional_id and pp.user_id=auth.uid())) or
   (exists(select 1 from public.businesses b where b.id=services.business_id and b.owner_user_id=auth.uid())))
  and (
    (status<>'active'::public.service_status and active=false)
    or (
      public.provider_owner_is_verified(provider_type::text,professional_id,business_id)
      and public.provider_profile_is_complete(provider_type::text,professional_id,business_id)
      and public.service_scope_is_launchable(id)
    )
  )
);

drop policy if exists services_provider_update_own on public.services;
create policy services_provider_update_own on public.services for update to authenticated
using ((exists(select 1 from public.professional_profiles pp where pp.id=services.professional_id and pp.user_id=auth.uid())) or (exists(select 1 from public.businesses b where b.id=services.business_id and b.owner_user_id=auth.uid())))
with check (
  ((exists(select 1 from public.professional_profiles pp where pp.id=services.professional_id and pp.user_id=auth.uid())) or
   (exists(select 1 from public.businesses b where b.id=services.business_id and b.owner_user_id=auth.uid())))
  and (
    (status<>'active'::public.service_status and active=false)
    or (
      public.provider_owner_is_verified(provider_type::text,professional_id,business_id)
      and public.provider_profile_is_complete(provider_type::text,professional_id,business_id)
      and public.service_scope_is_launchable(id)
    )
  )
);

create or replace function public.guard_service_publish_verified_provider()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare
  scope_category text;
  scope_location text;
begin
  new.active := (new.status='active'::public.service_status);
  if new.status='active'::public.service_status then
    if not public.provider_owner_is_verified(new.provider_type::text,new.professional_id,new.business_id) then
      raise exception 'Provider verification is required before a service can be published.';
    end if;
    if not public.provider_profile_is_complete(new.provider_type::text,new.professional_id,new.business_id) then
      raise exception 'Complete the provider profile before publishing a service.';
    end if;
    if not public.service_scope_is_launchable(new.id) then
      raise exception 'Platform category and location approval is required before a service can be published.';
    end if;
    select pc.name,pl.name into scope_category,scope_location
    from public.service_ecosystem_scope ses
    join public.platform_categories pc on pc.id=ses.category_id
    join public.platform_locations pl on pl.id=ses.location_id
    where ses.service_id=new.id and ses.enabled=true;
    if btrim(coalesce(new.category,'')) is distinct from scope_category
       or btrim(coalesce(new.location,'')) is distinct from scope_location then
      raise exception 'Service category and location must match the approved platform scope.';
    end if;
  end if;
  return new;
end;
$$;
drop trigger if exists services_guard_verified_publish on public.services;
create trigger services_guard_verified_publish
before insert or update of status,active,professional_id,business_id,provider_type,category,location on public.services
for each row execute function public.guard_service_publish_verified_provider();

create or replace function public.update_provider_profile(
  requested_display_name text,
  requested_description text,
  requested_location text
)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  business_id_value uuid;
  professional_id_value uuid;
  display_value text:=btrim(coalesce(requested_display_name,''));
  description_value text:=nullif(btrim(coalesce(requested_description,'')),'');
  location_value text:=btrim(coalesce(requested_location,''));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if char_length(display_value)<2 or char_length(display_value)>120 then raise exception 'Display name must be 2 to 120 characters.'; end if;
  if description_value is not null and char_length(description_value)>1200 then raise exception 'Description must be 1200 characters or fewer.'; end if;
  if char_length(location_value)<2 or char_length(location_value)>160 then raise exception 'Service area must be 2 to 160 characters.'; end if;

  select id into business_id_value from public.businesses where owner_user_id=auth.uid() limit 1;
  if business_id_value is not null then
    update public.businesses
      set name=display_value,description=description_value,location=location_value,updated_at=now()
      where id=business_id_value;
    return jsonb_build_object('provider_type','business','provider_id',business_id_value);
  end if;

  select id into professional_id_value from public.professional_profiles where user_id=auth.uid() limit 1;
  if professional_id_value is null then raise exception 'Provider profile was not found.'; end if;
  update public.professional_profiles
    set headline=display_value,description=description_value,service_area=location_value,updated_at=now()
    where id=professional_id_value;
  return jsonb_build_object('provider_type','professional','provider_id',professional_id_value);
end;
$$;
revoke all on function public.update_provider_profile(text,text,text) from public,anon;
grant execute on function public.update_provider_profile(text,text,text) to authenticated;

create or replace function public.get_provider_launch_options()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not exists(select 1 from public.businesses where owner_user_id=auth.uid())
     and not exists(select 1 from public.professional_profiles where user_id=auth.uid()) then
    raise exception 'Provider account is required.';
  end if;
  return jsonb_build_object(
    'applications', coalesce((select jsonb_agg(jsonb_build_object('id',id,'code',code,'name',name) order by sort_order,name) from public.platform_applications where status='active'),'[]'::jsonb),
    'categories', coalesce((select jsonb_agg(jsonb_build_object('id',pc.id,'application_id',pc.application_id,'code',pc.code,'name',pc.name,'parent_id',pc.parent_id) order by pc.sort_order,pc.name) from public.platform_categories pc join public.platform_applications pa on pa.id=pc.application_id where pc.active=true and pa.status='active'),'[]'::jsonb),
    'locations', coalesce((select jsonb_agg(jsonb_build_object('id',id,'type',type::text,'code',code,'name',name,'country_code',country_code,'timezone',timezone) order by name) from public.platform_locations where active=true),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.get_provider_launch_options() from public,anon;
grant execute on function public.get_provider_launch_options() to authenticated;

create or replace function public.get_provider_setup_readiness()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  ptype text;
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
  select id,verified into business_id_value,verified_value from public.businesses where owner_user_id=auth.uid() limit 1;
  if business_id_value is not null then
    ptype:='business'; provider_id:=business_id_value;
  else
    select id,verified into professional_id_value,verified_value from public.professional_profiles where user_id=auth.uid() limit 1;
    if professional_id_value is null then raise exception 'Provider account is required.'; end if;
    ptype:='professional'; provider_id:=professional_id_value;
  end if;
  profile_complete_value:=public.provider_profile_is_complete(ptype,professional_id_value,business_id_value);

  select count(*)::int,
         count(*) filter (where public.service_scope_is_launchable(s.id))::int,
         count(*) filter (where s.status='active'::public.service_status and s.active=true)::int
  into services_total_value,services_scoped_value,services_active_value
  from public.services s
  where (ptype='business' and s.business_id=provider_id) or (ptype='professional' and s.professional_id=provider_id);

  select count(*)::int into pending_launch_value from public.service_launch_requests where applicant_user_id=auth.uid() and status='pending';

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',x.id,'name',x.name,'status',x.status,'scope_enabled',x.scope_enabled,
    'application_id',x.application_id,'application_name',x.application_name,
    'category_id',x.category_id,'category_name',x.category_name,
    'location_id',x.location_id,'location_name',x.location_name,
    'launch_ready', (verified_value and profile_complete_value and x.scope_enabled)
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
    where (ptype='business' and s.business_id=provider_id) or (ptype='professional' and s.professional_id=provider_id)
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
revoke all on function public.get_provider_setup_readiness() from public,anon;
grant execute on function public.get_provider_setup_readiness() to authenticated;

create or replace function public.submit_service_launch_request(
  target_service_id uuid,
  target_application_id uuid,
  target_category_id uuid,
  target_location_id uuid
)
returns public.service_launch_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  req public.service_launch_requests%rowtype;
  owned boolean:=false;
  ptype text;
  professional_id_value uuid;
  business_id_value uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select id into business_id_value from public.businesses where owner_user_id=auth.uid() limit 1;
  if business_id_value is not null then ptype:='business';
  else select id into professional_id_value from public.professional_profiles where user_id=auth.uid() limit 1; ptype:='professional'; end if;
  if coalesce(business_id_value,professional_id_value) is null then raise exception 'Provider account is required.'; end if;
  select exists(select 1 from public.services s where s.id=target_service_id and ((ptype='business' and s.business_id=business_id_value) or (ptype='professional' and s.professional_id=professional_id_value))) into owned;
  if not owned then raise exception 'Service was not found or is not owned by this provider.'; end if;
  if not public.provider_profile_is_complete(ptype,professional_id_value,business_id_value) then raise exception 'Complete your provider profile before requesting service launch.'; end if;
  if exists(select 1 from public.services where id=target_service_id and status='active'::public.service_status) then raise exception 'This service is already active.'; end if;
  if not exists(select 1 from public.platform_applications where id=target_application_id and status='active') then raise exception 'Selected application is not available.'; end if;
  if not exists(select 1 from public.platform_categories where id=target_category_id and application_id=target_application_id and active=true) then raise exception 'Selected category is not available for this application.'; end if;
  if not exists(select 1 from public.platform_locations where id=target_location_id and active=true) then raise exception 'Selected location is not available.'; end if;
  if exists(select 1 from public.service_launch_requests where service_id=target_service_id and status='pending') then raise exception 'A launch request is already awaiting review for this service.'; end if;
  if exists(select 1 from public.service_ecosystem_scope where service_id=target_service_id and enabled=true and application_id=target_application_id and category_id=target_category_id and location_id=target_location_id) then raise exception 'This service already has the requested approved scope.'; end if;

  insert into public.service_launch_requests(applicant_user_id,service_id,requested_application_id,requested_category_id,requested_location_id,status)
  values(auth.uid(),target_service_id,target_application_id,target_category_id,target_location_id,'pending') returning * into req;
  insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note)
  values(req.id,auth.uid(),'provider','submitted','Service launch scope submitted for platform review.');
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(auth.uid(),'service_launch_submitted','Service launch requested','Your service category and location request is awaiting platform review.');
  return req;
end;
$$;
revoke all on function public.submit_service_launch_request(uuid,uuid,uuid,uuid) from public,anon;
grant execute on function public.submit_service_launch_request(uuid,uuid,uuid,uuid) to authenticated;

create or replace function public.withdraw_service_launch_request(target_request_id uuid)
returns public.service_launch_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare req public.service_launch_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.service_launch_requests set status='withdrawn',updated_at=now()
  where id=target_request_id and applicant_user_id=auth.uid() and status='pending' returning * into req;
  if req.id is null then raise exception 'Pending service launch request was not found.'; end if;
  insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note)
  values(req.id,auth.uid(),'provider','withdrawn','Provider withdrew the service launch request.');
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(auth.uid(),'service_launch_withdrawn','Service launch request withdrawn','Your service launch request was withdrawn.');
  return req;
end;
$$;
revoke all on function public.withdraw_service_launch_request(uuid) from public,anon;
grant execute on function public.withdraw_service_launch_request(uuid) to authenticated;

create or replace function public.review_service_launch_request(
  target_request_id uuid,
  decision text,
  reviewer_note text default null
)
returns public.service_launch_requests
language plpgsql security definer set search_path=public,pg_temp as $$
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

    insert into public.service_ecosystem_scope(service_id,application_id,category_id,location_id,enabled,created_at,updated_at)
    values(req.service_id,req.requested_application_id,req.requested_category_id,req.requested_location_id,true,now(),now())
    on conflict (service_id) do update set application_id=excluded.application_id,category_id=excluded.category_id,location_id=excluded.location_id,enabled=true,updated_at=now();
    update public.services set category=category_name_value,location=location_name_value,updated_at=now() where id=req.service_id;
    update public.service_launch_requests set status='approved',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note)
    values(req.id,auth.uid(),'admin','approved',coalesce(note_value,'Service category and location approved.'));
    insert into public.notifications(recipient_user_id,event_type,title,body)
    values(req.applicant_user_id,'service_launch_approved','Service launch scope approved','Your service category and location are approved. If verification is complete, you can activate the service.');
  elsif decision='changes_requested' then
    update public.service_launch_requests set status='changes_requested',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note)
    values(req.id,auth.uid(),'admin','changes_requested',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body)
    values(req.applicant_user_id,'service_launch_changes','Service launch needs changes',note_value);
  else
    update public.service_launch_requests set status='rejected',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.service_launch_events(launch_request_id,actor_user_id,actor_type,event_type,note)
    values(req.id,auth.uid(),'admin','rejected',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body)
    values(req.applicant_user_id,'service_launch_rejected','Service launch request not approved',note_value);
  end if;
  return req;
end;
$$;
revoke all on function public.review_service_launch_request(uuid,text,text) from public,anon;
grant execute on function public.review_service_launch_request(uuid,text,text) to authenticated;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (event_type=any(array[
  'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
  'reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded',
  'review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
  'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
  'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
  'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected'
]));
