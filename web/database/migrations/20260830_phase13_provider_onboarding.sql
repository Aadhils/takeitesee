-- Phase 13 Module 1: provider application, approval-safe role activation, and role-escalation protection.

create table if not exists public.provider_applications (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references public.users(id) on delete cascade,
  provider_type text not null check (provider_type in ('professional','business')),
  display_name text not null check (char_length(display_name) between 2 and 120),
  description text,
  location text not null check (char_length(location) between 2 and 160),
  status text not null default 'pending' check (status in ('pending','approved','rejected','withdrawn')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  result_provider_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (description is null or char_length(description) <= 1200),
  check (review_note is null or char_length(review_note) <= 1000)
);

create unique index if not exists provider_applications_one_pending_per_user_idx
  on public.provider_applications(applicant_user_id)
  where status='pending';
create index if not exists provider_applications_status_created_idx
  on public.provider_applications(status, created_at desc);

create table if not exists public.provider_application_events (
  id uuid primary key default gen_random_uuid(),
  application_id uuid not null references public.provider_applications(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null check (actor_type in ('applicant','admin','system')),
  event_type text not null check (event_type in ('submitted','withdrawn','approved','rejected')),
  note text,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 1000)
);
create index if not exists provider_application_events_application_created_idx
  on public.provider_application_events(application_id, created_at);

alter table public.provider_applications enable row level security;
alter table public.provider_application_events enable row level security;

drop policy if exists provider_applications_select_owned_or_platform_admin on public.provider_applications;
create policy provider_applications_select_owned_or_platform_admin
on public.provider_applications for select to authenticated
using (
  applicant_user_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_view(null,null,null,null)
);

drop policy if exists provider_application_events_select_owned_or_platform_admin on public.provider_application_events;
create policy provider_application_events_select_owned_or_platform_admin
on public.provider_application_events for select to authenticated
using (
  exists (
    select 1 from public.provider_applications pa
    where pa.id=provider_application_events.application_id
      and (
        pa.applicant_user_id=auth.uid()
        or public.is_super_admin()
        or public.admin_can_view(null,null,null,null)
      )
  )
);

-- No direct client writes. All mutations flow through the guarded RPCs below.
revoke insert, update, delete on public.provider_applications from anon, authenticated;
revoke insert, update, delete on public.provider_application_events from anon, authenticated;

-- Prevent an authenticated user from escalating their own stored platform role.
create or replace function public.protect_self_platform_role_change()
returns trigger
language plpgsql
set search_path=public,pg_temp
as $$
begin
  if old.role is distinct from new.role and auth.uid() is not null and auth.uid()=old.id then
    raise exception 'Platform role cannot be changed by the account owner.';
  end if;
  return new;
end;
$$;

drop trigger if exists users_protect_self_platform_role on public.users;
create trigger users_protect_self_platform_role
before update of role on public.users
for each row execute function public.protect_self_platform_role_change();

create or replace function public.submit_provider_application(
  requested_provider_type text,
  requested_display_name text,
  requested_description text,
  requested_location text
)
returns public.provider_applications
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  app public.provider_applications%rowtype;
  user_role public.platform_role;
  name_value text:=btrim(coalesce(requested_display_name,''));
  description_value text:=nullif(btrim(coalesce(requested_description,'')),'');
  location_value text:=btrim(coalesce(requested_location,''));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if requested_provider_type not in ('professional','business') then raise exception 'Choose professional or business provider type.'; end if;
  if char_length(name_value)<2 or char_length(name_value)>120 then raise exception 'Provider name must be 2 to 120 characters.'; end if;
  if description_value is not null and char_length(description_value)>1200 then raise exception 'Description must be 1200 characters or fewer.'; end if;
  if char_length(location_value)<2 or char_length(location_value)>160 then raise exception 'Service location must be 2 to 160 characters.'; end if;

  select role into user_role from public.users where id=auth.uid() for update;
  if user_role is null then raise exception 'Account profile is missing.'; end if;
  if user_role <> 'customer'::public.platform_role then raise exception 'This account already has a platform role and cannot submit provider onboarding.'; end if;
  if exists(select 1 from public.professional_profiles where user_id=auth.uid())
     or exists(select 1 from public.businesses where owner_user_id=auth.uid()) then
    raise exception 'This account already owns a provider profile.';
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
revoke all on function public.submit_provider_application(text,text,text,text) from public, anon;
grant execute on function public.submit_provider_application(text,text,text,text) to authenticated;

create or replace function public.withdraw_provider_application(target_application_id uuid)
returns public.provider_applications
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare app public.provider_applications%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.provider_applications
    set status='withdrawn', updated_at=now()
  where id=target_application_id and applicant_user_id=auth.uid() and status='pending'
  returning * into app;
  if app.id is null then raise exception 'Pending provider application was not found.'; end if;

  insert into public.provider_application_events(application_id,actor_user_id,actor_type,event_type,note)
  values(app.id,auth.uid(),'applicant','withdrawn','Applicant withdrew the provider onboarding request.');
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(auth.uid(),'provider_application_withdrawn','Provider application withdrawn','Your provider application has been withdrawn.');
  return app;
end;
$$;
revoke all on function public.withdraw_provider_application(uuid) from public, anon;
grant execute on function public.withdraw_provider_application(uuid) to authenticated;

create or replace function public.review_provider_application(
  target_application_id uuid,
  decision text,
  reviewer_note text default null
)
returns public.provider_applications
language plpgsql
security definer
set search_path=public,pg_temp
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
    if exists(select 1 from public.professional_profiles where user_id=app.applicant_user_id)
       or exists(select 1 from public.businesses where owner_user_id=app.applicant_user_id) then
      raise exception 'Applicant already owns a provider profile.';
    end if;

    if app.provider_type='professional' then
      insert into public.professional_profiles(user_id,headline,description,service_area,verified)
      values(app.applicant_user_id,app.display_name,app.description,app.location,false)
      returning id into provider_id;
      update public.users set role='professional'::public.platform_role, updated_at=now() where id=app.applicant_user_id;
    else
      insert into public.businesses(owner_user_id,name,description,location,verified)
      values(app.applicant_user_id,app.display_name,app.description,app.location,false)
      returning id into provider_id;
      update public.users set role='business'::public.platform_role, updated_at=now() where id=app.applicant_user_id;
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
revoke all on function public.review_provider_application(uuid,text,text) from public, anon;
grant execute on function public.review_provider_application(uuid,text,text) to authenticated;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (event_type=any(array[
  'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
  'reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded',
  'review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
  'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected'
]));
