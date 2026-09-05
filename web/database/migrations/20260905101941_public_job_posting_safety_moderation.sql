alter table public.job_postings
  add column moderation_state text not null default 'clear',
  add column moderation_updated_at timestamptz,
  add column moderation_updated_by uuid references public.users(id) on delete set null;
alter table public.job_postings
  add constraint job_postings_moderation_state_check check (moderation_state in ('clear','paused'));
create index job_postings_moderation_updated_by_idx on public.job_postings(moderation_updated_by) where moderation_updated_by is not null;

alter table public.marketplace_moderation_reports
  add column job_posting_id uuid references public.job_postings(id) on delete restrict;
create index marketplace_moderation_reports_job_posting_id_idx on public.marketplace_moderation_reports(job_posting_id) where job_posting_id is not null;

alter table public.marketplace_moderation_reports drop constraint marketplace_moderation_reports_target_type_check;
alter table public.marketplace_moderation_reports
  add constraint marketplace_moderation_reports_target_type_check check (target_type in ('requirement','proposal','conversation','message','portfolio_media','job_posting'));
alter table public.marketplace_moderation_reports drop constraint marketplace_moderation_reports_context_kind_check;
alter table public.marketplace_moderation_reports
  add constraint marketplace_moderation_reports_context_kind_check check (context_kind in ('requirement','job_application','professional_portfolio','job_posting'));
alter table public.marketplace_moderation_reports drop constraint marketplace_moderation_reports_context_check;
alter table public.marketplace_moderation_reports
  add constraint marketplace_moderation_reports_context_check check (
    (context_kind='requirement' and requirement_id is not null and job_application_id is null and job_posting_id is null)
    or (context_kind='job_application' and requirement_id is null and job_application_id is not null and job_posting_id is null and target_type in ('conversation','message'))
    or (context_kind='professional_portfolio' and requirement_id is null and job_application_id is null and job_posting_id is null and target_type='portfolio_media')
    or (context_kind='job_posting' and requirement_id is null and job_application_id is null and job_posting_id is not null and target_type='job_posting')
  );

drop policy job_postings_anon_public_read on public.job_postings;
create policy job_postings_anon_public_read on public.job_postings
for select to anon
using (
  status='open' and moderation_state='clear'
  and (application_deadline is null or application_deadline>=current_date)
  and exists(select 1 from public.businesses business where business.id=job_postings.business_id and business.verified=true)
);

drop policy job_postings_authenticated_read on public.job_postings;
create policy job_postings_authenticated_read on public.job_postings
for select to authenticated
using (
  exists(select 1 from public.businesses business where business.id=job_postings.business_id and business.owner_user_id=(select auth.uid()))
  or (
    status='open' and moderation_state='clear'
    and (application_deadline is null or application_deadline>=current_date)
    and exists(select 1 from public.businesses business where business.id=job_postings.business_id and business.verified=true)
  )
);

drop policy job_postings_owner_insert on public.job_postings;
create policy job_postings_owner_insert on public.job_postings
for insert to authenticated
with check (
  moderation_state='clear' and moderation_updated_at is null and moderation_updated_by is null
  and exists(
    select 1 from public.businesses business
    where business.id=job_postings.business_id
      and business.owner_user_id=(select auth.uid())
      and (job_postings.status<>'open' or business.verified=true)
  )
);

drop policy job_postings_owner_update on public.job_postings;
create policy job_postings_owner_update on public.job_postings
for update to authenticated
using (
  exists(select 1 from public.businesses business where business.id=job_postings.business_id and business.owner_user_id=(select auth.uid()))
)
with check (
  exists(
    select 1 from public.businesses business
    where business.id=job_postings.business_id
      and business.owner_user_id=(select auth.uid())
      and (job_postings.status<>'open' or (business.verified=true and job_postings.moderation_state='clear'))
  )
);

revoke update on table public.job_postings from authenticated;
grant update(title,description,employment_type,workplace_type,location,required_skills,minimum_experience_years,openings,salary_min_minor,salary_max_minor,salary_currency,salary_period,application_deadline,status,updated_at) on public.job_postings to authenticated;

drop policy marketplace_moderation_reports_reporter_read on public.marketplace_moderation_reports;
create policy marketplace_moderation_reports_reporter_read on public.marketplace_moderation_reports
for select to authenticated
using (
  reporter_user_id=(select auth.uid())
  or (context_kind='requirement' and requirement_id is not null and private.marketplace_admin_can_view_requirement(requirement_id))
  or (context_kind='job_application' and job_application_id is not null and private.marketplace_admin_can_view_job())
  or (context_kind='professional_portfolio' and target_type='portfolio_media' and private.marketplace_admin_can_view_job())
  or (context_kind='job_posting' and job_posting_id is not null and target_type='job_posting' and private.marketplace_admin_can_view_job())
);

