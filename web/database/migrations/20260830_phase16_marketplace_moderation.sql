-- Phase 16 Module 5: marketplace reporting, participant blocking and scoped admin moderation.

create table if not exists public.marketplace_user_blocks (
  id uuid primary key default gen_random_uuid(),
  blocker_user_id uuid not null references public.users(id) on delete cascade,
  blocked_user_id uuid not null references public.users(id) on delete cascade,
  conversation_id uuid not null references public.marketplace_conversations(id) on delete cascade,
  reason text,
  created_at timestamptz not null default now(),
  unique(blocker_user_id, blocked_user_id, conversation_id),
  check (blocker_user_id <> blocked_user_id),
  check (reason is null or char_length(reason) <= 500)
);

create index if not exists marketplace_user_blocks_conversation_idx
  on public.marketplace_user_blocks(conversation_id, created_at desc);

alter table public.marketplace_user_blocks enable row level security;
revoke all on public.marketplace_user_blocks from anon;
revoke insert,update,delete on public.marketplace_user_blocks from authenticated;
grant select on public.marketplace_user_blocks to authenticated;
grant select,insert,update,delete on public.marketplace_user_blocks to service_role;

drop policy if exists marketplace_user_blocks_own_read on public.marketplace_user_blocks;
create policy marketplace_user_blocks_own_read on public.marketplace_user_blocks
for select to authenticated using (blocker_user_id=auth.uid());

create table if not exists public.marketplace_moderation_reports (
  id uuid primary key default gen_random_uuid(),
  report_reference text not null unique,
  reporter_user_id uuid not null references public.users(id) on delete restrict,
  reported_user_id uuid references public.users(id) on delete restrict,
  requirement_id uuid not null references public.customer_requirements(id) on delete restrict,
  target_type text not null check (target_type in ('requirement','proposal','conversation','message')),
  target_id uuid not null,
  category text not null check (category in ('spam','harassment','fraud','unsafe','off_platform','inappropriate','other')),
  details text,
  status text not null default 'open' check (status in ('open','reviewing','actioned','dismissed')),
  handled_by uuid references public.users(id) on delete set null,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  check (details is null or char_length(details) <= 2000),
  check (admin_note is null or char_length(admin_note) <= 2000),
  check (((status in ('open','reviewing')) and resolved_at is null) or ((status in ('actioned','dismissed')) and resolved_at is not null))
);

create unique index if not exists marketplace_moderation_reports_one_active_target_idx
  on public.marketplace_moderation_reports(reporter_user_id,target_type,target_id)
  where status in ('open','reviewing');
create index if not exists marketplace_moderation_reports_queue_idx
  on public.marketplace_moderation_reports(status,created_at desc);
create index if not exists marketplace_moderation_reports_requirement_idx
  on public.marketplace_moderation_reports(requirement_id,created_at desc);

create table if not exists public.marketplace_moderation_report_events (
  id uuid primary key default gen_random_uuid(),
  report_id uuid not null references public.marketplace_moderation_reports(id) on delete cascade,
  actor_user_id uuid references public.users(id) on delete set null,
  actor_type text not null check (actor_type in ('reporter','admin','system')),
  event_type text not null check (event_type in ('opened','status_changed','note')),
  from_status text,
  to_status text,
  note text,
  created_at timestamptz not null default now(),
  check (note is null or char_length(note) <= 2000)
);
create index if not exists marketplace_moderation_report_events_report_idx
  on public.marketplace_moderation_report_events(report_id,created_at);

alter table public.marketplace_moderation_reports enable row level security;
alter table public.marketplace_moderation_report_events enable row level security;
revoke all on public.marketplace_moderation_reports,public.marketplace_moderation_report_events from anon;
revoke insert,update,delete on public.marketplace_moderation_reports,public.marketplace_moderation_report_events from authenticated;
grant select on public.marketplace_moderation_reports,public.marketplace_moderation_report_events to authenticated;
grant select,insert,update,delete on public.marketplace_moderation_reports,public.marketplace_moderation_report_events to service_role;

create or replace function public.marketplace_admin_can_view_requirement(target_requirement_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.customer_requirements r
    where r.id=target_requirement_id
      and (public.is_super_admin() or public.admin_can_view(null,r.location_id,r.category_id,null))
  );
$$;
revoke all on function public.marketplace_admin_can_view_requirement(uuid) from public,anon;
grant execute on function public.marketplace_admin_can_view_requirement(uuid) to authenticated;

