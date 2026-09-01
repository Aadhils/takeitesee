-- Launch readiness: marketplace provider grievance/contact disclosure.
-- Non-finance compliance only. Cashfree/payment/refund/payout/settlement behavior is untouched.

alter table public.provider_verification_requests
  add column if not exists public_contact_email text,
  add column if not exists website_url text,
  add column if not exists grievance_officer_name text,
  add column if not exists grievance_officer_designation text,
  add column if not exists grievance_email text,
  add column if not exists grievance_phone text;

alter table public.professional_profiles
  add column if not exists legal_name text,
  add column if not exists principal_address text,
  add column if not exists public_contact_email text,
  add column if not exists public_contact_phone text,
  add column if not exists website_url text,
  add column if not exists grievance_officer_name text,
  add column if not exists grievance_officer_designation text,
  add column if not exists grievance_email text,
  add column if not exists grievance_phone text;

alter table public.businesses
  add column if not exists legal_name text,
  add column if not exists principal_address text,
  add column if not exists public_contact_email text,
  add column if not exists public_contact_phone text,
  add column if not exists website_url text,
  add column if not exists grievance_officer_name text,
  add column if not exists grievance_officer_designation text,
  add column if not exists grievance_email text,
  add column if not exists grievance_phone text;

alter table public.provider_verification_requests
  drop constraint if exists provider_verification_public_contact_email_check,
  drop constraint if exists provider_verification_website_url_check,
  drop constraint if exists provider_verification_grievance_name_check,
  drop constraint if exists provider_verification_grievance_designation_check,
  drop constraint if exists provider_verification_grievance_email_check,
  drop constraint if exists provider_verification_grievance_phone_check;

alter table public.provider_verification_requests
  add constraint provider_verification_public_contact_email_check check (
    public_contact_email is null or (char_length(btrim(public_contact_email)) between 5 and 254 and position('@' in public_contact_email) > 1)
  ),
  add constraint provider_verification_website_url_check check (
    website_url is null or char_length(btrim(website_url)) between 4 and 300
  ),
  add constraint provider_verification_grievance_name_check check (
    grievance_officer_name is null or char_length(btrim(grievance_officer_name)) between 2 and 160
  ),
  add constraint provider_verification_grievance_designation_check check (
    grievance_officer_designation is null or char_length(btrim(grievance_officer_designation)) between 2 and 120
  ),
  add constraint provider_verification_grievance_email_check check (
    grievance_email is null or (char_length(btrim(grievance_email)) between 5 and 254 and position('@' in grievance_email) > 1)
  ),
  add constraint provider_verification_grievance_phone_check check (
    grievance_phone is null or char_length(btrim(grievance_phone)) between 5 and 40
  );

create or replace function public.provider_owner_is_verified(p_provider_type text,p_professional_id uuid,p_business_id uuid)
returns boolean
language sql
stable
security definer
set search_path=''
as $$
  select case
    when p_provider_type='professional' then exists(
      select 1 from public.professional_profiles p
      where p.id=p_professional_id
        and p.verified=true
        and nullif(btrim(p.legal_name),'') is not null
        and nullif(btrim(p.principal_address),'') is not null
        and nullif(btrim(p.public_contact_email),'') is not null
        and nullif(btrim(p.public_contact_phone),'') is not null
        and nullif(btrim(p.grievance_officer_name),'') is not null
        and nullif(btrim(p.grievance_officer_designation),'') is not null
        and nullif(btrim(p.grievance_email),'') is not null
        and nullif(btrim(p.grievance_phone),'') is not null
    )
    when p_provider_type='business' then exists(
      select 1 from public.businesses b
      where b.id=p_business_id
        and b.verified=true
        and nullif(btrim(b.legal_name),'') is not null
        and nullif(btrim(b.principal_address),'') is not null
        and nullif(btrim(b.public_contact_email),'') is not null
        and nullif(btrim(b.public_contact_phone),'') is not null
        and nullif(btrim(b.grievance_officer_name),'') is not null
        and nullif(btrim(b.grievance_officer_designation),'') is not null
        and nullif(btrim(b.grievance_email),'') is not null
        and nullif(btrim(b.grievance_phone),'') is not null
    )
    else false
  end;
