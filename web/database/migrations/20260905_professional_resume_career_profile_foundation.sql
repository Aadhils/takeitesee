-- Product: Professional resume / career profile foundation.
--
-- Extends the one-master-professional identity with structured career data for
-- education, work experience, certifications and skills. Public resume visibility
-- is opt-in and requires the parent professional identity to remain verified.
-- Job applications, employer workflows, ranking/subscription boosts and finance
-- behavior are intentionally outside this migration.

create table if not exists public.professional_career_profiles (
  professional_id uuid primary key references public.professional_profiles(id) on delete cascade,
  career_headline text,
  career_summary text,
  preferred_location text,
  open_to_remote boolean not null default false,
  willing_to_relocate boolean not null default false,
  available_from date,
  notice_period_days integer,
  availability_note text,
  public_resume_enabled boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_career_profiles_headline_check
    check (career_headline is null or char_length(btrim(career_headline)) between 2 and 160),
  constraint professional_career_profiles_summary_check
    check (career_summary is null or char_length(career_summary) <= 2400),
  constraint professional_career_profiles_location_check
    check (preferred_location is null or char_length(preferred_location) <= 160),
  constraint professional_career_profiles_notice_check
    check (notice_period_days is null or notice_period_days between 0 and 365),
  constraint professional_career_profiles_availability_note_check
    check (availability_note is null or char_length(availability_note) <= 600)
);

create table if not exists public.professional_experiences (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  role_title text not null,
  organization text not null,
  employment_type text not null default 'full_time',
  location text,
  start_date date not null,
  end_date date,
  current_role boolean not null default false,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_experiences_role_title_check
    check (char_length(btrim(role_title)) between 2 and 160),
  constraint professional_experiences_organization_check
    check (char_length(btrim(organization)) between 2 and 180),
  constraint professional_experiences_employment_type_check
    check (employment_type in ('full_time','part_time','contract','freelance','internship','self_employed','other')),
  constraint professional_experiences_location_check
    check (location is null or char_length(location) <= 160),
  constraint professional_experiences_description_check
    check (description is null or char_length(description) <= 2400),
  constraint professional_experiences_dates_check
    check ((current_role and end_date is null) or (not current_role and (end_date is null or end_date >= start_date))),
  constraint professional_experiences_display_order_check
    check (display_order between 0 and 9999)
);

create index if not exists professional_experiences_professional_order_idx
  on public.professional_experiences(professional_id, display_order, start_date desc);

create table if not exists public.professional_education (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  institution text not null,
  qualification text not null,
  field_of_study text,
  start_date date,
  end_date date,
  description text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_education_institution_check
    check (char_length(btrim(institution)) between 2 and 180),
  constraint professional_education_qualification_check
    check (char_length(btrim(qualification)) between 2 and 180),
  constraint professional_education_field_check
    check (field_of_study is null or char_length(field_of_study) <= 180),
  constraint professional_education_description_check
    check (description is null or char_length(description) <= 1600),
  constraint professional_education_dates_check
    check (start_date is null or end_date is null or end_date >= start_date),
  constraint professional_education_display_order_check
    check (display_order between 0 and 9999)
);

create index if not exists professional_education_professional_order_idx
  on public.professional_education(professional_id, display_order, coalesce(end_date,start_date) desc nulls last);

create table if not exists public.professional_certifications (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  name text not null,
  issuing_organization text not null,
  issue_date date,
  expiry_date date,
  credential_id text,
  credential_url text,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_certifications_name_check
    check (char_length(btrim(name)) between 2 and 180),
  constraint professional_certifications_issuer_check
    check (char_length(btrim(issuing_organization)) between 2 and 180),
  constraint professional_certifications_credential_id_check
    check (credential_id is null or char_length(credential_id) <= 180),
  constraint professional_certifications_credential_url_check
    check (credential_url is null or char_length(credential_url) <= 1000),
  constraint professional_certifications_dates_check
    check (issue_date is null or expiry_date is null or expiry_date >= issue_date),
  constraint professional_certifications_display_order_check
    check (display_order between 0 and 9999)
);