drop policy marketplace_moderation_report_events_reporter_read on public.marketplace_moderation_report_events;
create policy marketplace_moderation_report_events_reporter_read on public.marketplace_moderation_report_events
for select to authenticated
using (
  exists(
    select 1 from public.marketplace_moderation_reports report
    where report.id=marketplace_moderation_report_events.report_id
      and (
        report.reporter_user_id=(select auth.uid())
        or (report.context_kind='requirement' and report.requirement_id is not null and private.marketplace_admin_can_view_requirement(report.requirement_id))
        or (report.context_kind='job_application' and report.job_application_id is not null and private.marketplace_admin_can_view_job())
        or (report.context_kind='professional_portfolio' and report.target_type='portfolio_media' and private.marketplace_admin_can_view_job())
        or (report.context_kind='job_posting' and report.job_posting_id is not null and report.target_type='job_posting' and private.marketplace_admin_can_view_job())
      )
  )
);

create or replace function public.open_job_posting_moderation_report(
  target_job_posting_id uuid,
  requested_category text,
  requested_details text default null
)
returns public.marketplace_moderation_reports
language plpgsql
security definer
set search_path=''
as $$
declare
  posting_row public.job_postings%rowtype;
  business_row public.businesses%rowtype;
  category_value text:=lower(btrim(coalesce(requested_category,'')));
  details_value text:=nullif(btrim(coalesce(requested_details,'')),'');
  report_row public.marketplace_moderation_reports%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if category_value not in ('spam','harassment','fraud','unsafe','off_platform','inappropriate','other') then raise exception 'Report category is invalid.'; end if;
  if details_value is not null and char_length(details_value)>2000 then raise exception 'Report details must be 2000 characters or fewer.'; end if;

  select * into posting_row from public.job_postings where id=target_job_posting_id;
  if not found then raise exception 'Job posting was not found.'; end if;
  select * into business_row from public.businesses where id=posting_row.business_id;
  if not found or business_row.owner_user_id is null then raise exception 'Job posting business identity is invalid.'; end if;
  if business_row.owner_user_id=auth.uid() then raise exception 'You cannot report your own job posting.'; end if;
  if posting_row.status<>'open'
     or posting_row.moderation_state<>'clear'
     or (posting_row.application_deadline is not null and posting_row.application_deadline<current_date)
     or not business_row.verified
  then raise exception 'Job posting is not currently reportable.'; end if;

  if exists(
    select 1 from public.marketplace_moderation_reports existing
    where existing.reporter_user_id=auth.uid()
      and existing.context_kind='job_posting'
      and existing.target_type='job_posting'
      and existing.target_id=target_job_posting_id
      and existing.status in ('open','reviewing')
  ) then raise exception 'You already have an active report for this item.'; end if;

  insert into public.marketplace_moderation_reports(
    report_reference,reporter_user_id,reported_user_id,context_kind,requirement_id,job_application_id,job_posting_id,
    target_type,target_id,category,details,status
  ) values(
    'MOD-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    auth.uid(),business_row.owner_user_id,'job_posting',null,null,posting_row.id,
    'job_posting',posting_row.id,category_value,details_value,'open'
  ) returning * into report_row;

  insert into public.marketplace_moderation_report_events(report_id,actor_user_id,actor_type,event_type,to_status,note)
  values(report_row.id,auth.uid(),'reporter','opened','open',details_value);
  return report_row;
end;
$$;

create or replace function public.get_job_posting_moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path=''
as $$
declare result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not private.marketplace_admin_can_view_job() then raise exception 'Platform Admin view permission is required for job moderation.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',report.id,
    'report_reference',report.report_reference,
    'context_kind',report.context_kind,
    'target_type',report.target_type,
    'target_id',report.target_id,
    'category',report.category,
    'details',report.details,
    'status',report.status,
    'admin_note',report.admin_note,
    'created_at',report.created_at,
    'updated_at',report.updated_at,
    'resolved_at',report.resolved_at,
    'reporter_name',public.marketplace_safe_display_name(report.reporter_user_id),
    'reported_user_name',public.marketplace_safe_display_name(report.reported_user_id),
    'requirement_id',null,
    'requirement_reference',null,
    'requirement_title',null,
    'proposal_reference',null,
    'job_application_id',null,
    'job_posting_id',posting.id,
    'job_title',posting.title,
    'job_description',posting.description,
    'job_status',posting.status,
    'job_moderation_state',posting.moderation_state,
    'job_moderation_updated_at',posting.moderation_updated_at,
    'application_status',null,
    'business_name',business.name,
    'message_excerpt',null
  ) order by case report.status when 'open' then 0 when 'reviewing' then 1 else 2 end, report.created_at desc),'[]'::jsonb)
  into result_value
  from public.marketplace_moderation_reports report
  join public.job_postings posting on posting.id=report.job_posting_id and posting.id=report.target_id
  join public.businesses business on business.id=posting.business_id
  where report.context_kind='job_posting' and report.target_type='job_posting';

  return result_value;
end;
$$;