$$;

revoke all on function public.provider_owner_is_verified(text,uuid,uuid) from public;
grant execute on function public.provider_owner_is_verified(text,uuid,uuid) to anon,authenticated,service_role;

create or replace function public.require_provider_marketplace_disclosure_on_verification_approval()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.status='approved' and old.status is distinct from new.status then
    if nullif(btrim(new.public_contact_email),'') is null
      or nullif(btrim(new.contact_phone),'') is null
      or nullif(btrim(new.grievance_officer_name),'') is null
      or nullif(btrim(new.grievance_officer_designation),'') is null
      or nullif(btrim(new.grievance_email),'') is null
      or nullif(btrim(new.grievance_phone),'') is null then
      raise exception 'Marketplace contact and grievance disclosure is required before verification approval.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists provider_verification_require_marketplace_disclosure on public.provider_verification_requests;
create trigger provider_verification_require_marketplace_disclosure
before update of status on public.provider_verification_requests
for each row execute function public.require_provider_marketplace_disclosure_on_verification_approval();

create or replace function public.copy_provider_marketplace_disclosure_after_verification()
returns trigger
language plpgsql
set search_path=''
as $$
begin
  if new.status='approved' and old.status is distinct from new.status then
    if new.provider_type='professional' then
      update public.professional_profiles
      set legal_name=new.legal_name,
          principal_address=new.address,
          public_contact_email=new.public_contact_email,
          public_contact_phone=new.contact_phone,
          website_url=new.website_url,
          grievance_officer_name=new.grievance_officer_name,
          grievance_officer_designation=new.grievance_officer_designation,
          grievance_email=new.grievance_email,
          grievance_phone=new.grievance_phone,
          updated_at=now()
      where id=new.professional_id and user_id=new.applicant_user_id;
    else
      update public.businesses
      set legal_name=new.legal_name,
          principal_address=new.address,
          public_contact_email=new.public_contact_email,
          public_contact_phone=new.contact_phone,
          website_url=new.website_url,
          grievance_officer_name=new.grievance_officer_name,
          grievance_officer_designation=new.grievance_officer_designation,
          grievance_email=new.grievance_email,
          grievance_phone=new.grievance_phone,
          updated_at=now()
      where id=new.business_id and owner_user_id=new.applicant_user_id;
    end if;
  end if;
  return null;
end;
$$;

drop trigger if exists provider_verification_copy_marketplace_disclosure on public.provider_verification_requests;
create trigger provider_verification_copy_marketplace_disclosure
after update of status on public.provider_verification_requests
for each row execute function public.copy_provider_marketplace_disclosure_after_verification();

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
  select id into professional from public.professional_profiles where user_id=auth.uid() limit 1;
  select id into business from public.businesses where owner_user_id=auth.uid() limit 1;
  if professional is not null then ptype:='professional';
  elsif business is not null then ptype:='business';
  else raise exception 'An approved provider account is required before verification.'; end if;
  if (professional is not null and exists(select 1 from public.professional_profiles where id=professional and verified=true)) or
     (business is not null and exists(select 1 from public.businesses where id=business and verified=true)) then raise exception 'This provider is already verified.'; end if;
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
  values(req.id,auth.uid(),'provider','submitted','Provider verification request submitted with marketplace contact and grievance disclosure.');
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(auth.uid(),'provider_verification_submitted','Verification submitted','Your provider verification request is awaiting platform review.');
  return req;
end;
$$;

revoke all on function public.submit_provider_verification(text,text,text,text,text,text,text,text,text,text,text,text) from public,anon;
grant execute on function public.submit_provider_verification(text,text,text,text,text,text,text,text,text,text,text,text) to authenticated,service_role;

-- Prevent new providers from using the legacy verification submission path that lacks marketplace disclosures.
revoke execute on function public.submit_provider_verification(text,text,text,text,text,text) from authenticated;