create index if not exists professional_certifications_professional_order_idx
  on public.professional_certifications(professional_id, display_order, issue_date desc nulls last);

create table if not exists public.professional_skills (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  name text not null,
  proficiency text,
  years_experience integer,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint professional_skills_name_check
    check (char_length(btrim(name)) between 2 and 120),
  constraint professional_skills_proficiency_check
    check (proficiency is null or proficiency in ('beginner','intermediate','advanced','expert')),
  constraint professional_skills_years_check
    check (years_experience is null or years_experience between 0 and 80),
  constraint professional_skills_display_order_check
    check (display_order between 0 and 9999)
);

create unique index if not exists professional_skills_professional_name_unique_idx
  on public.professional_skills(professional_id, lower(btrim(name)));
create index if not exists professional_skills_professional_order_idx
  on public.professional_skills(professional_id, display_order, created_at);

-- All career tables are Data API opt-in explicitly and protected with RLS.
alter table public.professional_career_profiles enable row level security;
alter table public.professional_experiences enable row level security;
alter table public.professional_education enable row level security;
alter table public.professional_certifications enable row level security;
alter table public.professional_skills enable row level security;

revoke all on table public.professional_career_profiles from public,anon,authenticated;
revoke all on table public.professional_experiences from public,anon,authenticated;
revoke all on table public.professional_education from public,anon,authenticated;
revoke all on table public.professional_certifications from public,anon,authenticated;
revoke all on table public.professional_skills from public,anon,authenticated;

grant select on table public.professional_career_profiles to anon,authenticated;
grant select on table public.professional_experiences to anon,authenticated;
grant select on table public.professional_education to anon,authenticated;
grant select on table public.professional_certifications to anon,authenticated;
grant select on table public.professional_skills to anon,authenticated;

grant insert,update,delete on table public.professional_career_profiles to authenticated;
grant insert,update,delete on table public.professional_experiences to authenticated;
grant insert,update,delete on table public.professional_education to authenticated;
grant insert,update,delete on table public.professional_certifications to authenticated;
grant insert,update,delete on table public.professional_skills to authenticated;

grant select,insert,update,delete on table public.professional_career_profiles to service_role;
grant select,insert,update,delete on table public.professional_experiences to service_role;
grant select,insert,update,delete on table public.professional_education to service_role;
grant select,insert,update,delete on table public.professional_certifications to service_role;
grant select,insert,update,delete on table public.professional_skills to service_role;

-- Career profile: public only when explicitly enabled and master identity is verified.
drop policy if exists professional_career_profiles_anon_public_read on public.professional_career_profiles;
create policy professional_career_profiles_anon_public_read
on public.professional_career_profiles for select to anon
using (
  public_resume_enabled
  and exists (
    select 1 from public.professional_profiles profile
    where profile.id=professional_career_profiles.professional_id and profile.verified=true
  )
);

drop policy if exists professional_career_profiles_authenticated_read on public.professional_career_profiles;
create policy professional_career_profiles_authenticated_read
on public.professional_career_profiles for select to authenticated
using (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id=professional_career_profiles.professional_id and profile.user_id=(select auth.uid())
  )
  or (
    public_resume_enabled
    and exists (
      select 1 from public.professional_profiles profile
      where profile.id=professional_career_profiles.professional_id and profile.verified=true
    )
  )
);

drop policy if exists professional_career_profiles_owner_insert on public.professional_career_profiles;
create policy professional_career_profiles_owner_insert
on public.professional_career_profiles for insert to authenticated
with check (exists (
  select 1 from public.professional_profiles profile
  where profile.id=professional_career_profiles.professional_id and profile.user_id=(select auth.uid())
));

