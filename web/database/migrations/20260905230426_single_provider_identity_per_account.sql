-- Single-provider identity per account.
-- Supersedes the earlier secondary-provider-profile behavior: one account may own
-- a Customer identity plus at most one Provider identity (Professional OR Business).
-- The opposite Provider type requires a separate TakeItEsee account.

do $$
begin
  if exists (
    select 1
    from public.professional_profiles p
    join public.businesses b on b.owner_user_id=p.user_id
    where p.user_id is not null
  ) then
    raise exception 'Existing dual-provider ownership must be resolved before enforcing the single-provider identity rule.';
  end if;
end;
$$;

drop index if exists public.businesses_owner_user_id_idx;
create unique index businesses_owner_user_id_idx
  on public.businesses(owner_user_id)
  where owner_user_id is not null;

create or replace function public.enforce_single_provider_identity()
returns trigger
language plpgsql
security invoker
set search_path=''
as $$
declare
  owner_id uuid;
  row_json jsonb:=to_jsonb(new);
begin
  if tg_table_name='professional_profiles' then
    owner_id:=nullif(row_json->>'user_id','')::uuid;
  elsif tg_table_name='businesses' then
    owner_id:=nullif(row_json->>'owner_user_id','')::uuid;
  end if;

  if owner_id is null then return new; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(owner_id::text,20260906));

  if tg_table_name='professional_profiles'
     and exists(select 1 from public.businesses b where b.owner_user_id=owner_id) then
    raise exception 'This account is already registered as a Business provider. Use a separate account for a Professional provider profile.';
  end if;

  if tg_table_name='businesses'
     and exists(select 1 from public.professional_profiles p where p.user_id=owner_id) then
    raise exception 'This account is already registered as a Professional provider. Use a separate account for a Business provider profile.';
  end if;

  return new;
end;
$$;

revoke all on function public.enforce_single_provider_identity() from public,anon,authenticated;

drop trigger if exists professional_profiles_single_provider_identity on public.professional_profiles;
create trigger professional_profiles_single_provider_identity
before insert or update of user_id on public.professional_profiles
for each row execute function public.enforce_single_provider_identity();

drop trigger if exists businesses_single_provider_identity on public.businesses;
create trigger businesses_single_provider_identity
before insert or update of owner_user_id on public.businesses
for each row execute function public.enforce_single_provider_identity();

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
  if not exists(select 1 from public.users where id=auth.uid()) then raise exception 'Account profile is missing.'; end if;

  perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(auth.uid()::text,20260906));

  if exists(select 1 from public.professional_profiles where user_id=auth.uid()) then
    raise exception 'This account is already registered as a Professional provider. Use a separate account to register a Business provider.';
  end if;
  if exists(select 1 from public.businesses where owner_user_id=auth.uid()) then
    raise exception 'This account is already registered as a Business provider. Use a separate account to register a Professional provider.';
  end if;
  if exists(select 1 from public.provider_applications where applicant_user_id=auth.uid() and status='pending') then
    raise exception 'A provider application is already awaiting review. Withdraw it before choosing a different provider type.';
  end if;

  insert into public.provider_applications(applicant_user_id,provider_type,display_name,description,location,status)
  values(auth.uid(),requested_provider_type,name_value,description_value,location_value,'pending')
  returning * into app;

  insert into public.provider_application_events(application_id,actor_user_id,actor_type,event_type,note)
  values(app.id,auth.uid(),'applicant','submitted','Provider onboarding application submitted under the one-provider-identity-per-account policy.');

  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(auth.uid(),'provider_application_submitted','Provider application submitted','Your selected provider identity is awaiting platform review. You can withdraw this application before approval if you need to choose the other provider type.');

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
    perform pg_catalog.pg_advisory_xact_lock(pg_catalog.hashtextextended(app.applicant_user_id::text,20260906));

    if exists(select 1 from public.professional_profiles where user_id=app.applicant_user_id) then
      raise exception 'Applicant already owns a Professional provider identity. This account cannot add a Business provider; a separate account is required.';
    end if;
    if exists(select 1 from public.businesses where owner_user_id=app.applicant_user_id) then
      raise exception 'Applicant already owns a Business provider identity. This account cannot add a Professional provider; a separate account is required.';
    end if;

    if app.provider_type='professional' then
      insert into public.professional_profiles(user_id,headline,description,service_area,verified)
      values(app.applicant_user_id,app.display_name,app.description,app.location,false)
      returning id into provider_id;
      update public.users
        set role='professional'::public.platform_role,updated_at=now()
        where id=app.applicant_user_id and role='customer'::public.platform_role;
    else
      insert into public.businesses(owner_user_id,name,description,location,verified)
      values(app.applicant_user_id,app.display_name,app.description,app.location,false)
      returning id into provider_id;
      update public.users
        set role='business'::public.platform_role,updated_at=now()
        where id=app.applicant_user_id and role='customer'::public.platform_role;
    end if;

    update public.provider_applications
      set status='approved',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),result_provider_id=provider_id,updated_at=now()
      where id=app.id returning * into app;

    insert into public.provider_application_events(application_id,actor_user_id,actor_type,event_type,note)
    values(app.id,auth.uid(),'admin','approved',coalesce(note_value,'Provider application approved under the one-provider-identity-per-account policy.'));

    insert into public.notifications(recipient_user_id,event_type,title,body)
    values(
      app.applicant_user_id,
      'provider_application_approved',
      'Provider application approved',
      case when app.provider_type='professional'
        then 'Your Professional provider workspace is active. This account cannot add a Business provider profile; use a separate account for a Business identity.'
        else 'Your Business provider workspace is active. This account cannot add a Professional provider profile; use a separate account for a Professional identity.'
      end
    );
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

revoke all on function public.submit_provider_application(text,text,text,text) from public,anon;
grant execute on function public.submit_provider_application(text,text,text,text) to authenticated;
revoke all on function public.review_provider_application(uuid,text,text) from public,anon;
grant execute on function public.review_provider_application(uuid,text,text) to authenticated;
