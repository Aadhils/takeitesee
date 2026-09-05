-- Extend the existing marketplace safety ledger to verified public Professional portfolio media.
-- Portfolio moderation reuses platform-scope Admin authority and never auto-mutates media.

alter table public.marketplace_moderation_reports
  drop constraint if exists marketplace_moderation_reports_context_kind_check;
alter table public.marketplace_moderation_reports
  add constraint marketplace_moderation_reports_context_kind_check
  check (context_kind in ('requirement','job_application','professional_portfolio'));

alter table public.marketplace_moderation_reports
  drop constraint if exists marketplace_moderation_reports_target_type_check;
alter table public.marketplace_moderation_reports
  add constraint marketplace_moderation_reports_target_type_check
  check (target_type in ('requirement','proposal','conversation','message','portfolio_media'));

alter table public.marketplace_moderation_reports
  drop constraint if exists marketplace_moderation_reports_context_check;
alter table public.marketplace_moderation_reports
  add constraint marketplace_moderation_reports_context_check
  check (
    (context_kind='requirement' and requirement_id is not null and job_application_id is null)
    or
    (context_kind='job_application' and requirement_id is null and job_application_id is not null and target_type in ('conversation','message'))
    or
    (context_kind='professional_portfolio' and requirement_id is null and job_application_id is null and target_type='portfolio_media')
  );

comment on column public.marketplace_moderation_reports.context_kind is
  'Safety context: requirement, job_application, or professional_portfolio.';

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
  or (
    context_kind='professional_portfolio'
    and target_type='portfolio_media'
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
        or (
          report.context_kind='professional_portfolio'
          and report.target_type='portfolio_media'
          and private.marketplace_admin_can_view_job()
        )
      )
  )
);

