-- Allow one authenticated account to add the missing Professional or Business
-- provider identity while preserving the existing provider/admin role and the
-- Phase 17 hardened RPC execution boundary.

create or replace function public.submit_provider_application(
  requested_provider_type text,
  requested_display_name text,
  requested_description text,
  requested_location text
)
returns public.provider_applications
language plpgsql
security definer
set search_path=''
as $$
declare
  app public.provider_applications%rowtype;
  name_value text:=btrim(coalesce(requested_display_name,''));
  description_value text:=nullif(btrim(coalesce(requested_description,'')),'');
  location_value text:=btrim(coalesce(requested_location,''));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if requested_provider_type not in ('professional','business') then raise exception 'Choose professional or business provider type.'; end if;
  if char_length(name_value)<2 or char_length(name_value)>120 then raise exception 'Provider name must be 2 to 120 characters.'; end if;
  if description_value is not null and char_length(description_value)>1200 then raise exception 'Description must be 1200 characters or fewer.'; end if;
  if char_length(location_value)<2 or char_length(location_value)>160 then raise exception 'Service location must be 2 to 160 characters.'; end if;

  if not exists(select 1 from public.users where id=auth.uid()) then
    raise exception 'Account profile is missing.';
  end if;

  if requested_provider_type='professional' and exists(select 1 from public.professional_profiles where user_id=auth.uid()) then
    raise exception 'This account already owns a Professional profile.';
  end if;
  if requested_provider_type='business' and exists(select 1 from public.businesses where owner_user_id=auth.uid()) then
    raise exception 'This account already owns a Business profile.';
  end if;
  if exists(select 1 from public.provider_applications where applicant_user_id=auth.uid() and status='pending') then
    raise exception 'A provider application is already awaiting review.';
  end if;

  insert into public.provider_applications(applicant_user_id,provider_type,display_name,description,location,status)
  values(auth.uid(),requested_provider_type,name_value,description_value,location_value,'pending')
  returning * into app;

  insert into public.provider_application_events(application_id,actor_user_id,actor_type,event_type,note)
  values(app.id,auth.uid(),'applicant','submitted','Provider onboarding application submitted for platform review.');

  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(auth.uid(),'provider_application_submitted','Provider application submitted','Your provider application is awaiting platform review.');

  return app;
end;
$$;

create or replace function public.review_provider_application(
  target_application_id uuid,
  decision text,
  reviewer_note text default null
)
returns public.provider_applications
language plpgsql
security definer
set search_path=''
as $$
declare
  app public.provider_applications%rowtype;
  provider_id uuid;
  note_value text:=nullif(btrim(coalesce(reviewer_note,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then
    raise exception 'Platform manage permission is required.';
  end if;
  if decision not in ('approve','reject') then raise exception 'Decision must be approve or reject.'; end if;
  if decision='reject' and (note_value is null or char_length(note_value)<3) then raise exception 'A rejection reason is required.'; end if;
  if note_value is not null and char_length(note_value)>1000 then raise exception 'Review note must be 1000 characters or fewer.'; end if;

  select * into app from public.provider_applications where id=target_application_id and status='pending' for update;
  if not found then raise exception 'Pending provider application was not found.'; end if;
  if app.applicant_user_id=auth.uid() then raise exception 'You cannot review your own provider application.'; end if;

  if decision='approve' then
    if app.provider_type='professional' then
      if exists(select 1 from public.professional_profiles where user_id=app.applicant_user_id) then
        raise exception 'Applicant already owns a Professional profile.';
      end if;
      insert into public.professional_profiles(user_id,headline,description,service_area,verified)
      values(app.applicant_user_id,app.display_name,app.description,app.location,false)
      returning id into provider_id;
      update public.users
        set role='professional'::public.platform_role, updated_at=now()
        where id=app.applicant_user_id and role='customer'::public.platform_role;
    else
      if exists(select 1 from public.businesses where owner_user_id=app.applicant_user_id) then
        raise exception 'Applicant already owns a Business profile.';
      end if;
      insert into public.businesses(owner_user_id,name,description,location,verified)
      values(app.applicant_user_id,app.display_name,app.description,app.location,false)
      returning id into provider_id;
      update public.users
        set role='business'::public.platform_role, updated_at=now()
        where id=app.applicant_user_id and role='customer'::public.platform_role;
    end if;

    update public.provider_applications
      set status='approved',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),result_provider_id=provider_id,updated_at=now()
      where id=app.id returning * into app;

    insert into public.provider_application_events(application_id,actor_user_id,actor_type,event_type,note)
    values(app.id,auth.uid(),'admin','approved',coalesce(note_value,'Provider application approved.'));
    insert into public.notifications(recipient_user_id,event_type,title,body)
    values(app.applicant_user_id,'provider_application_approved','Provider application approved','Your provider workspace is now active. Verification is still required before the provider is marked verified.');
  else
    update public.provider_applications
      set status='rejected',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
      where id=app.id returning * into app;
    insert into public.provider_application_events(application_id,actor_user_id,actor_type,event_type,note)
    values(app.id,auth.uid(),'admin','rejected',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body)
    values(app.applicant_user_id,'provider_application_rejected','Provider application needs changes',note_value);
  end if;
  return app;
end;
$$;

revoke all on function public.submit_provider_application(text,text,text,text) from public, anon;
grant execute on function public.submit_provider_application(text,text,text,text) to authenticated;
revoke all on function public.review_provider_application(uuid,text,text) from public, anon;
grant execute on function public.review_provider_application(uuid,text,text) to authenticated;
