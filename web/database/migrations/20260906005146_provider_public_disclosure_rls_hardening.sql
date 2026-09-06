-- Align database-level public visibility with the marketplace disclosure gate.
--
-- PR #280 aligned application read paths, but the underlying anonymous/authenticated
-- non-owner RLS branches still treated verified=true as sufficient for Provider identity,
-- Professional talent/career data and launch-ready services. This migration moves the
-- same legal/public-contact/grievance completeness rule into the database visibility
-- boundary while preserving Provider-owner and Super Admin access.
--
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remains HOLD.
-- Recurrence/recovery remains frozen.

create or replace function private.provider_marketplace_disclosure_is_complete(
  p_provider_type text,
  p_professional_id uuid,
  p_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when p_provider_type = 'professional' then exists (
      select 1
      from public.professional_profiles p
      where p.id = p_professional_id
        and nullif(btrim(coalesce(p.legal_name, '')), '') is not null
        and nullif(btrim(coalesce(p.principal_address, '')), '') is not null
        and nullif(btrim(coalesce(p.public_contact_email, '')), '') is not null
        and nullif(btrim(coalesce(p.public_contact_phone, '')), '') is not null
        and nullif(btrim(coalesce(p.grievance_officer_name, '')), '') is not null
        and nullif(btrim(coalesce(p.grievance_officer_designation, '')), '') is not null
        and nullif(btrim(coalesce(p.grievance_email, '')), '') is not null
        and nullif(btrim(coalesce(p.grievance_phone, '')), '') is not null
    )
    when p_provider_type = 'business' then exists (
      select 1
      from public.businesses b
      where b.id = p_business_id
        and nullif(btrim(coalesce(b.legal_name, '')), '') is not null
        and nullif(btrim(coalesce(b.principal_address, '')), '') is not null
        and nullif(btrim(coalesce(b.public_contact_email, '')), '') is not null
        and nullif(btrim(coalesce(b.public_contact_phone, '')), '') is not null
        and nullif(btrim(coalesce(b.grievance_officer_name, '')), '') is not null
        and nullif(btrim(coalesce(b.grievance_officer_designation, '')), '') is not null
        and nullif(btrim(coalesce(b.grievance_email, '')), '') is not null
        and nullif(btrim(coalesce(b.grievance_phone, '')), '') is not null
    )
    else false
  end;
$$;

revoke all on function private.provider_marketplace_disclosure_is_complete(text, uuid, uuid) from public;
grant execute on function private.provider_marketplace_disclosure_is_complete(text, uuid, uuid)
  to anon, authenticated, service_role;

-- Provider identity rows: public/non-owner visibility requires both verification and
-- complete marketplace disclosure. Owner and Super Admin access remains unchanged.
drop policy if exists businesses_public_verified_read on public.businesses;
create policy businesses_public_verified_read
on public.businesses
for select
to anon
using (
  verified = true
  and private.provider_marketplace_disclosure_is_complete('business', null, id)
);

drop policy if exists businesses_authenticated_read on public.businesses;
create policy businesses_authenticated_read
on public.businesses
for select
to authenticated
using (
  (
    verified = true
    and private.provider_marketplace_disclosure_is_complete('business', null, id)
  )
  or owner_user_id = (select auth.uid())
  or private.is_super_admin()
);

drop policy if exists professionals_public_verified_read on public.professional_profiles;
create policy professionals_public_verified_read
on public.professional_profiles
for select
to anon
using (
  verified = true
  and private.provider_marketplace_disclosure_is_complete('professional', id, null)
);

drop policy if exists professionals_authenticated_read on public.professional_profiles;
create policy professionals_authenticated_read
on public.professional_profiles
for select
to authenticated
using (
  (
    verified = true
    and private.provider_marketplace_disclosure_is_complete('professional', id, null)
  )
  or user_id = (select auth.uid())
  or private.is_super_admin()
);

-- Public services must not be queryable directly from Supabase unless their Provider
-- satisfies the same disclosure gate as the application marketplace.
drop policy if exists services_anon_read_launch_ready on public.services;
create policy services_anon_read_launch_ready
on public.services
for select
to anon
using (
  status = 'active'::public.service_status
  and active = true
  and private.provider_owner_is_verified((provider_type)::text, professional_id, business_id)
  and private.provider_profile_is_complete((provider_type)::text, professional_id, business_id)
  and private.provider_marketplace_disclosure_is_complete((provider_type)::text, professional_id, business_id)
  and private.service_scope_is_launchable(id)
  and private.provider_trust_allows_marketplace((provider_type)::text, professional_id, business_id)
);

drop policy if exists services_authenticated_read on public.services;
create policy services_authenticated_read
on public.services
for select
to authenticated
using (
  (
    status = 'active'::public.service_status
    and active = true
    and private.provider_owner_is_verified((provider_type)::text, professional_id, business_id)
    and private.provider_profile_is_complete((provider_type)::text, professional_id, business_id)
    and private.provider_marketplace_disclosure_is_complete((provider_type)::text, professional_id, business_id)
    and private.service_scope_is_launchable(id)
    and private.provider_trust_allows_marketplace((provider_type)::text, professional_id, business_id)
  )
  or exists (
    select 1
    from public.professional_profiles pp
    where pp.id = services.professional_id
      and pp.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.businesses b
    where b.id = services.business_id
      and b.owner_user_id = (select auth.uid())
  )
);

-- Professional public talents.
drop policy if exists professional_roles_anon_public_read on public.professional_roles;
create policy professional_roles_anon_public_read
on public.professional_roles
for select
to anon
using (
  active
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
);

drop policy if exists professional_roles_authenticated_read on public.professional_roles;
create policy professional_roles_authenticated_read
on public.professional_roles
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    active
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  )
);

