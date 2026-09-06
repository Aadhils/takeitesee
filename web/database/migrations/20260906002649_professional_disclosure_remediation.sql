-- Launch readiness: allow verified providers with incomplete marketplace disclosure to remediate through the reviewed verification flow.
-- Existing verified status is preserved while a correction is pending; disclosure data is copied only after admin approval.
-- Finance/payment/refund/payout/settlement/recovery behavior is untouched.

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

  select p.id,
         p.verified,
         (nullif(btrim(coalesce(p.legal_name,'')),'') is not null
          and nullif(btrim(coalesce(p.principal_address,'')),'') is not null
          and nullif(btrim(coalesce(p.public_contact_email,'')),'') is not null
          and nullif(btrim(coalesce(p.public_contact_phone,'')),'') is not null
          and nullif(btrim(coalesce(p.grievance_officer_name,'')),'') is not null
          and nullif(btrim(coalesce(p.grievance_officer_designation,'')),'') is not null
          and nullif(btrim(coalesce(p.grievance_email,'')),'') is not null
          and nullif(btrim(coalesce(p.grievance_phone,'')),'') is not null)
    into professional,provider_verified,disclosure_complete
  from public.professional_profiles p
  where p.user_id=auth.uid()
  limit 1;

  if professional is not null then
    ptype:='professional';
  else
    select b.id,
           b.verified,
           (nullif(btrim(coalesce(b.legal_name,'')),'') is not null
            and nullif(btrim(coalesce(b.principal_address,'')),'') is not null
            and nullif(btrim(coalesce(b.public_contact_email,'')),'') is not null
            and nullif(btrim(coalesce(b.public_contact_phone,'')),'') is not null
            and nullif(btrim(coalesce(b.grievance_officer_name,'')),'') is not null
            and nullif(btrim(coalesce(b.grievance_officer_designation,'')),'') is not null
            and nullif(btrim(coalesce(b.grievance_email,'')),'') is not null
            and nullif(btrim(coalesce(b.grievance_phone,'')),'') is not null)
      into business,provider_verified,disclosure_complete
    from public.businesses b
    where b.owner_user_id=auth.uid()
    limit 1;
    if business is not null then ptype:='business';
    else raise exception 'An approved provider account is required before verification.'; end if;
  end if;

  if provider_verified and disclosure_complete then
    raise exception 'This provider is already verified with complete marketplace disclosure.';
  end if;
  if exists(select 1 from public.provider_verification_requests where applicant_user_id=auth.uid() and status='pending') then
    raise exception 'A verification request is already awaiting review.';
  end if;

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

  insert into public.provider_verification_requests(
    applicant_user_id,provider_type,professional_id,business_id,legal_name,contact_phone,address,
    public_contact_email,website_url,grievance_officer_name,grievance_officer_designation,grievance_email,grievance_phone,
    evidence_type,evidence_reference,evidence_note,status
  ) values(
    auth.uid(),ptype,professional,business,legal_value,phone_value,address_value,
    public_email_value,website_value,grievance_name_value,grievance_designation_value,grievance_email_value,grievance_phone_value,
    requested_evidence_type,ref_value,note_value,'pending'
  ) returning * into req;

  insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note)
  values(
    req.id,auth.uid(),'provider','submitted',
    case when provider_verified then 'Marketplace disclosure remediation submitted for review.' else 'Provider verification request submitted with marketplace contact and grievance disclosure.' end
  );
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(
    auth.uid(),
    'provider_verification_submitted',
    case when provider_verified then 'Disclosure correction submitted' else 'Verification submitted' end,
    case when provider_verified then 'Your marketplace disclosure correction is awaiting platform review.' else 'Your provider verification request is awaiting platform review.' end
  );
  return req;
end;
$$;

revoke all on function public.submit_provider_verification(text,text,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.submit_provider_verification(text,text,text,text,text,text,text,text,text,text,text,text) to authenticated,service_role;