create or replace function public.marketplace_admin_can_manage_requirement(target_requirement_id uuid)
returns boolean
language sql
stable
security definer
set search_path=public,pg_temp
as $$
  select exists(
    select 1 from public.customer_requirements r
    where r.id=target_requirement_id
      and (public.is_super_admin() or public.admin_can_manage(null,r.location_id,r.category_id,null))
  );
$$;
revoke all on function public.marketplace_admin_can_manage_requirement(uuid) from public,anon;
grant execute on function public.marketplace_admin_can_manage_requirement(uuid) to authenticated;

drop policy if exists marketplace_moderation_reports_reporter_read on public.marketplace_moderation_reports;
create policy marketplace_moderation_reports_reporter_read on public.marketplace_moderation_reports
for select to authenticated using (
  reporter_user_id=auth.uid() or public.marketplace_admin_can_view_requirement(requirement_id)
);

drop policy if exists marketplace_moderation_report_events_reporter_read on public.marketplace_moderation_report_events;
create policy marketplace_moderation_report_events_reporter_read on public.marketplace_moderation_report_events
for select to authenticated using (
  exists(
    select 1 from public.marketplace_moderation_reports r
    where r.id=marketplace_moderation_report_events.report_id
      and (r.reporter_user_id=auth.uid() or public.marketplace_admin_can_view_requirement(r.requirement_id))
  )
);