create or replace function public.open_marketplace_moderation_report(
  requested_target_type text,
  requested_target_id uuid,
  requested_category text,
  requested_details text default null
)
returns public.marketplace_moderation_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  target_type_value text:=lower(btrim(coalesce(requested_target_type,'')));
  category_value text:=lower(btrim(coalesce(requested_category,'')));
  details_value text:=nullif(btrim(coalesce(requested_details,'')),'');
  context_value text:='requirement';
  requirement_uuid uuid;
  job_application_uuid uuid;
  reported_uuid uuid;
  conversation_row public.marketplace_conversations%rowtype;
  proposal_row public.requirement_proposals%rowtype;
  message_row public.marketplace_messages%rowtype;
  requirement_row public.customer_requirements%rowtype;
  portfolio_row public.professional_portfolio_media%rowtype;
  professional_row public.professional_profiles%rowtype;
  report_row public.marketplace_moderation_reports%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if target_type_value not in ('requirement','proposal','conversation','message','portfolio_media') then raise exception 'Report target is invalid.'; end if;
  if category_value not in ('spam','harassment','fraud','unsafe','off_platform','inappropriate','other') then raise exception 'Report category is invalid.'; end if;
  if details_value is not null and char_length(details_value)>2000 then raise exception 'Report details must be 2000 characters or fewer.'; end if;

  if target_type_value='portfolio_media' then
    select * into portfolio_row
    from public.professional_portfolio_media
    where id=requested_target_id;
    if not found then raise exception 'Portfolio media was not found.'; end if;

    select * into professional_row
    from public.professional_profiles
    where id=portfolio_row.professional_id;
    if not found or professional_row.user_id is null then raise exception 'Portfolio professional identity is invalid.'; end if;
    if professional_row.user_id=auth.uid() then raise exception 'You cannot report your own portfolio media.'; end if;

    if not portfolio_row.active
      or not professional_row.verified
      or nullif(btrim(coalesce(professional_row.legal_name,'')),'') is null
      or nullif(btrim(coalesce(professional_row.principal_address,'')),'') is null
      or nullif(btrim(coalesce(professional_row.public_contact_email,'')),'') is null
      or nullif(btrim(coalesce(professional_row.public_contact_phone,'')),'') is null
      or nullif(btrim(coalesce(professional_row.grievance_officer_name,'')),'') is null
      or nullif(btrim(coalesce(professional_row.grievance_officer_designation,'')),'') is null
      or nullif(btrim(coalesce(professional_row.grievance_email,'')),'') is null
      or nullif(btrim(coalesce(professional_row.grievance_phone,'')),'') is null
    then
      raise exception 'Portfolio media is not currently reportable.';
    end if;

    if portfolio_row.professional_role_id is not null and not exists (
      select 1
      from public.professional_roles role
      where role.id=portfolio_row.professional_role_id
        and role.professional_id=portfolio_row.professional_id
        and role.active=true
    ) then
      raise exception 'Portfolio media is not currently reportable.';
    end if;

    context_value:='professional_portfolio';
    reported_uuid:=professional_row.user_id;
  elsif target_type_value='conversation' then
    select * into conversation_row from public.marketplace_conversations where id=requested_target_id;
    if not found or auth.uid() not in (conversation_row.customer_id,conversation_row.provider_user_id) then
      raise exception 'Conversation is not reportable by this user.';
    end if;
    reported_uuid:=case when auth.uid()=conversation_row.customer_id then conversation_row.provider_user_id else conversation_row.customer_id end;
    if conversation_row.conversation_kind='job_application' then
      context_value:='job_application';
      job_application_uuid:=conversation_row.job_application_id;
      if job_application_uuid is null then raise exception 'Job conversation context is invalid.'; end if;
    else
      context_value:='requirement';
      requirement_uuid:=conversation_row.requirement_id;
      if requirement_uuid is null then raise exception 'Requirement conversation context is invalid.'; end if;
    end if;
  elsif target_type_value='message' then
    select * into message_row from public.marketplace_messages where id=requested_target_id;
    if not found then raise exception 'Message was not found.'; end if;
    select * into conversation_row from public.marketplace_conversations where id=message_row.conversation_id;
    if not found or auth.uid() not in (conversation_row.customer_id,conversation_row.provider_user_id) then
      raise exception 'Message is not reportable by this user.';
    end if;
    if message_row.sender_user_id=auth.uid() then raise exception 'You cannot report your own message.'; end if;
    reported_uuid:=message_row.sender_user_id;
    if conversation_row.conversation_kind='job_application' then
      context_value:='job_application';
      job_application_uuid:=conversation_row.job_application_id;
      if job_application_uuid is null then raise exception 'Job conversation context is invalid.'; end if;
    else
      context_value:='requirement';
      requirement_uuid:=conversation_row.requirement_id;
      if requirement_uuid is null then raise exception 'Requirement conversation context is invalid.'; end if;
    end if;
  elsif target_type_value='proposal' then
    select * into proposal_row from public.requirement_proposals where id=requested_target_id;
    if not found then raise exception 'Proposal was not found.'; end if;
    select * into requirement_row from public.customer_requirements where id=proposal_row.requirement_id;
    if not found or requirement_row.customer_id<>auth.uid() then raise exception 'Only the requirement owner can report this proposal.'; end if;
    context_value:='requirement';
    requirement_uuid:=requirement_row.id;
    reported_uuid:=proposal_row.provider_user_id;
  else
    select * into requirement_row from public.customer_requirements where id=requested_target_id;
    if not found then raise exception 'Requirement was not found.'; end if;
    if requirement_row.customer_id=auth.uid() then raise exception 'You cannot report your own requirement.'; end if;
    if not exists(
      select 1 from public.requirement_proposals proposal
      where proposal.requirement_id=requirement_row.id and proposal.provider_user_id=auth.uid()
    ) then
      raise exception 'Only a provider participating in this requirement can report it.';
    end if;
    context_value:='requirement';
    requirement_uuid:=requirement_row.id;
    reported_uuid:=requirement_row.customer_id;
  end if;

  if exists(
    select 1 from public.marketplace_moderation_reports existing
    where existing.reporter_user_id=auth.uid()
      and existing.target_type=target_type_value
      and existing.target_id=requested_target_id
      and existing.status in ('open','reviewing')
  ) then
    raise exception 'You already have an active report for this item.';
  end if;

  insert into public.marketplace_moderation_reports(
    report_reference,reporter_user_id,reported_user_id,context_kind,requirement_id,job_application_id,
    target_type,target_id,category,details,status
  ) values (
    'MOD-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    auth.uid(),reported_uuid,context_value,requirement_uuid,job_application_uuid,
    target_type_value,requested_target_id,category_value,details_value,'open'
  ) returning * into report_row;

  insert into public.marketplace_moderation_report_events(report_id,actor_user_id,actor_type,event_type,to_status,note)
  values(report_row.id,auth.uid(),'reporter','opened','open',details_value);

  return report_row;
end;
$$;