create or replace function public.admin_update_job_posting_moderation_report(
  target_report_id uuid,
  requested_status text,
  requested_note text default null
)
returns public.marketplace_moderation_reports
language plpgsql
security definer
set search_path=''
as $$
declare
  report_row public.marketplace_moderation_reports%rowtype;
  old_status text;
  status_value text:=lower(btrim(coalesce(requested_status,'')));
  note_value text:=nullif(btrim(coalesce(requested_note,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if status_value not in ('open','reviewing','actioned','dismissed') then raise exception 'Moderation status is invalid.'; end if;
  if note_value is not null and char_length(note_value)>2000 then raise exception 'Admin note must be 2000 characters or fewer.'; end if;
  if status_value in ('actioned','dismissed') and coalesce(char_length(note_value),0)<3 then raise exception 'A moderation note is required to close a report.'; end if;

  select * into report_row from public.marketplace_moderation_reports where id=target_report_id for update;
  if not found then raise exception 'Moderation report was not found.'; end if;
  if report_row.context_kind<>'job_posting' or report_row.target_type<>'job_posting' or report_row.job_posting_id is null then
    raise exception 'This report does not control a job posting.';
  end if;
  if not private.marketplace_admin_can_manage_job() then raise exception 'Platform Admin manage permission is required for job moderation.'; end if;

  old_status:=report_row.status;
  update public.marketplace_moderation_reports
  set status=status_value,
      handled_by=auth.uid(),
      admin_note=coalesce(note_value,admin_note),
      updated_at=now(),
      resolved_at=case when status_value in ('actioned','dismissed') then now() else null end
  where id=report_row.id
  returning * into report_row;

  insert into public.marketplace_moderation_report_events(report_id,actor_user_id,actor_type,event_type,from_status,to_status,note)
  values(report_row.id,auth.uid(),'admin','status_changed',old_status,status_value,note_value);
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(report_row.reporter_user_id,'moderation_report_updated','Report updated','Your marketplace safety report is now '||replace(status_value,'_',' ')||'.');
  return report_row;
end;
$$;

create or replace function public.admin_set_job_posting_moderation(
  target_report_id uuid,
  requested_state text,
  requested_note text
)
returns public.job_postings
language plpgsql
security definer
set search_path=''
as $$
declare
  report_row public.marketplace_moderation_reports%rowtype;
  posting_row public.job_postings%rowtype;
  business_row public.businesses%rowtype;
  state_value text:=lower(btrim(coalesce(requested_state,'')));
  note_value text:=nullif(btrim(coalesce(requested_note,'')),'');
  old_state text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if state_value not in ('clear','paused') then raise exception 'Job moderation state is invalid.'; end if;
  if coalesce(char_length(note_value),0)<3 or char_length(note_value)>2000 then raise exception 'A moderation note between 3 and 2000 characters is required.'; end if;

  select * into report_row from public.marketplace_moderation_reports where id=target_report_id for update;
  if not found then raise exception 'Moderation report was not found.'; end if;
  if report_row.context_kind<>'job_posting' or report_row.target_type<>'job_posting' or report_row.job_posting_id is null then
    raise exception 'This report does not control a job posting.';
  end if;
  if not private.marketplace_admin_can_manage_job() then raise exception 'Platform Admin manage permission is required for job enforcement.'; end if;

  select * into posting_row from public.job_postings where id=report_row.job_posting_id and id=report_row.target_id for update;
  if not found then raise exception 'Reported job posting was not found.'; end if;
  select * into business_row from public.businesses where id=posting_row.business_id;
  if not found or business_row.owner_user_id is null then raise exception 'Job posting business identity is invalid.'; end if;

  old_state:=posting_row.moderation_state;
  if old_state=state_value then return posting_row; end if;

  update public.job_postings
  set moderation_state=state_value,
      status=case when state_value='paused' then 'draft' else status end,
      moderation_updated_at=now(),
      moderation_updated_by=auth.uid(),
      updated_at=now()
  where id=posting_row.id
  returning * into posting_row;

  insert into public.marketplace_moderation_report_events(report_id,actor_user_id,actor_type,event_type,from_status,to_status,note)
  values(report_row.id,auth.uid(),'admin','content_action',old_state,state_value,note_value);
  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(
    business_row.owner_user_id,'moderation_report_updated',
    case when state_value='paused' then 'Job posting paused' else 'Job posting restored' end,
    case when state_value='paused'
      then 'TakeItEsee moderation paused one of your job postings. It is no longer public.'
      else 'TakeItEsee moderation restored one of your job postings. It remains private until you choose to publish it again.' end,
    '/provider/jobs'
  );
  return posting_row;
end;
$$;

revoke all on function public.open_job_posting_moderation_report(uuid,text,text) from public, anon;
revoke all on function public.get_job_posting_moderation_queue() from public, anon;
revoke all on function public.admin_update_job_posting_moderation_report(uuid,text,text) from public, anon;
revoke all on function public.admin_set_job_posting_moderation(uuid,text,text) from public, anon;
grant execute on function public.open_job_posting_moderation_report(uuid,text,text) to authenticated;
grant execute on function public.get_job_posting_moderation_queue() to authenticated;
grant execute on function public.admin_update_job_posting_moderation_report(uuid,text,text) to authenticated;
grant execute on function public.admin_set_job_posting_moderation(uuid,text,text) to authenticated;
