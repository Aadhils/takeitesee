-- Account safety reports: expose reporter-owned moderation status safely.
--
-- Authenticated users previously had direct SELECT on the moderation report/event
-- tables. Reporter RLS limited rows, but direct table reads still exposed internal
-- moderation columns such as admin_note and handled_by on the reporter's own row.
-- Replace that broad table access with a narrowly-scoped self-service RPC that
-- returns only reporter-safe fields and redacted status history.
--
-- No moderation state-machine, Admin scope, enforcement, Provider identity,
-- booking, recurrence, payment, payout, settlement, refund or recovery behavior.

revoke select on table public.marketplace_moderation_reports from authenticated;
revoke select on table public.marketplace_moderation_report_events from authenticated;

create or replace function public.get_my_marketplace_moderation_reports()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id', report.id,
    'report_reference', report.report_reference,
    'context_kind', report.context_kind,
    'target_type', report.target_type,
    'category', report.category,
    'details', report.details,
    'status', report.status,
    'created_at', report.created_at,
    'updated_at', report.updated_at,
    'resolved_at', report.resolved_at,
    'context_label', case
      when report.context_kind='requirement' then coalesce(requirement.title, 'Service marketplace')
      when report.context_kind='job_application' then coalesce(application_posting.title, 'Job application')
      when report.context_kind='job_posting' then coalesce(job_posting.title, 'Job posting')
      when report.context_kind='professional_portfolio' then 'Professional portfolio'
      else 'Marketplace safety report'
    end,
    'events', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_type', event.event_type,
        'from_status', event.from_status,
        'to_status', event.to_status,
        'created_at', event.created_at
      ) order by event.created_at)
      from public.marketplace_moderation_report_events event
      where event.report_id=report.id
    ), '[]'::jsonb)
  ) order by report.created_at desc), '[]'::jsonb)
  into result_value
  from public.marketplace_moderation_reports report
  left join public.customer_requirements requirement on requirement.id=report.requirement_id
  left join public.job_applications application on application.id=report.job_application_id
  left join public.job_postings application_posting on application_posting.id=application.job_posting_id
  left join public.job_postings job_posting on job_posting.id=report.job_posting_id
  where report.reporter_user_id=auth.uid();

  return result_value;
end;
$$;

revoke all on function public.get_my_marketplace_moderation_reports() from public,anon,authenticated;
grant execute on function public.get_my_marketplace_moderation_reports() to authenticated,service_role;

create or replace function public.resolve_moderation_report_notification_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.target_path is null and new.event_type='moderation_report_updated' then
    new.target_path := '/account/reports';
  end if;
  return new;
end;
$$;

revoke all on function public.resolve_moderation_report_notification_target() from public,anon,authenticated;
grant execute on function public.resolve_moderation_report_notification_target() to postgres,service_role;

drop trigger if exists notifications_moderation_report_target on public.notifications;
create trigger notifications_moderation_report_target
before insert on public.notifications
for each row execute function public.resolve_moderation_report_notification_target();
