-- Phase 13 Module 2: provider verification workflow and verified-only service publishing.

create table if not exists public.provider_verification_requests (
  id uuid primary key default gen_random_uuid(),
  applicant_user_id uuid not null references public.users(id) on delete cascade,
  provider_type text not null check (provider_type in ('professional','business')),
  professional_id uuid references public.professional_profiles(id) on delete cascade,
  business_id uuid references public.businesses(id) on delete cascade,
  legal_name text not null check (char_length(legal_name) between 2 and 160),
  contact_phone text not null check (char_length(contact_phone) between 5 and 40),
  address text not null check (char_length(address) between 5 and 500),
  evidence_type text not null check (evidence_type in ('government_id','business_registration','professional_license','other')),
  evidence_reference text not null check (char_length(evidence_reference) between 3 and 120),
  evidence_note text,
  status text not null default 'pending' check (status in ('pending','approved','changes_requested','rejected','withdrawn')),
  review_note text,
  reviewed_by uuid references public.users(id) on delete set null,
  reviewed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((provider_type='professional' and professional_id is not null and business_id is null) or (provider_type='business' and business_id is not null and professional_id is null)),
  check (evidence_note is null or char_length(evidence_note)<=1200),
  check (review_note is null or char_length(review_note)<=1200)
);

create unique index if not exists provider_verification_one_pending_per_applicant_idx
  on public.provider_verification_requests(applicant_user_id) where status='pending';
create index if not exists provider_verification_status_created_idx
  on public.provider_verification_requests(status,created_at desc);

create table if not exists public.provider_verification_events (
  id uuid primary key default gen_random_uuid(),
  verification_request_id uuid not null references public.provider_verification_requests(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null check (actor_type in ('provider','admin','system')),
  event_type text not null check (event_type in ('submitted','withdrawn','approved','changes_requested','rejected','revoked')),
  note text,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note)<=1200)
);
create index if not exists provider_verification_events_request_created_idx
  on public.provider_verification_events(verification_request_id,created_at);

alter table public.provider_verification_requests enable row level security;
alter table public.provider_verification_events enable row level security;

drop policy if exists provider_verification_requests_private_read on public.provider_verification_requests;
create policy provider_verification_requests_private_read on public.provider_verification_requests
for select to authenticated using (
  applicant_user_id=auth.uid() or public.is_super_admin() or public.admin_can_view(null,null,null,null)
);

drop policy if exists provider_verification_events_private_read on public.provider_verification_events;
create policy provider_verification_events_private_read on public.provider_verification_events
for select to authenticated using (
  exists(select 1 from public.provider_verification_requests r where r.id=provider_verification_events.verification_request_id and (r.applicant_user_id=auth.uid() or public.is_super_admin() or public.admin_can_view(null,null,null,null)))
);

revoke insert,update,delete on public.provider_verification_requests from anon,authenticated;
revoke insert,update,delete on public.provider_verification_events from anon,authenticated;