-- Professional public career profile.
drop policy if exists professional_career_profiles_anon_public_read on public.professional_career_profiles;
create policy professional_career_profiles_anon_public_read
on public.professional_career_profiles
for select
to anon
using (
  public_resume_enabled
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
);

drop policy if exists professional_career_profiles_authenticated_read on public.professional_career_profiles;
create policy professional_career_profiles_authenticated_read
on public.professional_career_profiles
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_career_profiles.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    public_resume_enabled
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  )
);

-- Public career child rows remain owner-readable privately, while their public branch
-- requires a published career profile plus verified + disclosure-complete Professional.
drop policy if exists professional_certifications_anon_public_read on public.professional_certifications;
create policy professional_certifications_anon_public_read
on public.professional_certifications
for select
to anon
using (
  exists (
    select 1
    from public.professional_career_profiles career
    where career.professional_id = professional_certifications.professional_id
      and career.public_resume_enabled = true
  )
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
);

drop policy if exists professional_certifications_authenticated_read on public.professional_certifications;
create policy professional_certifications_authenticated_read
on public.professional_certifications
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_certifications.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    exists (
      select 1
      from public.professional_career_profiles career
      where career.professional_id = professional_certifications.professional_id
        and career.public_resume_enabled = true
    )
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  )
);

drop policy if exists professional_education_anon_public_read on public.professional_education;
create policy professional_education_anon_public_read
on public.professional_education
for select
to anon
using (
  exists (
    select 1
    from public.professional_career_profiles career
    where career.professional_id = professional_education.professional_id
      and career.public_resume_enabled = true
  )
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
);

drop policy if exists professional_education_authenticated_read on public.professional_education;
create policy professional_education_authenticated_read
on public.professional_education
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_education.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    exists (
      select 1
      from public.professional_career_profiles career
      where career.professional_id = professional_education.professional_id
        and career.public_resume_enabled = true
    )
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  )
);

drop policy if exists professional_experiences_anon_public_read on public.professional_experiences;
create policy professional_experiences_anon_public_read
on public.professional_experiences
for select
to anon
using (
  exists (
    select 1
    from public.professional_career_profiles career
    where career.professional_id = professional_experiences.professional_id
      and career.public_resume_enabled = true
  )
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
);

drop policy if exists professional_experiences_authenticated_read on public.professional_experiences;
create policy professional_experiences_authenticated_read
on public.professional_experiences
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_experiences.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    exists (
      select 1
      from public.professional_career_profiles career
      where career.professional_id = professional_experiences.professional_id
        and career.public_resume_enabled = true
    )
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  )
);

drop policy if exists professional_skills_anon_public_read on public.professional_skills;
create policy professional_skills_anon_public_read
on public.professional_skills
for select
to anon
using (
  exists (
    select 1
    from public.professional_career_profiles career
    where career.professional_id = professional_skills.professional_id
      and career.public_resume_enabled = true
  )
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
);

drop policy if exists professional_skills_authenticated_read on public.professional_skills;
create policy professional_skills_authenticated_read
on public.professional_skills
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_skills.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    exists (
      select 1
      from public.professional_career_profiles career
      where career.professional_id = professional_skills.professional_id
        and career.public_resume_enabled = true
    )
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  )
);
