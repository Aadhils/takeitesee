-- Phase 13 Module 5: provider trust state, suspension and re-verification lifecycle.

create table if not exists public.provider_trust_states (
  id uuid primary key default gen_random_uuid(),
  provider_type text not null check (provider_type in ('professional','business')),
  professional_id uuid references public.professional_profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  owner_user_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'normal' check (status in ('normal','reverification_required','suspended')),
  reason text,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (provider_type='professional' and professional_id is not null and business_id is null)
    or (provider_type='business' and business_id is not null and professional_id is null)
  ),
  check (reason is null or char_length(reason) <= 1200)
);
create unique index if not exists provider_trust_states_professional_uidx on public.provider_trust_states(professional_id) where professional_id is not null;
create unique index if not exists provider_trust_states_business_uidx on public.provider_trust_states(business_id) where business_id is not null;
create index if not exists provider_trust_states_owner_idx on public.provider_trust_states(owner_user_id);
create index if not exists provider_trust_states_status_idx on public.provider_trust_states(status,updated_at desc);

create table if not exists public.provider_trust_events (
  id uuid primary key default gen_random_uuid(),
  trust_state_id uuid not null references public.provider_trust_states(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null check (actor_type in ('admin','system')),
  event_type text not null check (event_type in ('created','reverification_required','suspended','restored','reverification_completed')),
  from_status text check (from_status is null or from_status in ('normal','reverification_required','suspended')),
  to_status text not null check (to_status in ('normal','reverification_required','suspended')),
  reason text,
  created_at timestamptz not null default now(),
  check (reason is null or char_length(reason) <= 1200)
);
create index if not exists provider_trust_events_state_created_idx on public.provider_trust_events(trust_state_id,created_at);

alter table public.provider_trust_states enable row level security;
alter table public.provider_trust_events enable row level security;

revoke insert,update,delete on public.provider_trust_states from anon,authenticated;
revoke insert,update,delete on public.provider_trust_events from anon,authenticated;

drop policy if exists provider_trust_states_private_read on public.provider_trust_states;
create policy provider_trust_states_private_read on public.provider_trust_states
for select to authenticated using (
  owner_user_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_view(null,null,null,null)
);

drop policy if exists provider_trust_events_private_read on public.provider_trust_events;
create policy provider_trust_events_private_read on public.provider_trust_events
for select to authenticated using (
  exists(
    select 1 from public.provider_trust_states s
    where s.id=provider_trust_events.trust_state_id
      and (
        s.owner_user_id=auth.uid()
        or public.is_super_admin()
        or public.admin_can_view(null,null,null,null)
      )
  )
);

-- Backfill existing provider accounts without changing verification or service state.
insert into public.provider_trust_states(provider_type,professional_id,business_id,owner_user_id,status,reason)
select 'professional',p.id,null,p.user_id,'normal','Initial trust state.'
from public.professional_profiles p
where p.user_id is not null
  and not exists(select 1 from public.provider_trust_states s where s.professional_id=p.id)
on conflict do nothing;

insert into public.provider_trust_states(provider_type,professional_id,business_id,owner_user_id,status,reason)
select 'business',null,b.id,b.owner_user_id,'normal','Initial trust state.'
from public.businesses b
where b.owner_user_id is not null
  and not exists(select 1 from public.provider_trust_states s where s.business_id=b.id)
on conflict do nothing;

insert into public.provider_trust_events(trust_state_id,actor_type,event_type,from_status,to_status,reason)
select s.id,'system','created',null,s.status,'Initial trust state.'
from public.provider_trust_states s
where not exists(select 1 from public.provider_trust_events e where e.trust_state_id=s.id);

create or replace function public.ensure_provider_trust_state()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_table_name='professional_profiles' and new.user_id is not null then
    insert into public.provider_trust_states(provider_type,professional_id,business_id,owner_user_id,status,reason)
    values('professional',new.id,null,new.user_id,'normal','Provider account created.')
    on conflict do nothing;
  elsif tg_table_name='businesses' and new.owner_user_id is not null then
    insert into public.provider_trust_states(provider_type,professional_id,business_id,owner_user_id,status,reason)
    values('business',null,new.id,new.owner_user_id,'normal','Provider account created.')
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists professional_profiles_ensure_trust_state on public.professional_profiles;
create trigger professional_profiles_ensure_trust_state
after insert on public.professional_profiles
for each row execute function public.ensure_provider_trust_state();

drop trigger if exists businesses_ensure_trust_state on public.businesses;
create trigger businesses_ensure_trust_state
after insert on public.businesses
for each row execute function public.ensure_provider_trust_state();

create or replace function public.provider_trust_status(
  p_provider_type text,
  p_professional_id uuid,
  p_business_id uuid
)
returns text
language sql stable security definer set search_path=''
as $$
  select coalesce(
    (
      select s.status
      from public.provider_trust_states s
      where (p_provider_type='professional' and s.professional_id=p_professional_id)
         or (p_provider_type='business' and s.business_id=p_business_id)
      limit 1
    ),
    'normal'
  );
$$;
revoke all on function public.provider_trust_status(text,uuid,uuid) from public;
grant execute on function public.provider_trust_status(text,uuid,uuid) to anon,authenticated,service_role;

create or replace function public.provider_trust_allows_marketplace(
  p_provider_type text,
  p_professional_id uuid,
  p_business_id uuid
)
returns boolean
language sql stable security definer set search_path=''
as $$
  select public.provider_trust_status(p_provider_type,p_professional_id,p_business_id)='normal';
$$;
revoke all on function public.provider_trust_allows_marketplace(text,uuid,uuid) from public;
grant execute on function public.provider_trust_allows_marketplace(text,uuid,uuid) to anon,authenticated,service_role;

create or replace function public.get_my_provider_trust_state()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  state_row public.provider_trust_states%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into state_row from public.provider_trust_states where owner_user_id=auth.uid() order by created_at limit 1;
  if not found then raise exception 'Provider trust state was not found.'; end if;
  return jsonb_build_object(
    'id',state_row.id,
    'provider_type',state_row.provider_type,
    'professional_id',state_row.professional_id,
    'business_id',state_row.business_id,
    'status',state_row.status,
    'reason',state_row.reason,
    'updated_at',state_row.updated_at
  );
end;
$$;
revoke all on function public.get_my_provider_trust_state() from public,anon;
grant execute on function public.get_my_provider_trust_state() to authenticated;

create or replace function public.list_provider_trust_overview()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then
    raise exception 'Platform manage permission is required.';
  end if;
  return coalesce((
    select jsonb_agg(row_data order by (row_data->>'updated_at') desc)
    from (
      select jsonb_build_object(
        'trust_state_id',s.id,
        'provider_type',s.provider_type,
        'provider_id',coalesce(s.professional_id,s.business_id),
        'owner_user_id',s.owner_user_id,
        'display_name',case when s.provider_type='professional' then coalesce(p.headline,u.name,'Professional provider') else coalesce(b.name,'Business provider') end,
        'verified',case when s.provider_type='professional' then coalesce(p.verified,false) else coalesce(b.verified,false) end,
        'status',s.status,
        'reason',s.reason,
        'active_services',(
          select count(*)::int from public.services svc
          where svc.status='active'::public.service_status and svc.active=true
            and ((s.provider_type='professional' and svc.professional_id=s.professional_id) or (s.provider_type='business' and svc.business_id=s.business_id))
        ),
        'updated_at',s.updated_at
      ) as row_data
      from public.provider_trust_states s
      left join public.professional_profiles p on p.id=s.professional_id
      left join public.businesses b on b.id=s.business_id
      left join public.users u on u.id=s.owner_user_id
    ) q
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.list_provider_trust_overview() from public,anon;
grant execute on function public.list_provider_trust_overview() to authenticated;

-- Extend notification vocabulary for trust operations.
alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (event_type = any(array[
  'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
  'reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded',
  'review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
  'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
  'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
  'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected',
  'provider_reverification_required','provider_suspended','provider_restored'
]));

create or replace function public.set_provider_trust_state(
  target_provider_type text,
  target_provider_id uuid,
  target_action text,
  action_reason text
)
returns jsonb
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  state_row public.provider_trust_states%rowtype;
  owner_id uuid;
  previous_status text;
  next_status text;
  reason_value text:=nullif(btrim(coalesce(action_reason,'')),'');
  event_value text;
  notification_type text;
  notification_title text;
  notification_body text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform manage permission is required.'; end if;
  if target_provider_type not in ('professional','business') then raise exception 'Provider type is invalid.'; end if;
  if target_action not in ('require_reverification','suspend','restore') then raise exception 'Trust action is invalid.'; end if;
  if reason_value is null or char_length(reason_value)<3 or char_length(reason_value)>1200 then raise exception 'A reason between 3 and 1200 characters is required.'; end if;

  if target_provider_type='professional' then
    select user_id into owner_id from public.professional_profiles where id=target_provider_id;
  else
    select owner_user_id into owner_id from public.businesses where id=target_provider_id;
  end if;
  if owner_id is null then raise exception 'Provider was not found.'; end if;
  if owner_id=auth.uid() then raise exception 'You cannot change trust state for your own provider account.'; end if;

  select * into state_row from public.provider_trust_states
  where (target_provider_type='professional' and professional_id=target_provider_id)
     or (target_provider_type='business' and business_id=target_provider_id)
  for update;
  if not found then
    insert into public.provider_trust_states(provider_type,professional_id,business_id,owner_user_id,status,reason)
    values(target_provider_type,case when target_provider_type='professional' then target_provider_id end,case when target_provider_type='business' then target_provider_id end,owner_id,'normal','Trust state initialized.')
    returning * into state_row;
  end if;
  previous_status:=state_row.status;

  if target_action='require_reverification' then
    if previous_status<>'normal' then raise exception 'Re-verification can be required only from normal trust state.'; end if;
    next_status:='reverification_required'; event_value:='reverification_required'; notification_type:='provider_reverification_required'; notification_title:='Re-verification required'; notification_body:=reason_value;
  elsif target_action='suspend' then
    if previous_status='suspended' then raise exception 'Provider is already suspended.'; end if;
    next_status:='suspended'; event_value:='suspended'; notification_type:='provider_suspended'; notification_title:='Provider account suspended'; notification_body:=reason_value;
  else
    if previous_status='normal' then raise exception 'Provider trust state is already normal.'; end if;
    next_status:='normal'; event_value:='restored'; notification_type:='provider_restored'; notification_title:='Provider trust access restored'; notification_body:=reason_value;
  end if;

  update public.provider_trust_states
  set status=next_status,reason=reason_value,changed_by=auth.uid(),updated_at=now()
  where id=state_row.id returning * into state_row;

  insert into public.provider_trust_events(trust_state_id,actor_user_id,actor_type,event_type,from_status,to_status,reason)
  values(state_row.id,auth.uid(),'admin',event_value,previous_status,next_status,reason_value);

  if target_action='require_reverification' then
    if target_provider_type='professional' then update public.professional_profiles set verified=false,updated_at=now() where id=target_provider_id;
    else update public.businesses set verified=false,updated_at=now() where id=target_provider_id; end if;
  end if;

  if target_action in ('require_reverification','suspend') then
    update public.services set status='paused'::public.service_status,active=false,updated_at=now()
    where status='active'::public.service_status
      and ((target_provider_type='professional' and professional_id=target_provider_id) or (target_provider_type='business' and business_id=target_provider_id));
  end if;

  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(owner_id,notification_type,notification_title,notification_body);

  return jsonb_build_object('trust_state_id',state_row.id,'provider_type',target_provider_type,'provider_id',target_provider_id,'status',state_row.status,'reason',state_row.reason,'updated_at',state_row.updated_at);
end;
$$;
revoke all on function public.set_provider_trust_state(text,uuid,text,text) from public,anon;
grant execute on function public.set_provider_trust_state(text,uuid,text,text) to authenticated;

-- Trust state is an additional marketplace/publishing gate.
drop policy if exists services_public_read_launch_ready on public.services;
create policy services_public_read_launch_ready on public.services
for select to anon,authenticated using (
  status='active'::public.service_status
  and active=true
  and public.provider_owner_is_verified(provider_type::text,professional_id,business_id)
  and public.provider_profile_is_complete(provider_type::text,professional_id,business_id)
  and public.service_scope_is_launchable(id)
  and public.provider_trust_allows_marketplace(provider_type::text,professional_id,business_id)
);

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
      and public.provider_trust_allows_marketplace(provider_type::text,professional_id,business_id)
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
      and public.provider_trust_allows_marketplace(provider_type::text,professional_id,business_id)
    )
  )
);

