-- Align Provider identity and Professional talent/career public visibility with the
-- canonical trust gate already used by Services, Products and order-request eligibility.
-- Owner/Admin private access remains unchanged. No Provider content or lifecycle data is mutated.

drop policy if exists businesses_public_verified_read on public.businesses;
create policy businesses_public_verified_read
on public.businesses for select to anon
using (
  verified = true
  and private.provider_marketplace_disclosure_is_complete('business', null, id)
  and private.provider_trust_allows_marketplace('business', null, id)
);

drop policy if exists professionals_public_verified_read on public.professional_profiles;
create policy professionals_public_verified_read
on public.professional_profiles for select to anon
using (
  verified = true
  and private.provider_marketplace_disclosure_is_complete('professional', id, null)
  and private.provider_trust_allows_marketplace('professional', id, null)
);

drop policy if exists professional_roles_anon_public_read on public.professional_roles;
create policy professional_roles_anon_public_read
on public.professional_roles for select to anon
using (
  active
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  and private.provider_trust_allows_marketplace('professional', professional_id, null)
);

drop policy if exists professional_roles_authenticated_read on public.professional_roles;
create policy professional_roles_authenticated_read
on public.professional_roles for select to authenticated
using (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id = professional_roles.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    active
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
    and private.provider_trust_allows_marketplace('professional', professional_id, null)
  )
);

drop policy if exists professional_career_profiles_anon_public_read on public.professional_career_profiles;
create policy professional_career_profiles_anon_public_read
on public.professional_career_profiles for select to anon
using (
  public_resume_enabled
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  and private.provider_trust_allows_marketplace('professional', professional_id, null)
);

drop policy if exists professional_career_profiles_authenticated_read on public.professional_career_profiles;
create policy professional_career_profiles_authenticated_read
on public.professional_career_profiles for select to authenticated
using (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id = professional_career_profiles.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    public_resume_enabled
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
    and private.provider_trust_allows_marketplace('professional', professional_id, null)
  )
);

drop policy if exists professional_certifications_anon_public_read on public.professional_certifications;
create policy professional_certifications_anon_public_read
on public.professional_certifications for select to anon
using (
  exists (
    select 1 from public.professional_career_profiles career
    where career.professional_id = professional_certifications.professional_id
      and career.public_resume_enabled = true
  )
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  and private.provider_trust_allows_marketplace('professional', professional_id, null)
);

drop policy if exists professional_certifications_authenticated_read on public.professional_certifications;
create policy professional_certifications_authenticated_read
on public.professional_certifications for select to authenticated
using (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id = professional_certifications.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    exists (
      select 1 from public.professional_career_profiles career
      where career.professional_id = professional_certifications.professional_id
        and career.public_resume_enabled = true
    )
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
    and private.provider_trust_allows_marketplace('professional', professional_id, null)
  )
);

drop policy if exists professional_education_anon_public_read on public.professional_education;
create policy professional_education_anon_public_read
on public.professional_education for select to anon
using (
  exists (
    select 1 from public.professional_career_profiles career
    where career.professional_id = professional_education.professional_id
      and career.public_resume_enabled = true
  )
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  and private.provider_trust_allows_marketplace('professional', professional_id, null)
);

drop policy if exists professional_education_authenticated_read on public.professional_education;
create policy professional_education_authenticated_read
on public.professional_education for select to authenticated
using (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id = professional_education.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    exists (
      select 1 from public.professional_career_profiles career
      where career.professional_id = professional_education.professional_id
        and career.public_resume_enabled = true
    )
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
    and private.provider_trust_allows_marketplace('professional', professional_id, null)
  )
);

drop policy if exists professional_experiences_anon_public_read on public.professional_experiences;
create policy professional_experiences_anon_public_read
on public.professional_experiences for select to anon
using (
  exists (
    select 1 from public.professional_career_profiles career
    where career.professional_id = professional_experiences.professional_id
      and career.public_resume_enabled = true
  )
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  and private.provider_trust_allows_marketplace('professional', professional_id, null)
);

drop policy if exists professional_experiences_authenticated_read on public.professional_experiences;
create policy professional_experiences_authenticated_read
on public.professional_experiences for select to authenticated
using (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id = professional_experiences.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    exists (
      select 1 from public.professional_career_profiles career
      where career.professional_id = professional_experiences.professional_id
        and career.public_resume_enabled = true
    )
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
    and private.provider_trust_allows_marketplace('professional', professional_id, null)
  )
);

drop policy if exists professional_skills_anon_public_read on public.professional_skills;
create policy professional_skills_anon_public_read
on public.professional_skills for select to anon
using (
  exists (
    select 1 from public.professional_career_profiles career
    where career.professional_id = professional_skills.professional_id
      and career.public_resume_enabled = true
  )
  and private.provider_owner_is_verified('professional', professional_id, null)
  and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
  and private.provider_trust_allows_marketplace('professional', professional_id, null)
);

drop policy if exists professional_skills_authenticated_read on public.professional_skills;
create policy professional_skills_authenticated_read
on public.professional_skills for select to authenticated
using (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id = professional_skills.professional_id
      and profile.user_id = (select auth.uid())
  )
  or (
    exists (
      select 1 from public.professional_career_profiles career
      where career.professional_id = professional_skills.professional_id
        and career.public_resume_enabled = true
    )
    and private.provider_owner_is_verified('professional', professional_id, null)
    and private.provider_marketplace_disclosure_is_complete('professional', professional_id, null)
    and private.provider_trust_allows_marketplace('professional', professional_id, null)
  )
);
