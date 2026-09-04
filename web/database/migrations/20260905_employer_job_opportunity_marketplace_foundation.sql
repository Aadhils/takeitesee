-- Product: Employer + job opportunity marketplace foundation.
--
-- Reuses the existing verified business identity as the employer and the existing
-- verified professional identity as the applicant. This migration introduces no
-- payment, subscription, ranking, recurrence, or finance behavior.

create table if not exists public.job_postings (
  id uuid primary key default gen_random_uuid(),
  business_id uuid not null references public.businesses(id) on delete cascade,
  title text not null,
  description text not null,
  employment_type text not null,
  workplace_type text not null default 'onsite',
  location text,
  required_skills text[] not null default '{}'::text[],
  minimum_experience_years smallint,
  openings smallint not null default 1,
  salary_min_minor bigint,
  salary_max_minor bigint,
  salary_currency text not null default 'INR',
  salary_period text,
  application_deadline date,
  status text not null default 'draft',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_postings_title_check check (char_length(btrim(title)) between 3 and 180),
  constraint job_postings_description_check check (char_length(btrim(description)) between 10 and 5000),
  constraint job_postings_employment_type_check check (employment_type in ('full_time','part_time','contract','freelance','internship','temporary')),
  constraint job_postings_workplace_type_check check (workplace_type in ('onsite','remote','hybrid')),
  constraint job_postings_location_check check (location is null or char_length(location) <= 180),
  constraint job_postings_minimum_experience_check check (minimum_experience_years is null or minimum_experience_years between 0 and 50),
  constraint job_postings_openings_check check (openings between 1 and 500),
  constraint job_postings_salary_check check (
    (salary_min_minor is null or salary_min_minor >= 0)
    and (salary_max_minor is null or salary_max_minor >= 0)
    and (salary_min_minor is null or salary_max_minor is null or salary_max_minor >= salary_min_minor)
  ),
  constraint job_postings_currency_check check (salary_currency in ('INR','USD')),
  constraint job_postings_salary_period_check check (salary_period is null or salary_period in ('hour','day','month','year','project')),
  constraint job_postings_status_check check (status in ('draft','open','closed','filled'))
);

create index if not exists job_postings_business_status_created_idx
  on public.job_postings(business_id, status, created_at desc);
create index if not exists job_postings_public_status_deadline_idx
  on public.job_postings(status, application_deadline, created_at desc);

create table if not exists public.job_applications (
  id uuid primary key default gen_random_uuid(),
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  selected_professional_role_id uuid references public.professional_roles(id) on delete set null,
  cover_note text,
  status text not null default 'submitted',
  applied_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_applications_cover_note_check check (cover_note is null or char_length(cover_note) <= 2400),
  constraint job_applications_status_check check (status in ('submitted','shortlisted','interview','hired','rejected','withdrawn')),
  constraint job_applications_unique_professional unique (job_posting_id, professional_id)
);

create index if not exists job_applications_job_status_applied_idx
  on public.job_applications(job_posting_id, status, applied_at desc);
create index if not exists job_applications_professional_status_applied_idx
  on public.job_applications(professional_id, status, applied_at desc);

alter table public.job_postings enable row level security;
alter table public.job_applications enable row level security;

revoke all on table public.job_postings from public,anon,authenticated;
revoke all on table public.job_applications from public,anon,authenticated;

grant select on table public.job_postings to anon,authenticated;
grant insert,update,delete on table public.job_postings to authenticated;
grant select,insert,update on table public.job_applications to authenticated;
grant select,insert,update,delete on table public.job_postings to service_role;
grant select,insert,update,delete on table public.job_applications to service_role;

-- Public job board: only open jobs from verified businesses and inside deadline.
drop policy if exists job_postings_anon_public_read on public.job_postings;
create policy job_postings_anon_public_read
on public.job_postings for select to anon
using (
  status='open'
  and (application_deadline is null or application_deadline >= current_date)
  and exists (
    select 1 from public.businesses business
    where business.id=job_postings.business_id and business.verified=true
  )
);

drop policy if exists job_postings_authenticated_read on public.job_postings;
create policy job_postings_authenticated_read
on public.job_postings for select to authenticated
using (
  exists (
    select 1 from public.businesses business
    where business.id=job_postings.business_id and business.owner_user_id=(select auth.uid())
  )
  or (
    status='open'
    and (application_deadline is null or application_deadline >= current_date)
    and exists (
      select 1 from public.businesses business
      where business.id=job_postings.business_id and business.verified=true
    )
  )
);

drop policy if exists job_postings_owner_insert on public.job_postings;
create policy job_postings_owner_insert
on public.job_postings for insert to authenticated
with check (
  exists (
    select 1 from public.businesses business
    where business.id=job_postings.business_id
      and business.owner_user_id=(select auth.uid())
      and (job_postings.status <> 'open' or business.verified=true)
  )
);