drop policy if exists professional_career_profiles_owner_update on public.professional_career_profiles;
create policy professional_career_profiles_owner_update
on public.professional_career_profiles for update to authenticated
using (exists (
  select 1 from public.professional_profiles profile
  where profile.id=professional_career_profiles.professional_id and profile.user_id=(select auth.uid())
))
with check (exists (
  select 1 from public.professional_profiles profile
  where profile.id=professional_career_profiles.professional_id and profile.user_id=(select auth.uid())
));

drop policy if exists professional_career_profiles_owner_delete on public.professional_career_profiles;
create policy professional_career_profiles_owner_delete
on public.professional_career_profiles for delete to authenticated
using (exists (
  select 1 from public.professional_profiles profile
  where profile.id=professional_career_profiles.professional_id and profile.user_id=(select auth.uid())
));

-- Child tables: owners always see their own rows. Public reads inherit the same
-- verified + explicit resume-public gate from the parent career profile.

do $$
declare
  table_name text;
begin
  foreach table_name in array array[
    'professional_experiences',
    'professional_education',
    'professional_certifications',
    'professional_skills'
  ]
  loop
    execute format('drop policy if exists %I_anon_public_read on public.%I', table_name, table_name);
    execute format($policy$
      create policy %I_anon_public_read on public.%I
      for select to anon
      using (
        exists (
          select 1
          from public.professional_career_profiles career
          join public.professional_profiles profile on profile.id=career.professional_id
          where career.professional_id=%I.professional_id
            and career.public_resume_enabled=true
            and profile.verified=true
        )
      )
    $policy$, table_name, table_name, table_name);

    execute format('drop policy if exists %I_authenticated_read on public.%I', table_name, table_name);
    execute format($policy$
      create policy %I_authenticated_read on public.%I
      for select to authenticated
      using (
        exists (
          select 1 from public.professional_profiles profile
          where profile.id=%I.professional_id and profile.user_id=(select auth.uid())
        )
        or exists (
          select 1
          from public.professional_career_profiles career
          join public.professional_profiles profile on profile.id=career.professional_id
          where career.professional_id=%I.professional_id
            and career.public_resume_enabled=true
            and profile.verified=true
        )
      )
    $policy$, table_name, table_name, table_name, table_name);

    execute format('drop policy if exists %I_owner_insert on public.%I', table_name, table_name);
    execute format($policy$
      create policy %I_owner_insert on public.%I
      for insert to authenticated
      with check (exists (
        select 1 from public.professional_profiles profile
        where profile.id=%I.professional_id and profile.user_id=(select auth.uid())
      ))
    $policy$, table_name, table_name, table_name);

    execute format('drop policy if exists %I_owner_update on public.%I', table_name, table_name);
    execute format($policy$
      create policy %I_owner_update on public.%I
      for update to authenticated
      using (exists (
        select 1 from public.professional_profiles profile
        where profile.id=%I.professional_id and profile.user_id=(select auth.uid())
      ))
      with check (exists (
        select 1 from public.professional_profiles profile
        where profile.id=%I.professional_id and profile.user_id=(select auth.uid())
      ))
    $policy$, table_name, table_name, table_name, table_name);

    execute format('drop policy if exists %I_owner_delete on public.%I', table_name, table_name);
    execute format($policy$
      create policy %I_owner_delete on public.%I
      for delete to authenticated
      using (exists (
        select 1 from public.professional_profiles profile
        where profile.id=%I.professional_id and profile.user_id=(select auth.uid())
      ))
    $policy$, table_name, table_name, table_name);
  end loop;
end
$$;

comment on table public.professional_career_profiles is
  'Opt-in public career/resume summary attached to one verified master professional identity.';
comment on table public.professional_experiences is
  'Professional-owned structured work experience entries.';
comment on table public.professional_education is
  'Professional-owned education history entries.';
comment on table public.professional_certifications is
  'Professional-owned certification and credential entries.';
comment on table public.professional_skills is
  'Professional-owned resume skill keywords and proficiency signals.';
