create or replace function public.submit_provider_verification(
  requested_legal_name text,
  requested_contact_phone text,
  requested_address text,
  requested_public_contact_email text,
  requested_website_url text,
  requested_grievance_officer_name text,
  requested_grievance_officer_designation text,
  requested_grievance_email text,
  requested_grievance_phone text,
  requested_evidence_type text,
  requested_evidence_reference text,
  requested_evidence_note text default null
)
returns public.provider_verification_requests
language plpgsql
security definer
set search_path=''
as $$
declare
  req public.provider_verification_requests%rowtype;
  professional uuid;
  business uuid;
  ptype text;
  provider_verified boolean:=false;
  disclosure_complete boolean:=false;
  legal_value text:=btrim(coalesce(requested_legal_name,''));
  phone_value text:=btrim(coalesce(requested_contact_phone,''));
  address_value text:=btrim(coalesce(requested_address,''));
  public_email_value text:=lower(btrim(coalesce(requested_public_contact_email,'')));
  website_value text:=nullif(btrim(coalesce(requested_website_url,'')),'');
  grievance_name_value text:=btrim(coalesce(requested_grievance_officer_name,''));
  grievance_designation_value text:=btrim(coalesce(requested_grievance_officer_designation,''));
  grievance_email_value text:=lower(btrim(coalesce(requested_grievance_email,'')));
  grievance_phone_value text:=btrim(coalesce(requested_grievance_phone,''));
  ref_value text:=btrim(coalesce(requested_evidence_reference,''));
  note_value text:=nullif(btrim(coalesce(requested_evidence_note,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select p.id,p.verified,
         (nullif(btrim(coalesce(p.legal_name,'')),'') is not null
          and nullif(btrim(coalesce(p.principal_address,'')),'') is not null
          and nullif(btrim(coalesce(p.public_contact_email,'')),'') is not null
          and nullif(btrim(coalesce(p.public_contact_phone,'')),'') is not null
          and nullif(btrim(coalesce(p.grievance_officer_name,'')),'') is not null
          and nullif(btrim(coalesce(p.grievance_officer_designation,'')),'') is not null
          and nullif(btrim(coalesce(p.grievance_email,'')),'') is not null
          and nullif(btrim(coalesce(p.grievance_phone,'')),'') is not null)
    into professional,provider_verified,disclosure_complete
  from public.professional_profiles p where p.user_id=auth.uid() limit 1;
  if professional is not null then
    ptype:='professional';
  else
    select b.id,b.verified,
           (nullif(btrim(coalesce(b.legal_name,'')),'') is not null
            and nullif(btrim(coalesce(b.principal_address,'')),'') is not null
            and nullif(btrim(coalesce(b.public_contact_email,'')),'') is not null
            and nullif(btrim(coalesce(b.public_contact_phone,'')),'') is not null
            and nullif(btrim(coalesce(b.grievance_officer_name,'')),'') is not null
            and nullif(btrim(coalesce(b.grievance_officer_designation,'')),'') is not null
            and nullif(btrim(coalesce(b.grievance_email,'')),'') is not null
            and nullif(btrim(coalesce(b.grievance_phone,'')),'') is not null)
      into business,provider_verified,disclosure_complete
    from public.businesses b where b.owner_user_id=auth.uid() limit 1;
    if business is not null then ptype:='business';
    else raise exception 'An approved provider account is required before verification.'; end if;
  end if;
  if provider_verified and disclosure_complete then raise exception 'This provider is already verified with complete marketplace disclosure.'; end if;
  if exists(select 1 from public.provider_verification_requests where applicant_user_id=auth.uid() and status='pending') then raise exception 'A verification request is already awaiting review.'; end if;
  if char_length(legal_value)<2 or char_length(legal_value)>160 then raise exception 'Legal name must be 2 to 160 characters.'; end if;
  if char_length(phone_value)<5 or char_length(phone_value)>40 then raise exception 'Public contact phone is required.'; end if;
  if char_length(address_value)<5 or char_length(address_value)>500 then raise exception 'Address must be 5 to 500 characters.'; end if;
  if char_length(public_email_value)<5 or char_length(public_email_value)>254 or position('@' in public_email_value)<=1 then raise exception 'A valid public contact email is required.'; end if;
  if website_value is not null and char_length(website_value)>300 then raise exception 'Website URL must be 300 characters or fewer.'; end if;
  if char_length(grievance_name_value)<2 or char_length(grievance_name_value)>160 then raise exception 'Grievance officer name is required.'; end if;
  if char_length(grievance_designation_value)<2 or char_length(grievance_designation_value)>120 then raise exception 'Grievance officer designation is required.'; end if;
  if char_length(grievance_email_value)<5 or char_length(grievance_email_value)>254 or position('@' in grievance_email_value)<=1 then raise exception 'A valid grievance email is required.'; end if;
  if char_length(grievance_phone_value)<5 or char_length(grievance_phone_value)>40 then raise exception 'Grievance phone is required.'; end if;
  if requested_evidence_type not in ('government_id','business_registration','professional_license','other') then raise exception 'Choose a valid evidence type.'; end if;
  if char_length(ref_value)<3 or char_length(ref_value)>120 then raise exception 'Evidence reference must be 3 to 120 characters.'; end if;
  if note_value is not null and char_length(note_value)>1200 then raise exception 'Evidence note must be 1200 characters or fewer.'; end if;
  insert into public.provider_verification_requests(applicant_user_id,provider_type,professional_id,business_id,legal_name,contact_phone,address,public_contact_email,website_url,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone,evidence_type,evidence_reference,evidence_note,status)
  values(auth.uid(),ptype,professional,business,legal_value,phone_value,address_value,public_email_value,website_value,grievance_name_value,grievance_designation_value,grievance_email_value,grievance_phone_value,requested_evidence_type,ref_value,note_value,'pending') returning * into req;
  insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note)
  values(req.id,auth.uid(),'provider','submitted',case when provider_verified then 'Marketplace disclosure remediation submitted for review.' else 'Provider verification request submitted with marketplace contact and grievance disclosure.' end);
  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(auth.uid(),'provider_verification_submitted',case when provider_verified then 'Disclosure correction submitted' else 'Verification submitted' end,case when provider_verified then 'Your marketplace disclosure correction is awaiting platform review.' else 'Your provider verification request is awaiting platform review.' end,'/provider/verification');
  return req;
end;
$$;

create or replace function public.withdraw_provider_verification(target_request_id uuid)
returns public.provider_verification_requests
language plpgsql
security definer
set search_path=''
as $$
declare req public.provider_verification_requests%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  update public.provider_verification_requests set status='withdrawn',updated_at=now() where id=target_request_id and applicant_user_id=auth.uid() and status='pending' returning * into req;
  if req.id is null then raise exception 'Pending verification request was not found.'; end if;
  insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'provider','withdrawn','Provider withdrew the verification request.');
  insert into public.notifications(recipient_user_id,event_type,title,body,target_path) values(auth.uid(),'provider_verification_withdrawn','Verification withdrawn','Your provider verification request was withdrawn.','/provider/verification');
  return req;
end;
$$;

create or replace function public.review_provider_verification(target_request_id uuid, decision text, reviewer_note text default null)
returns public.provider_verification_requests
language plpgsql
security definer
set search_path=''
as $$
declare req public.provider_verification_requests%rowtype; note_value text:=nullif(btrim(coalesce(reviewer_note,'')),''); trust_row public.provider_trust_states%rowtype; trust_message text;
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
    if req.provider_type='professional' then update public.professional_profiles set verified=true,updated_at=now() where id=req.professional_id and user_id=req.applicant_user_id; else update public.businesses set verified=true,updated_at=now() where id=req.business_id and owner_user_id=req.applicant_user_id; end if;
    select * into trust_row from public.provider_trust_states where (req.provider_type='professional' and professional_id=req.professional_id) or (req.provider_type='business' and business_id=req.business_id) for update;
    if found and trust_row.status='reverification_required' then
      update public.provider_trust_states set status='normal',reason='Re-verification approved.',changed_by=auth.uid(),updated_at=now() where id=trust_row.id;
      insert into public.provider_trust_events(trust_state_id,actor_user_id,actor_type,event_type,from_status,to_status,reason) values(trust_row.id,auth.uid(),'admin','reverification_completed','reverification_required','normal','Re-verification approved.');
      trust_message:=' Your re-verification requirement is cleared.';
    elsif found and trust_row.status='suspended' then trust_message:=' Your verification is approved, but the provider suspension remains in effect.';
    else trust_message:=' You can publish launch-ready services.'; end if;
    update public.provider_verification_requests set status='approved',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','approved',coalesce(note_value,'Verification approved.'));
    insert into public.notifications(recipient_user_id,event_type,title,body,target_path) values(req.applicant_user_id,'provider_verification_approved','Provider verified','Your provider verification is approved.'||coalesce(trust_message,''),'/provider/verification');
  elsif decision='changes_requested' then
    update public.provider_verification_requests set status='changes_requested',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','changes_requested',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body,target_path) values(req.applicant_user_id,'provider_verification_changes','Verification needs changes',note_value,'/provider/verification');
  else
    update public.provider_verification_requests set status='rejected',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=req.id returning * into req;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(req.id,auth.uid(),'admin','rejected',note_value);
    insert into public.notifications(recipient_user_id,event_type,title,body,target_path) values(req.applicant_user_id,'provider_verification_rejected','Verification not approved',note_value,'/provider/verification');
  end if;
  return req;
end;
$$;

create or replace function public.revoke_provider_verification(target_provider_type text, target_provider_id uuid, revocation_note text)
returns void
language plpgsql
security definer
set search_path=''
as $$
declare note_value text:=btrim(coalesce(revocation_note,'')); owner_id uuid; latest_request uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform manage permission is required.'; end if;
  if char_length(note_value)<3 or char_length(note_value)>1200 then raise exception 'A revocation reason is required.'; end if;
  if target_provider_type='professional' then update public.professional_profiles set verified=false,updated_at=now() where id=target_provider_id and verified=true returning user_id into owner_id;
  elsif target_provider_type='business' then update public.businesses set verified=false,updated_at=now() where id=target_provider_id and verified=true returning owner_user_id into owner_id;
  else raise exception 'Provider type is invalid.'; end if;
  if owner_id is null then raise exception 'Verified provider was not found.'; end if;
  update public.services set status='paused'::public.service_status,active=false,updated_at=now() where (target_provider_type='professional' and professional_id=target_provider_id) or (target_provider_type='business' and business_id=target_provider_id);
  select id into latest_request from public.provider_verification_requests where applicant_user_id=owner_id and status='approved' order by reviewed_at desc nulls last,created_at desc limit 1;
  if latest_request is not null then
    update public.provider_verification_requests set status='revoked',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now() where id=latest_request;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note) values(latest_request,auth.uid(),'admin','revoked',note_value);
  end if;
  insert into public.notifications(recipient_user_id,event_type,title,body,target_path) values(owner_id,'provider_verification_revoked','Provider verification paused',note_value || ' Active services were paused until verification is approved again.','/provider/verification');
end;
$$;