create or replace function public.provider_owner_is_verified(p_provider_type text,p_professional_id uuid,p_business_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select case
    when p_provider_type='professional' then exists(select 1 from public.professional_profiles p where p.id=p_professional_id and p.verified=true)
    when p_provider_type='business' then exists(select 1 from public.businesses b where b.id=p_business_id and b.verified=true)
    else false
  end;
$$;
revoke all on function public.provider_owner_is_verified(text,uuid,uuid) from public;
grant execute on function public.provider_owner_is_verified(text,uuid,uuid) to anon,authenticated,service_role;

-- Public service rows are visible only when both the service and its provider are publishable.
drop policy if exists services_public_read on public.services;
drop policy if exists services_public_read_active on public.services;
drop policy if exists services_public_read_verified_active on public.services;
create policy services_public_read_verified_active on public.services
for select to anon,authenticated using (
  status='active'::public.service_status and active=true and public.provider_owner_is_verified(provider_type::text,professional_id,business_id)
);

-- Keep direct provider writes ownership-scoped, and forbid publishing before verification.
drop policy if exists services_provider_insert_own on public.services;
create policy services_provider_insert_own on public.services for insert to authenticated with check (
  ((exists(select 1 from public.professional_profiles pp where pp.id=services.professional_id and pp.user_id=auth.uid())) or
   (exists(select 1 from public.businesses b where b.id=services.business_id and b.owner_user_id=auth.uid())))
  and ((status<>'active'::public.service_status and active=false) or public.provider_owner_is_verified(provider_type::text,professional_id,business_id))
);

drop policy if exists services_provider_update_own on public.services;
create policy services_provider_update_own on public.services for update to authenticated
using ((exists(select 1 from public.professional_profiles pp where pp.id=services.professional_id and pp.user_id=auth.uid())) or (exists(select 1 from public.businesses b where b.id=services.business_id and b.owner_user_id=auth.uid())))
with check (
  ((exists(select 1 from public.professional_profiles pp where pp.id=services.professional_id and pp.user_id=auth.uid())) or
   (exists(select 1 from public.businesses b where b.id=services.business_id and b.owner_user_id=auth.uid())))
  and ((status<>'active'::public.service_status and active=false) or public.provider_owner_is_verified(provider_type::text,professional_id,business_id))
);

create or replace function public.guard_service_publish_verified_provider()
returns trigger language plpgsql set search_path=public,pg_temp as $$
begin
  new.active := (new.status='active'::public.service_status);
  if new.status='active'::public.service_status and not public.provider_owner_is_verified(new.provider_type::text,new.professional_id,new.business_id) then
    raise exception 'Provider verification is required before a service can be published.';
  end if;
  return new;
end;
$$;
drop trigger if exists services_guard_verified_publish on public.services;
create trigger services_guard_verified_publish before insert or update of status,active,professional_id,business_id,provider_type on public.services for each row execute function public.guard_service_publish_verified_provider();

create or replace function public.submit_provider_verification(
  requested_legal_name text,
  requested_contact_phone text,
  requested_address text,
  requested_evidence_type text,
  requested_evidence_reference text,
  requested_evidence_note text default null
)
returns public.provider_verification_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  req public.provider_verification_requests%rowtype;
  professional uuid;
  business uuid;
  ptype text;
  legal_value text:=btrim(coalesce(requested_legal_name,''));
  phone_value text:=btrim(coalesce(requested_contact_phone,''));
  address_value text:=btrim(coalesce(requested_address,''));
  ref_value text:=btrim(coalesce(requested_evidence_reference,''));
  note_value text:=nullif(btrim(coalesce(requested_evidence_note,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select id into professional from public.professional_profiles where user_id=auth.uid() limit 1;
  select id into business from public.businesses where owner_user_id=auth.uid() limit 1;
  if professional is not null then ptype:='professional';
  elsif business is not null then ptype:='business';
  else raise exception 'An approved provider account is required before verification.'; end if;
  if (professional is not null and exists(select 1 from public.professional_profiles where id=professional and verified=true)) or
     (business is not null and exists(select 1 from public.businesses where id=business and verified=true)) then raise exception 'This provider is already verified.'; end if;
  if exists(select 1 from public.provider_verification_requests where applicant_user_id=auth.uid() and status='pending') then raise exception 'A verification request is already awaiting review.'; end if;
  if char_length(legal_value)<2 or char_length(legal_value)>160 then raise exception 'Legal name must be 2 to 160 characters.'; end if;
  if char_length(phone_value)<5 or char_length(phone_value)>40 then raise exception 'Contact phone is required.'; end if;
  if char_length(address_value)<5 or char_length(address_value)>500 then raise exception 'Address must be 5 to 500 characters.'; end if;
  if requested_evidence_type not in ('government_id','business_registration','professional_license','other') then raise exception 'Choose a valid evidence type.'; end if;
  if char_length(ref_value)<3 or char_length(ref_value)>120 then raise exception 'Evidence reference must be 3 to 120 characters.'; end if;
  if note_value is not null and char_length(note_value)>1200 then raise exception 'Evidence note must be 1200 characters or fewer.'; end if;

  insert into public.provider_verification_requests(applicant_user_id,provider_type,professional_id,business_id,legal_name,contact_phone,address,evidence_type,evidence_reference,evidence_note,status)
  values(auth.uid(),ptype,professional,business,legal_value,phone_value,address_value,requested_evidence_type,ref_value,note_value,'pending') returning * into req;
  insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'provider','submitted','Provider verification request submitted.');
  insert into public.notifications(recipient_user_id,event_type,title,body) values(auth.uid(),'provider_verification_submitted','Verification submitted','Your provider verification request is awaiting platform review.');
  return req;
end;
$$;
revoke all on function public.submit_provider_verification(text,text,text,text,text,text) from public,anon;
grant execute on function public.submit_provider_verification(text,text,text,text,text,text) to authenticated;

create or replace function public.withdraw_provider_verification(target_request_id uuid)
returns public.provider_verification_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare req public.provider_verification_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.provider_verification_requests set status='withdrawn',updated_at=now() where id=target_request_id and applicant_user_id=auth.uid() and status='pending' returning * into req;
  if req.id is null then raise exception 'Pending verification request was not found.'; end if;
  insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'provider','withdrawn','Provider withdrew the verification request.');
  insert into public.notifications(recipient_user_id,event_type,title,body) values(auth.uid(),'provider_verification_withdrawn','Verification withdrawn','Your provider verification request was withdrawn.');
  return req;
end;
$$;
revoke all on function public.withdraw_provider_verification(uuid) from public,anon;
grant execute on function public.withdraw_provider_verification(uuid) to authenticated;

create or replace function public.review_provider_verification(target_request_id uuid,decision text,reviewer_note text default null)
returns public.provider_verification_requests
language plpgsql security definer set search_path=public,pg_temp as $$
declare req public.provider_verification_requests%rowtype; note_value text:=nullif(btrim(coalesce(reviewer_note,'')),'');
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
    if req.provider_type='professional' then update public.professional_profiles set verified=true,updated_at=now() where id=req.professional_id and user_id=req.applicant_user_id;
    else update public.businesses set verified=true,updated_at=now() where id=req.business_id and owner_user_id=req.applicant_user_id; end if;
    update public.provider_verification_requests set status='approved',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','approved',coalesce(note_value,'Verification approved.'));
    insert into public.notifications(recipient_user_id,event_type,title,body) values(req.applicant_user_id,'provider_verification_approved','Provider verified','Your provider verification is approved. You can now publish active services.');
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

create or replace function public.revoke_provider_verification(target_provider_type text,target_provider_id uuid,revocation_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare note_value text:=btrim(coalesce(revocation_note,'')); owner_id uuid; latest_request uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform manage permission is required.'; end if;
  if char_length(note_value)<3 or char_length(note_value)>1200 then raise exception 'A revocation reason is required.'; end if;
  if target_provider_type='professional' then update public.professional_profiles set verified=false,updated_at=now() where id=target_provider_id returning user_id into owner_id;
  elsif target_provider_type='business' then update public.businesses set verified=false,updated_at=now() where id=target_provider_id returning owner_user_id into owner_id;
  else raise exception 'Provider type is invalid.'; end if;
  if owner_id is null then raise exception 'Provider was not found.'; end if;
  update public.services set status='paused'::public.service_status,active=false,updated_at=now() where (target_provider_type='professional' and professional_id=target_provider_id) or (target_provider_type='business' and business_id=target_provider_id);
  select id into latest_request from public.provider_verification_requests where applicant_user_id=owner_id order by created_at desc limit 1;
  if latest_request is not null then insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(latest_request,auth.uid(),'admin','revoked',note_value); end if;
  insert into public.notifications(recipient_user_id,event_type,title,body) values(owner_id,'provider_verification_revoked','Provider verification paused',note_value || ' Active services were paused until verification is restored.');
end;
$$;
revoke all on function public.revoke_provider_verification(text,uuid,text) from public,anon;
grant execute on function public.revoke_provider_verification(text,uuid,text) to authenticated;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (event_type=any(array[
  'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed','reschedule_requested','reschedule_accepted','reschedule_declined',
  'payment_pending','payment_paid','payment_failed','payment_refunded','review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
  'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
  'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked'
]));