revoke all on function public.open_marketplace_moderation_report(text,uuid,text,text) from public,anon,authenticated;
grant execute on function public.open_marketplace_moderation_report(text,uuid,text,text) to authenticated,service_role;

create or replace function public.get_marketplace_moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

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
    'reported_user_name',case when report.reported_user_id is null then null else public.marketplace_safe_display_name(report.reported_user_id) end,
    'requirement_id',requirement.id,
    'requirement_reference',requirement.requirement_reference,
    'requirement_title',requirement.title,
    'proposal_reference',case when report.target_type='proposal' then proposal.proposal_reference else null end,
    'job_application_id',application.id,
    'job_posting_id',posting.id,
    'job_title',posting.title,
    'application_status',application.status,
    'business_name',business.name,
    'message_excerpt',case when report.target_type='message' then left(message.body,240) else null end,
    'professional_id',portfolio_professional.id,
    'professional_name',portfolio_professional.headline,
    'portfolio_caption',case when report.target_type='portfolio_media' then portfolio_media.caption else null end,
    'portfolio_media_type',case when report.target_type='portfolio_media' then portfolio_media.media_type else null end
  ) order by case report.status when 'open' then 0 when 'reviewing' then 1 else 2 end,report.created_at desc),'[]'::jsonb)
  into result_value
  from public.marketplace_moderation_reports report
  left join public.customer_requirements requirement on requirement.id=report.requirement_id
  left join public.requirement_proposals proposal on proposal.id=case when report.target_type='proposal' then report.target_id else null end
  left join public.marketplace_messages message on message.id=case when report.target_type='message' then report.target_id else null end
  left join public.job_applications application on application.id=report.job_application_id
  left join public.job_postings posting on posting.id=application.job_posting_id
  left join public.businesses business on business.id=posting.business_id
  left join public.professional_portfolio_media portfolio_media on portfolio_media.id=case when report.target_type='portfolio_media' then report.target_id else null end
  left join public.professional_profiles portfolio_professional on portfolio_professional.id=portfolio_media.professional_id
  where (
    report.context_kind='requirement'
    and report.requirement_id is not null
    and private.marketplace_admin_can_view_requirement(report.requirement_id)
  ) or (
    report.context_kind='job_application'
    and report.job_application_id is not null
    and private.marketplace_admin_can_view_job()
  ) or (
    report.context_kind='professional_portfolio'
    and report.target_type='portfolio_media'
    and private.marketplace_admin_can_view_job()
  );

  return result_value;
end;
$$;

revoke all on function public.get_marketplace_moderation_queue() from public,anon,authenticated;
grant execute on function public.get_marketplace_moderation_queue() to authenticated,service_role;

create or replace function public.admin_update_marketplace_moderation_report(
  target_report_id uuid,
  requested_status text,
  requested_note text default null
)
returns public.marketplace_moderation_reports
language plpgsql
security definer
set search_path = ''
as $$
declare
  report_row public.marketplace_moderation_reports%rowtype;
  old_status text;
  status_value text:=lower(btrim(coalesce(requested_status,'')));
  note_value text:=nullif(btrim(coalesce(requested_note,'')),'');
  can_manage boolean:=false;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if status_value not in ('open','reviewing','actioned','dismissed') then raise exception 'Moderation status is invalid.'; end if;
  if note_value is not null and char_length(note_value)>2000 then raise exception 'Admin note must be 2000 characters or fewer.'; end if;
  if status_value in ('actioned','dismissed') and coalesce(char_length(note_value),0)<3 then raise exception 'A moderation note is required to close a report.'; end if;

  select * into report_row
  from public.marketplace_moderation_reports
  where id=target_report_id
  for update;
  if not found then raise exception 'Moderation report was not found.'; end if;

  if report_row.context_kind='requirement' and report_row.requirement_id is not null then
    can_manage:=private.marketplace_admin_can_manage_requirement(report_row.requirement_id);
  elsif report_row.context_kind='job_application' and report_row.job_application_id is not null then
    can_manage:=private.marketplace_admin_can_manage_job();
  elsif report_row.context_kind='professional_portfolio' and report_row.target_type='portfolio_media' then
    can_manage:=private.marketplace_admin_can_manage_job();
  end if;
  if not can_manage then raise exception 'Admin manage permission is required for this report.'; end if;

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

revoke all on function public.admin_update_marketplace_moderation_report(uuid,text,text) from public,anon,authenticated;
grant execute on function public.admin_update_marketplace_moderation_report(uuid,text,text) to authenticated,service_role;
