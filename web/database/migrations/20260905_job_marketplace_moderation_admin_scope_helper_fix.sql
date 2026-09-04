-- Correct #246 job moderation RLS to follow the existing private-helper pattern.
-- public.admin_can_view(...) is intentionally not executable by authenticated users,
-- so row policies must call an authenticated-executable helper in the private schema.

create or replace function private.marketplace_admin_can_view_job()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.admin_can_view(null,null,null,null);
$$;

create or replace function private.marketplace_admin_can_manage_job()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.admin_can_manage(null,null,null,null);
$$;

revoke all on function private.marketplace_admin_can_view_job() from public,anon;
revoke all on function private.marketplace_admin_can_manage_job() from public,anon;
grant execute on function private.marketplace_admin_can_view_job() to authenticated,service_role;
grant execute on function private.marketplace_admin_can_manage_job() to authenticated,service_role;

drop policy if exists marketplace_moderation_reports_reporter_read on public.marketplace_moderation_reports;
create policy marketplace_moderation_reports_reporter_read
on public.marketplace_moderation_reports for select to authenticated
using (
  reporter_user_id=(select auth.uid())
  or (
    context_kind='requirement'
    and requirement_id is not null
    and private.marketplace_admin_can_view_requirement(requirement_id)
  )
  or (
    context_kind='job_application'
    and job_application_id is not null
    and private.marketplace_admin_can_view_job()
  )
);

drop policy if exists marketplace_moderation_report_events_reporter_read on public.marketplace_moderation_report_events;
create policy marketplace_moderation_report_events_reporter_read
on public.marketplace_moderation_report_events for select to authenticated
using (
  exists (
    select 1
    from public.marketplace_moderation_reports report
    where report.id=marketplace_moderation_report_events.report_id
      and (
        report.reporter_user_id=(select auth.uid())
        or (
          report.context_kind='requirement'
          and report.requirement_id is not null
          and private.marketplace_admin_can_view_requirement(report.requirement_id)
        )
        or (
          report.context_kind='job_application'
          and report.job_application_id is not null
          and private.marketplace_admin_can_view_job()
        )
      )
  )
);
