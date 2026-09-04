-- Professional ecosystem: immutable resume snapshot per job application.
--
-- A job application is an explicit sharing context between one verified Professional
-- and the Business employer that owns the job. Capture a frozen, career-only snapshot
-- at application time without loosening the Professional's public resume privacy gate.
-- Contact, legal/KYC, grievance and finance fields are intentionally excluded.

create table if not exists public.job_application_resume_snapshots (
  job_application_id uuid primary key references public.job_applications(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete restrict,
  snapshot_version smallint not null default 1,
  snapshot jsonb not null,
  captured_at timestamptz not null default now(),
  constraint job_application_resume_snapshots_version_check check (snapshot_version between 1 and 100),
  constraint job_application_resume_snapshots_object_check check (jsonb_typeof(snapshot) = 'object')
);

create index if not exists job_application_resume_snapshots_professional_id_idx
  on public.job_application_resume_snapshots(professional_id);

alter table public.job_application_resume_snapshots enable row level security;

revoke all on table public.job_application_resume_snapshots from public, anon, authenticated;
grant select on table public.job_application_resume_snapshots to authenticated;
grant select, insert, update, delete on table public.job_application_resume_snapshots to service_role;

drop policy if exists job_application_resume_snapshots_participant_read on public.job_application_resume_snapshots;
create policy job_application_resume_snapshots_participant_read
on public.job_application_resume_snapshots
for select
to authenticated
using (
  exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id = application.professional_id
    where application.id = job_application_resume_snapshots.job_application_id
      and profile.user_id = (select auth.uid())
  )
  or exists (
    select 1
    from public.job_applications application
    join public.job_postings posting on posting.id = application.job_posting_id
    join public.businesses business on business.id = posting.business_id
    where application.id = job_application_resume_snapshots.job_application_id
      and business.owner_user_id = (select auth.uid())
  )
);

create or replace function private.capture_job_application_resume_snapshot()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  profile_row public.professional_profiles%rowtype;
  career_row public.professional_career_profiles%rowtype;
  role_payload jsonb := null;
  skills_payload jsonb := '[]'::jsonb;
  experience_payload jsonb := '[]'::jsonb;
  education_payload jsonb := '[]'::jsonb;
  certification_payload jsonb := '[]'::jsonb;
  snapshot_payload jsonb;
begin
  select * into profile_row
  from public.professional_profiles
  where id = new.professional_id;
  if not found then
    raise exception 'Professional profile was not found for resume snapshot.';
  end if;

  if new.selected_professional_role_id is not null then
    select jsonb_build_object(
      'id', role.id,
      'title', role.title,
      'summary', role.summary,
      'experience_years', role.experience_years,
      'service_bookings_enabled', role.service_bookings_enabled,
      'freelance_enabled', role.freelance_enabled,
      'part_time_enabled', role.part_time_enabled,
      'full_time_enabled', role.full_time_enabled,
      'contract_enabled', role.contract_enabled,
      'active', role.active
    )
    into role_payload
    from public.professional_roles role
    where role.id = new.selected_professional_role_id
      and role.professional_id = new.professional_id;
  end if;

  select * into career_row
  from public.professional_career_profiles
  where professional_id = new.professional_id;

  select coalesce(jsonb_agg(to_jsonb(skill) - 'professional_id' - 'created_at' - 'updated_at' order by skill.display_order, skill.id), '[]'::jsonb)
  into skills_payload
  from (
    select *
    from public.professional_skills
    where professional_id = new.professional_id
    order by display_order, id
    limit 50
  ) skill;

  select coalesce(jsonb_agg(to_jsonb(experience) - 'professional_id' - 'created_at' - 'updated_at' order by experience.display_order, experience.id), '[]'::jsonb)
  into experience_payload
  from (
    select *
    from public.professional_experiences
    where professional_id = new.professional_id
    order by display_order, id
    limit 30
  ) experience;

  select coalesce(jsonb_agg(to_jsonb(education) - 'professional_id' - 'created_at' - 'updated_at' order by education.display_order, education.id), '[]'::jsonb)
  into education_payload
  from (
    select *
    from public.professional_education
    where professional_id = new.professional_id
    order by display_order, id
    limit 20
  ) education;

  select coalesce(jsonb_agg(to_jsonb(certification) - 'professional_id' - 'created_at' - 'updated_at' order by certification.display_order, certification.id), '[]'::jsonb)
  into certification_payload
  from (
    select *
    from public.professional_certifications
    where professional_id = new.professional_id
    order by display_order, id
    limit 20
  ) certification;

  snapshot_payload := jsonb_build_object(
    'profile', jsonb_build_object(
      'headline', profile_row.headline,
      'service_area', profile_row.service_area,
      'verified', profile_row.verified
    ),
    'selected_role', role_payload,
    'career', case when career_row.professional_id is null then null else jsonb_build_object(
      'career_headline', career_row.career_headline,
      'career_summary', career_row.career_summary,
      'preferred_location', career_row.preferred_location,
      'open_to_remote', career_row.open_to_remote,
      'willing_to_relocate', career_row.willing_to_relocate,
      'available_from', career_row.available_from,
      'notice_period_days', career_row.notice_period_days,
      'availability_note', career_row.availability_note
    ) end,
    'skills', skills_payload,
    'experiences', experience_payload,
    'education', education_payload,
    'certifications', certification_payload,
    'disclosure', jsonb_build_object(
      'purpose', 'job_application_employer_review',
      'public_resume_setting_bypassed', false,
      'contains_contact_or_kyc', false
    )
  );

  insert into public.job_application_resume_snapshots(
    job_application_id,
    professional_id,
    snapshot_version,
    snapshot,
    captured_at
  ) values (
    new.id,
    new.professional_id,
    1,
    snapshot_payload,
    coalesce(new.applied_at, now())
  )
  on conflict (job_application_id) do nothing;

  return new;
end;
$$;

revoke all on function private.capture_job_application_resume_snapshot() from public, anon, authenticated;

drop trigger if exists job_applications_capture_resume_snapshot on public.job_applications;
create trigger job_applications_capture_resume_snapshot
after insert on public.job_applications
for each row execute function private.capture_job_application_resume_snapshot();

comment on table public.job_application_resume_snapshots is
  'Immutable career-only resume snapshot captured when a verified Professional submits a job application. Readable only by the applicant and the Business employer that owns the job.';
comment on column public.job_application_resume_snapshots.snapshot is
  'Frozen job-application career payload. Excludes contact, KYC/legal, grievance and finance data and does not alter public resume visibility.';