drop policy if exists job_postings_owner_update on public.job_postings;
create policy job_postings_owner_update
on public.job_postings for update to authenticated
using (
  exists (
    select 1 from public.businesses business
    where business.id=job_postings.business_id and business.owner_user_id=(select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.businesses business
    where business.id=job_postings.business_id
      and business.owner_user_id=(select auth.uid())
      and (job_postings.status <> 'open' or business.verified=true)
  )
);

drop policy if exists job_postings_owner_delete on public.job_postings;
create policy job_postings_owner_delete
on public.job_postings for delete to authenticated
using (
  exists (
    select 1 from public.businesses business
    where business.id=job_postings.business_id and business.owner_user_id=(select auth.uid())
  )
);

-- Applications are visible only to the applicant or the owning employer.
drop policy if exists job_applications_participant_read on public.job_applications;
create policy job_applications_participant_read
on public.job_applications for select to authenticated
using (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id=job_applications.professional_id and profile.user_id=(select auth.uid())
  )
  or exists (
    select 1
    from public.job_postings posting
    join public.businesses business on business.id=posting.business_id
    where posting.id=job_applications.job_posting_id and business.owner_user_id=(select auth.uid())
  )
);

drop policy if exists job_applications_professional_insert on public.job_applications;
create policy job_applications_professional_insert
on public.job_applications for insert to authenticated
with check (
  job_applications.status='submitted'
  and exists (
    select 1 from public.professional_profiles profile
    where profile.id=job_applications.professional_id
      and profile.user_id=(select auth.uid())
      and profile.verified=true
  )
  and (
    job_applications.selected_professional_role_id is null
    or exists (
      select 1 from public.professional_roles role
      where role.id=job_applications.selected_professional_role_id
        and role.professional_id=job_applications.professional_id
    )
  )
  and exists (
    select 1
    from public.job_postings posting
    join public.businesses business on business.id=posting.business_id
    where posting.id=job_applications.job_posting_id
      and posting.status='open'
      and (posting.application_deadline is null or posting.application_deadline >= current_date)
      and business.verified=true
      and business.owner_user_id <> (select auth.uid())
  )
);

drop policy if exists job_applications_participant_update on public.job_applications;
create policy job_applications_participant_update
on public.job_applications for update to authenticated
using (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id=job_applications.professional_id and profile.user_id=(select auth.uid())
  )
  or exists (
    select 1
    from public.job_postings posting
    join public.businesses business on business.id=posting.business_id
    where posting.id=job_applications.job_posting_id and business.owner_user_id=(select auth.uid())
  )
)
with check (
  exists (
    select 1 from public.professional_profiles profile
    where profile.id=job_applications.professional_id and profile.user_id=(select auth.uid())
  )
  or exists (
    select 1
    from public.job_postings posting
    join public.businesses business on business.id=posting.business_id
    where posting.id=job_applications.job_posting_id and business.owner_user_id=(select auth.uid())
  )
);

-- Prevent participant UPDATE grants from becoming a status-escalation path.
create or replace function public.validate_job_application_update()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  applicant_owner boolean := false;
  employer_owner boolean := false;
begin
  if actor is null then
    raise exception 'Authentication required';
  end if;

  if new.job_posting_id is distinct from old.job_posting_id
     or new.professional_id is distinct from old.professional_id
     or new.selected_professional_role_id is distinct from old.selected_professional_role_id
     or new.cover_note is distinct from old.cover_note
     or new.applied_at is distinct from old.applied_at then
    raise exception 'Application identity and submitted content are immutable';
  end if;

  select exists (
    select 1 from public.professional_profiles profile
    where profile.id=old.professional_id and profile.user_id=actor
  ) into applicant_owner;

  select exists (
    select 1
    from public.job_postings posting
    join public.businesses business on business.id=posting.business_id
    where posting.id=old.job_posting_id and business.owner_user_id=actor
  ) into employer_owner;

  if applicant_owner then
    if new.status <> 'withdrawn'
       or old.status not in ('submitted','shortlisted','interview') then
      raise exception 'Applicant can only withdraw an active application';
    end if;
  elsif employer_owner then
    if not (
      (old.status='submitted' and new.status in ('shortlisted','interview','rejected'))
      or (old.status='shortlisted' and new.status in ('interview','rejected'))
      or (old.status='interview' and new.status in ('hired','rejected'))
    ) then
      raise exception 'Invalid employer application status transition';
    end if;
  else
    raise exception 'Application update not permitted';
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.validate_job_application_update() from public,anon,authenticated;

drop trigger if exists job_applications_validate_update on public.job_applications;
create trigger job_applications_validate_update
before update on public.job_applications
for each row execute function public.validate_job_application_update();

comment on table public.job_postings is
  'Employment and freelance opportunities posted by verified TakeItEsee business identities.';
comment on table public.job_applications is
  'Professional applications to TakeItEsee job opportunities with controlled participant status transitions.';