create or replace function public.guard_service_publish_verified_provider()
returns trigger language plpgsql set search_path=public,pg_temp as $$
declare scope_category text; scope_location text; begin
  new.active := (new.status='active'::public.service_status);
  if new.status='active'::public.service_status then
    if not public.provider_owner_is_verified(new.provider_type::text,new.professional_id,new.business_id) then raise exception 'Provider verification is required before a service can be published.'; end if;
    if not public.provider_profile_is_complete(new.provider_type::text,new.professional_id,new.business_id) then raise exception 'Complete the provider profile before publishing a service.'; end if;
    if not public.service_scope_is_launchable(new.id) then raise exception 'Platform category and location approval is required before a service can be published.'; end if;
    if not public.provider_trust_allows_marketplace(new.provider_type::text,new.professional_id,new.business_id) then raise exception 'Provider trust review must be resolved before a service can be published.'; end if;
    select pc.name,pl.name into scope_category,scope_location from public.service_ecosystem_scope ses join public.platform_categories pc on pc.id=ses.category_id join public.platform_locations pl on pl.id=ses.location_id where ses.service_id=new.id and ses.enabled=true;
    if btrim(coalesce(new.category,'')) is distinct from scope_category or btrim(coalesce(new.location,'')) is distinct from scope_location then raise exception 'Service category and location must match the approved platform scope.'; end if;
  end if;
  return new;