create or replace function public.set_marketplace_conversation_block(
  target_conversation_id uuid,
  should_block boolean,
  block_reason text default null
)
returns boolean
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  c public.marketplace_conversations%rowtype;
  counterpart_id uuid;
  reason_value text:=nullif(btrim(coalesce(block_reason,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if reason_value is not null and char_length(reason_value)>500 then raise exception 'Block reason must be 500 characters or fewer.'; end if;
  select * into c from public.marketplace_conversations where id=target_conversation_id;
  if not found then raise exception 'Conversation was not found.'; end if;
  if auth.uid() not in (c.customer_id,c.provider_user_id) then raise exception 'You are not a participant in this conversation.'; end if;
  counterpart_id:=case when auth.uid()=c.customer_id then c.provider_user_id else c.customer_id end;
  if should_block then
    insert into public.marketplace_user_blocks(blocker_user_id,blocked_user_id,conversation_id,reason)
    values(auth.uid(),counterpart_id,c.id,reason_value)
    on conflict(blocker_user_id,blocked_user_id,conversation_id) do update set reason=excluded.reason;
  else
    delete from public.marketplace_user_blocks
    where blocker_user_id=auth.uid() and blocked_user_id=counterpart_id and conversation_id=c.id;
  end if;
  return should_block;
end;
$$;
revoke all on function public.set_marketplace_conversation_block(uuid,boolean,text) from public,anon;
grant execute on function public.set_marketplace_conversation_block(uuid,boolean,text) to authenticated;

create or replace function public.open_marketplace_moderation_report(
  requested_target_type text,
  requested_target_id uuid,
  requested_category text,
  requested_details text default null
)
returns public.marketplace_moderation_reports
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  target_type_value text:=lower(btrim(coalesce(requested_target_type,'')));
  category_value text:=lower(btrim(coalesce(requested_category,'')));
  details_value text:=nullif(btrim(coalesce(requested_details,'')),'');
  requirement_uuid uuid;
  reported_uuid uuid;
  conversation_row public.marketplace_conversations%rowtype;
  proposal_row public.requirement_proposals%rowtype;
  message_row public.marketplace_messages%rowtype;
  requirement_row public.customer_requirements%rowtype;
  report_row public.marketplace_moderation_reports%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if target_type_value not in ('requirement','proposal','conversation','message') then raise exception 'Report target is invalid.'; end if;
  if category_value not in ('spam','harassment','fraud','unsafe','off_platform','inappropriate','other') then raise exception 'Report category is invalid.'; end if;
  if details_value is not null and char_length(details_value)>2000 then raise exception 'Report details must be 2000 characters or fewer.'; end if;

  if target_type_value='conversation' then
    select * into conversation_row from public.marketplace_conversations where id=requested_target_id;
    if not found or auth.uid() not in (conversation_row.customer_id,conversation_row.provider_user_id) then raise exception 'Conversation is not reportable by this user.'; end if;
    requirement_uuid:=conversation_row.requirement_id;
    reported_uuid:=case when auth.uid()=conversation_row.customer_id then conversation_row.provider_user_id else conversation_row.customer_id end;
  elsif target_type_value='message' then
    select * into message_row from public.marketplace_messages where id=requested_target_id;
    if not found then raise exception 'Message was not found.'; end if;
    select * into conversation_row from public.marketplace_conversations where id=message_row.conversation_id;
    if not found or auth.uid() not in (conversation_row.customer_id,conversation_row.provider_user_id) then raise exception 'Message is not reportable by this user.'; end if;
    if message_row.sender_user_id=auth.uid() then raise exception 'You cannot report your own message.'; end if;
    requirement_uuid:=conversation_row.requirement_id;
    reported_uuid:=message_row.sender_user_id;
  elsif target_type_value='proposal' then
    select * into proposal_row from public.requirement_proposals where id=requested_target_id;
    if not found then raise exception 'Proposal was not found.'; end if;
    select * into requirement_row from public.customer_requirements where id=proposal_row.requirement_id;
    if not found or requirement_row.customer_id<>auth.uid() then raise exception 'Only the requirement owner can report this proposal.'; end if;
    requirement_uuid:=requirement_row.id;
    reported_uuid:=proposal_row.provider_user_id;
  else
    select * into requirement_row from public.customer_requirements where id=requested_target_id;
    if not found then raise exception 'Requirement was not found.'; end if;
    if requirement_row.customer_id=auth.uid() then raise exception 'You cannot report your own requirement.'; end if;
    if not exists(select 1 from public.requirement_proposals p where p.requirement_id=requirement_row.id and p.provider_user_id=auth.uid()) then
      raise exception 'Only a provider participating in this requirement can report it.';
    end if;
    requirement_uuid:=requirement_row.id;
    reported_uuid:=requirement_row.customer_id;
  end if;

  if exists(select 1 from public.marketplace_moderation_reports r where r.reporter_user_id=auth.uid() and r.target_type=target_type_value and r.target_id=requested_target_id and r.status in ('open','reviewing')) then
    raise exception 'You already have an active report for this item.';
  end if;

  insert into public.marketplace_moderation_reports(
    report_reference,reporter_user_id,reported_user_id,requirement_id,target_type,target_id,category,details,status
  ) values (
    'MOD-'||to_char(current_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    auth.uid(),reported_uuid,requirement_uuid,target_type_value,requested_target_id,category_value,details_value,'open'
  ) returning * into report_row;

  insert into public.marketplace_moderation_report_events(report_id,actor_user_id,actor_type,event_type,to_status,note)
  values(report_row.id,auth.uid(),'reporter','opened','open',details_value);

  return report_row;
end;
$$;
revoke all on function public.open_marketplace_moderation_report(text,uuid,text,text) from public,anon;
grant execute on function public.open_marketplace_moderation_report(text,uuid,text,text) to authenticated;

create or replace function public.get_marketplace_moderation_queue()
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id',mr.id,'report_reference',mr.report_reference,'target_type',mr.target_type,'target_id',mr.target_id,
    'category',mr.category,'details',mr.details,'status',mr.status,'admin_note',mr.admin_note,
    'created_at',mr.created_at,'updated_at',mr.updated_at,'resolved_at',mr.resolved_at,
    'reporter_name',public.marketplace_safe_display_name(mr.reporter_user_id),
    'reported_user_name',case when mr.reported_user_id is null then null else public.marketplace_safe_display_name(mr.reported_user_id) end,
    'requirement_id',req.id,'requirement_reference',req.requirement_reference,'requirement_title',req.title,
    'proposal_reference',case when mr.target_type='proposal' then prop.proposal_reference else null end,
    'message_excerpt',case when mr.target_type='message' then left(msg.body,240) else null end
  ) order by case mr.status when 'open' then 0 when 'reviewing' then 1 else 2 end,mr.created_at desc),'[]'::jsonb)
  into result_value
  from public.marketplace_moderation_reports mr
  join public.customer_requirements req on req.id=mr.requirement_id
  left join public.requirement_proposals prop on prop.id=case when mr.target_type='proposal' then mr.target_id else null end
  left join public.marketplace_messages msg on msg.id=case when mr.target_type='message' then mr.target_id else null end
  where public.marketplace_admin_can_view_requirement(mr.requirement_id);
  return result_value;
end;
$$;
revoke all on function public.get_marketplace_moderation_queue() from public,anon;
grant execute on function public.get_marketplace_moderation_queue() to authenticated;

create or replace function public.admin_update_marketplace_moderation_report(
  target_report_id uuid,
  requested_status text,
  requested_note text default null
)
returns public.marketplace_moderation_reports
language plpgsql
security definer
set search_path=public,pg_temp
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
  if not public.marketplace_admin_can_manage_requirement(report_row.requirement_id) then raise exception 'Admin manage permission is required for this report.'; end if;
  old_status:=report_row.status;
  update public.marketplace_moderation_reports
  set status=status_value,handled_by=auth.uid(),admin_note=coalesce(note_value,admin_note),updated_at=now(),
      resolved_at=case when status_value in ('actioned','dismissed') then now() else null end
  where id=report_row.id returning * into report_row;
  insert into public.marketplace_moderation_report_events(report_id,actor_user_id,actor_type,event_type,from_status,to_status,note)
  values(report_row.id,auth.uid(),'admin','status_changed',old_status,status_value,note_value);
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(report_row.reporter_user_id,'moderation_report_updated','Report updated','Your marketplace safety report is now '||replace(status_value,'_',' ')||'.');
  return report_row;
end;
$$;
revoke all on function public.admin_update_marketplace_moderation_report(uuid,text,text) from public,anon;
grant execute on function public.admin_update_marketplace_moderation_report(uuid,text,text) to authenticated;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check
check (event_type = any (array[
  'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
  'reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded',
  'review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
  'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
  'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
  'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected',
  'provider_reverification_required','provider_suspended','provider_restored','provider_payout_prepared','provider_payout_cancelled','provider_payout_processing','provider_payout_paid','provider_payout_failed','provider_payout_reversed','provider_payout_destination_updated',
  'refund_requested','refund_onhold','refund_failed','refund_cancelled','payment_dispute_opened','payment_dispute_resolved','provider_finance_hold','provider_recovery_required','provider_recovery_resolved',
  'requirement_chat_opened','message_received','moderation_report_updated'
]::text[]));

create or replace function public.send_marketplace_message(
  target_conversation_id uuid,
  requested_idempotency_key text,
  requested_body text
)
returns public.marketplace_messages
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  c public.marketplace_conversations%rowtype;
  r public.customer_requirements%rowtype;
  row_value public.marketplace_messages%rowtype;
  body_value text:=btrim(coalesce(requested_body,''));
  key_value text:=btrim(coalesce(requested_idempotency_key,''));
  recipient_id uuid;
  sender_name text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if char_length(key_value)<8 or char_length(key_value)>120 then raise exception 'Message idempotency key must be 8 to 120 characters.'; end if;
  if char_length(body_value)<1 or char_length(body_value)>2000 then raise exception 'Message must be 1 to 2000 characters.'; end if;
  select * into c from public.marketplace_conversations where id=target_conversation_id for update;
  if not found then raise exception 'Conversation was not found.'; end if;
  if auth.uid() not in (c.customer_id,c.provider_user_id) then raise exception 'You are not a participant in this conversation.'; end if;
  if c.status<>'open' then raise exception 'This conversation is read-only.'; end if;
  if exists(select 1 from public.marketplace_user_blocks b where b.conversation_id=c.id and ((b.blocker_user_id=c.customer_id and b.blocked_user_id=c.provider_user_id) or (b.blocker_user_id=c.provider_user_id and b.blocked_user_id=c.customer_id))) then
    raise exception 'Messaging is blocked for this conversation.';
  end if;
  select * into r from public.customer_requirements where id=c.requirement_id;
  if r.status<>'awarded' or r.accepted_proposal_id is distinct from c.proposal_id then raise exception 'Messaging is available only for the awarded provider relationship.'; end if;
  select * into row_value from public.marketplace_messages where sender_user_id=auth.uid() and idempotency_key=key_value;
  if found then return row_value; end if;
  insert into public.marketplace_messages(conversation_id,sender_user_id,idempotency_key,body)
  values(c.id,auth.uid(),key_value,body_value) returning * into row_value;
  update public.marketplace_conversations set last_message_at=row_value.created_at,updated_at=now() where id=c.id;
  insert into public.marketplace_conversation_reads(conversation_id,user_id,last_read_at,updated_at)
  values(c.id,auth.uid(),row_value.created_at,now()) on conflict(conversation_id,user_id) do update set last_read_at=excluded.last_read_at,updated_at=now();
  recipient_id:=case when auth.uid()=c.customer_id then c.provider_user_id else c.customer_id end;
  sender_name:=public.marketplace_safe_display_name(auth.uid());
  insert into public.notifications(recipient_user_id,conversation_id,event_type,title,body)
  values(recipient_id,c.id,'message_received','New message from '||sender_name,left(body_value,180));
  return row_value;
end;
$$;
revoke all on function public.send_marketplace_message(uuid,text,text) from public,anon;
grant execute on function public.send_marketplace_message(uuid,text,text) to authenticated;
