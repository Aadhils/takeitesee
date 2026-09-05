create table public.professional_saved_jobs (
  professional_id uuid not null references public.professional_profiles(id) on delete cascade,
  job_posting_id uuid not null references public.job_postings(id) on delete cascade,
  saved_at timestamptz not null default now(),
  primary key (professional_id, job_posting_id)
);

create index professional_saved_jobs_job_posting_id_idx
  on public.professional_saved_jobs(job_posting_id);

revoke all on table public.professional_saved_jobs from public, anon, authenticated;
grant select, insert, delete on table public.professional_saved_jobs to authenticated;
grant select, insert, update, delete on table public.professional_saved_jobs to service_role;

alter table public.professional_saved_jobs enable row level security;

create policy professional_saved_jobs_owner_select
on public.professional_saved_jobs
for select
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_saved_jobs.professional_id
      and profile.user_id = (select auth.uid())
  )
);

create policy professional_saved_jobs_owner_insert
on public.professional_saved_jobs
for insert
to authenticated
with check (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_saved_jobs.professional_id
      and profile.user_id = (select auth.uid())
  )
  and exists (
    select 1
    from public.job_postings posting
    join public.businesses business on business.id = posting.business_id
    where posting.id = professional_saved_jobs.job_posting_id
      and posting.status = 'open'
      and posting.moderation_state = 'clear'
      and (posting.application_deadline is null or posting.application_deadline >= current_date)
      and business.verified = true
      and business.owner_user_id <> (select auth.uid())
  )
);

create policy professional_saved_jobs_owner_delete
on public.professional_saved_jobs
for delete
to authenticated
using (
  exists (
    select 1
    from public.professional_profiles profile
    where profile.id = professional_saved_jobs.professional_id
      and profile.user_id = (select auth.uid())
  )
);