end;
$$;

-- KYC approval completes a re-verification requirement, but never clears suspension.
create or replace function public.review_provider_verification(target_request_id uuid, decision text, reviewer_note text default null)
returns public.provider_verification_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  req public.provider_verification_requests%rowtype;
  note_value text:=nullif(btrim(coalesce(reviewer_note,'')),'');
  trust_row public.provider_trust_states%rowtype;
  trust_message text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform manage permission is required.'; end if;
  if decision not in ('approve','changes_requested','reject') then raise exception 'Choose approve, changes_requested, or reject.'; end if;
  if decision<>'approve' and (note_value is null or char_length(note_value)<3) then raise exception 'A review reason is required.'; end if;
  if note_value is not null and char_length(note_value)>1200 then raise exception 'Review note must be 1200 characters or fewer.'; end if;
  select * into req from public.provider_verification_requests where id=target_request_id and status='pending' for update;
  if not found then raise exception 'Pending verification request was not found.'; end if;
  if req.applicant_user_id=auth.uid() then raise exception 'You cannot review your own verification request.'; end if;

  if decision='approve' then
    if not exists(select 1 from public.provider_verification_documents d where d.verification_request_id=req.id and d.status='active') then raise exception 'At least one private verification document is required before approval.'; end if;
    if req.provider_type='professional' then update public.professional_profiles set verified=true,updated_at=now() where id=req.professional_id and user_id=req.applicant_user_id;
    else update public.businesses set verified=true,updated_at=now() where id=req.business_id and owner_user_id=req.applicant_user_id; end if;

    select * into trust_row from public.provider_trust_states
    where (req.provider_type='professional' and professional_id=req.professional_id) or (req.provider_type='business' and business_id=req.business_id)
    for update;
    if found and trust_row.status='reverification_required' then
      update public.provider_trust_states set status='normal',reason='Re-verification approved.',changed_by=auth.uid(),updated_at=now() where id=trust_row.id;
      insert into public.provider_trust_events(trust_state_id,actor_user_id,actor_type,event_type,from_status,to_status,reason)
      values(trust_row.id,auth.uid(),'admin','reverification_completed','reverification_required','normal','Re-verification approved.');
      trust_message:=' Your re-verification requirement is cleared.';
    elsif found and trust_row.status='suspended' then
      trust_message:=' Your verification is approved, but the provider suspension remains in effect.';
    else trust_message:=' You can publish launch-ready services.'; end if;

    update public.provider_verification_requests set status='approved',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','approved',coalesce(note_value,'Verification approved.'));
    insert into public.notifications(recipient_user_id,event_type,title,body) values(req.applicant_user_id,'provider_verification_approved','Provider verified','Your provider verification is approved.'||coalesce(trust_message,''));
  elsif decision='changes_requested' then
    update public.provider_verification_requests set status='changes_requested',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','changes_requested',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body) values(req.applicant_user_id,'provider_verification_changes','Verification needs changes',note_value);
  else
    update public.provider_verification_requests set status='rejected',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','rejected',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body) values(req.applicant_user_id,'provider_verification_rejected','Verification not approved',note_value);
  end if;
  return req;
end;
$$;
revoke all on function public.review_provider_verification(uuid,text,text) from public,anon;
grant execute on function public.review_provider_verification(uuid,text,text) to authenticated;
