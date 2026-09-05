create or replace function public.validate_job_posting_application_integrity()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $fn$
begin
  if tg_op = 'DELETE' then
    if exists (
      select 1 from public.job_applications application
      where application.job_posting_id = old.id
    ) then
      raise exception 'Job posting cannot be deleted after applications exist.';
    end if;
    return old;
  end if;

  if new.business_id is distinct from old.business_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Job posting identity is immutable.';
  end if;

  if exists (
    select 1 from public.job_applications application
    where application.job_posting_id = old.id
  ) and (
    new.title is distinct from old.title
    or new.description is distinct from old.description
    or new.employment_type is distinct from old.employment_type
    or new.workplace_type is distinct from old.workplace_type
    or new.location is distinct from old.location
    or new.required_skills is distinct from old.required_skills
    or new.minimum_experience_years is distinct from old.minimum_experience_years
    or new.openings is distinct from old.openings
    or new.salary_min_minor is distinct from old.salary_min_minor
    or new.salary_max_minor is distinct from old.salary_max_minor
    or new.salary_currency is distinct from old.salary_currency
    or new.salary_period is distinct from old.salary_period
    or new.application_deadline is distinct from old.application_deadline
  ) then
    raise exception 'Job posting terms are locked after the first application.';
  end if;

  new.updated_at := now();
  return new;
end;
$fn$;

revoke all on function public.validate_job_posting_application_integrity() from public, anon, authenticated;

drop trigger if exists job_postings_application_integrity on public.job_postings;
create trigger job_postings_application_integrity
before update or delete on public.job_postings
for each row execute function public.validate_job_posting_application_integrity();

comment on function public.validate_job_posting_application_integrity() is
  'Preserves applicant-facing job terms and downstream hiring evidence once the first application exists.';
