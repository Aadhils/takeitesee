-- Product: Job application communication + interview scheduling foundation.
--
-- Extends the existing marketplace messaging transport so job applicants and
-- employers use the same participant, block, read-marker, message and inbox
-- infrastructure as service-requirement conversations. Adds participant-only
-- interview scheduling with an immutable audit history. No finance behavior.

-- ---------------------------------------------------------------------------
-- 1) Generalize marketplace conversations for a second context: job application.
-- ---------------------------------------------------------------------------
alter table public.marketplace_conversations
  add column if not exists conversation_kind text not null default 'requirement';

alter table public.marketplace_conversations
  add column if not exists job_application_id uuid;

alter table public.marketplace_conversations
  alter column requirement_id drop not null,
  alter column proposal_id drop not null;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname='marketplace_conversations_job_application_id_fkey'
  ) then
    alter table public.marketplace_conversations
      add constraint marketplace_conversations_job_application_id_fkey
      foreign key(job_application_id) references public.job_applications(id) on delete restrict;
  end if;
end $$;

create unique index if not exists marketplace_conversations_job_application_uidx
  on public.marketplace_conversations(job_application_id)
  where job_application_id is not null;

alter table public.marketplace_conversations
  drop constraint if exists marketplace_conversations_conversation_kind_check;
alter table public.marketplace_conversations
  add constraint marketplace_conversations_conversation_kind_check
  check (conversation_kind in ('requirement','job_application'));

alter table public.marketplace_conversations
  drop constraint if exists marketplace_conversations_context_check;
alter table public.marketplace_conversations
  add constraint marketplace_conversations_context_check
  check (
    (conversation_kind='requirement' and requirement_id is not null and proposal_id is not null and job_application_id is null)
    or
    (conversation_kind='job_application' and requirement_id is null and proposal_id is null and job_application_id is not null)
  );

alter table public.marketplace_conversations
  drop constraint if exists marketplace_conversations_closed_reason_check;
alter table public.marketplace_conversations
  add constraint marketplace_conversations_closed_reason_check
  check (closed_reason is null or closed_reason in ('fulfilled','cancelled','hired','rejected','withdrawn'));

comment on column public.marketplace_conversations.conversation_kind is
  'Conversation context. requirement keeps the original service marketplace flow; job_application reuses the same secure transport for recruitment.';
comment on column public.marketplace_conversations.job_application_id is
  'Application context for job conversations; null for requirement conversations.';

-- ---------------------------------------------------------------------------
-- 2) Interview schedule and immutable event history.
-- ---------------------------------------------------------------------------
create table if not exists public.job_interviews (
  id uuid primary key default gen_random_uuid(),
  job_application_id uuid not null references public.job_applications(id) on delete cascade,
  scheduled_by_user_id uuid not null references public.users(id) on delete restrict,
  starts_at timestamptz not null,
  duration_minutes smallint not null default 30,
  timezone text not null default 'Asia/Kolkata',
  mode text not null,
  location text,
  meeting_url text,
  note text,
  status text not null default 'scheduled',
  responded_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint job_interviews_duration_check check (duration_minutes between 15 and 240),
  constraint job_interviews_timezone_check check (char_length(btrim(timezone)) between 1 and 64),
  constraint job_interviews_mode_check check (mode in ('in_person','phone','video')),
  constraint job_interviews_location_check check (location is null or char_length(location) <= 300),
  constraint job_interviews_meeting_url_check check (
    meeting_url is null
    or (char_length(meeting_url) <= 1000 and meeting_url ~ '^https://[^[:space:]\r\n]+$')
  ),
  constraint job_interviews_note_check check (note is null or char_length(note) <= 2000),
  constraint job_interviews_status_check check (status in ('scheduled','accepted','declined','cancelled')),
  constraint job_interviews_cancelled_at_check check (
    (status='cancelled' and cancelled_at is not null)
    or (status<>'cancelled' and cancelled_at is null)
  )
);

create index if not exists job_interviews_application_created_idx
  on public.job_interviews(job_application_id,created_at desc);
create index if not exists job_interviews_application_starts_idx
  on public.job_interviews(job_application_id,starts_at desc);

create table if not exists public.job_interview_events (
  id uuid primary key default gen_random_uuid(),
  interview_id uuid not null references public.job_interviews(id) on delete cascade,
  job_application_id uuid not null references public.job_applications(id) on delete cascade,
  actor_user_id uuid not null references public.users(id) on delete restrict,
  event_type text not null,
  starts_at timestamptz not null,
  duration_minutes smallint not null,
  timezone text not null,
  mode text not null,
  location text,
  meeting_url text,
  interview_status text not null,
  note text,
  created_at timestamptz not null default now(),
  constraint job_interview_events_type_check check (event_type in ('scheduled','rescheduled','accepted','declined','cancelled')),
  constraint job_interview_events_status_check check (interview_status in ('scheduled','accepted','declined','cancelled'))
);

create index if not exists job_interview_events_interview_created_idx
  on public.job_interview_events(interview_id,created_at,id);
create index if not exists job_interview_events_application_created_idx
  on public.job_interview_events(job_application_id,created_at desc,id);
create index if not exists job_interview_events_actor_user_id_idx
  on public.job_interview_events(actor_user_id);

alter table public.job_interviews enable row level security;
alter table public.job_interview_events enable row level security;

revoke all on table public.job_interviews from public,anon,authenticated;
revoke all on table public.job_interview_events from public,anon,authenticated;

grant select,insert,update on table public.job_interviews to authenticated;
grant select on table public.job_interview_events to authenticated;
grant select,insert,update,delete on table public.job_interviews to service_role;
grant select,insert,update,delete on table public.job_interview_events to service_role;

drop policy if exists job_interviews_participant_read on public.job_interviews;
create policy job_interviews_participant_read
on public.job_interviews for select to authenticated
using (
  exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=job_interviews.job_application_id
      and (profile.user_id=(select auth.uid()) or business.owner_user_id=(select auth.uid()))
  )
);

drop policy if exists job_interviews_employer_insert on public.job_interviews;
create policy job_interviews_employer_insert
on public.job_interviews for insert to authenticated
with check (
  scheduled_by_user_id=(select auth.uid())
  and status='scheduled'
  and exists (
    select 1
    from public.job_applications application
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=job_interviews.job_application_id
      and application.status='interview'
      and business.owner_user_id=(select auth.uid())
      and business.verified=true
  )
);

drop policy if exists job_interviews_participant_update on public.job_interviews;
create policy job_interviews_participant_update
on public.job_interviews for update to authenticated
using (
  exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=job_interviews.job_application_id
      and (profile.user_id=(select auth.uid()) or business.owner_user_id=(select auth.uid()))
  )
)
with check (
  exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=job_interviews.job_application_id
      and (profile.user_id=(select auth.uid()) or business.owner_user_id=(select auth.uid()))
  )
);

drop policy if exists job_interview_events_participant_read on public.job_interview_events;
create policy job_interview_events_participant_read
on public.job_interview_events for select to authenticated
using (
  exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=job_interview_events.job_application_id
      and (profile.user_id=(select auth.uid()) or business.owner_user_id=(select auth.uid()))
  )
);

-- Validate direct participant updates without giving either participant a status-escalation path.
create or replace function public.validate_job_interview_mutation()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  applicant_owner boolean := false;
  employer_owner boolean := false;
  schedule_changed boolean := false;
begin
  if actor is null then raise exception 'Authentication required'; end if;

  if new.meeting_url is not null and new.meeting_url !~ '^https://[^[:space:]\r\n]+$' then
    raise exception 'Meeting URL must be a valid HTTPS URL';
  end if;

  if tg_op='INSERT' then
    if new.status<>'scheduled' then raise exception 'New interviews must be scheduled'; end if;
    if new.scheduled_by_user_id<>actor then raise exception 'Interview scheduler does not match the signed-in employer'; end if;
    if new.starts_at <= now() then raise exception 'Interview must be scheduled in the future'; end if;
    return new;
  end if;

  if new.job_application_id is distinct from old.job_application_id
     or new.scheduled_by_user_id is distinct from old.scheduled_by_user_id
     or new.created_at is distinct from old.created_at then
    raise exception 'Interview identity is immutable';
  end if;

  select exists (
    select 1
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    where application.id=old.job_application_id and profile.user_id=actor
  ) into applicant_owner;

  select exists (
    select 1
    from public.job_applications application
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=old.job_application_id and business.owner_user_id=actor
  ) into employer_owner;

  schedule_changed :=
    new.starts_at is distinct from old.starts_at
    or new.duration_minutes is distinct from old.duration_minutes
    or new.timezone is distinct from old.timezone
    or new.mode is distinct from old.mode
    or new.location is distinct from old.location
    or new.meeting_url is distinct from old.meeting_url
    or new.note is distinct from old.note;

  if applicant_owner then
    if schedule_changed then raise exception 'Applicant cannot alter interview schedule details'; end if;
    if old.status<>'scheduled' or new.status not in ('accepted','declined') then
      raise exception 'Applicant can only accept or decline a scheduled interview';
    end if;
    new.responded_at := now();
    new.cancelled_at := null;
  elsif employer_owner then
    if new.status='cancelled' then
      if old.status not in ('scheduled','accepted','declined') then raise exception 'Interview cannot be cancelled from its current state'; end if;
      if schedule_changed then raise exception 'Cancel the interview without changing its schedule'; end if;
      new.cancelled_at := now();
    elsif new.status='scheduled' then
      if old.status not in ('scheduled','accepted','declined') then raise exception 'Interview cannot be rescheduled from its current state'; end if;
      if not schedule_changed then raise exception 'Change the schedule when rescheduling an interview'; end if;
      if new.starts_at <= now() then raise exception 'Rescheduled interview must be in the future'; end if;
      new.responded_at := null;
      new.cancelled_at := null;
    else
      raise exception 'Employer can only reschedule or cancel an interview';
    end if;
  else
    raise exception 'Interview update not permitted';
  end if;

  new.updated_at := now();
  return new;
end;
$$;
revoke all on function public.validate_job_interview_mutation() from public,anon,authenticated;

drop trigger if exists job_interviews_validate_mutation on public.job_interviews;
create trigger job_interviews_validate_mutation
before insert or update on public.job_interviews
for each row execute function public.validate_job_interview_mutation();

-- ---------------------------------------------------------------------------
-- 3) Notifications and interview audit events.
-- ---------------------------------------------------------------------------
alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications
  add constraint notifications_event_type_check check (event_type in (
    'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
    'reschedule_requested','reschedule_accepted','reschedule_declined',
    'payment_pending','payment_paid','payment_failed','payment_refunded',
    'review_submitted','review_response','support_opened','support_updated',
    'customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
    'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
    'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
    'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected',
    'provider_reverification_required','provider_suspended','provider_restored',
    'provider_payout_prepared','provider_payout_cancelled','provider_payout_processing','provider_payout_paid','provider_payout_failed','provider_payout_reversed','provider_payout_destination_updated',
    'refund_requested','refund_onhold','refund_failed','refund_cancelled',
    'payment_dispute_opened','payment_dispute_resolved','provider_finance_hold','provider_recovery_required','provider_recovery_resolved',
    'requirement_chat_opened','message_received','moderation_report_updated',
    'job_chat_opened','job_interview_scheduled','job_interview_rescheduled','job_interview_accepted','job_interview_declined','job_interview_cancelled'
  ));

create or replace function public.audit_and_notify_job_interview()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  actor uuid := (select auth.uid());
  applicant_user uuid;
  employer_user uuid;
  job_title text;
  event_value text;
  recipient uuid;
begin
  if actor is null then raise exception 'Authenticated interview actor required'; end if;

  select profile.user_id,business.owner_user_id,posting.title
  into applicant_user,employer_user,job_title
  from public.job_applications application
  join public.professional_profiles profile on profile.id=application.professional_id
  join public.job_postings posting on posting.id=application.job_posting_id
  join public.businesses business on business.id=posting.business_id
  where application.id=new.job_application_id;

  if applicant_user is null or employer_user is null then raise exception 'Interview participants were not found'; end if;

  if tg_op='INSERT' then
    event_value := 'scheduled';
    recipient := applicant_user;
  elsif new.status='cancelled' and old.status is distinct from new.status then
    event_value := 'cancelled';
    recipient := applicant_user;
  elsif new.status='accepted' and old.status is distinct from new.status then
    event_value := 'accepted';
    recipient := employer_user;
  elsif new.status='declined' and old.status is distinct from new.status then
    event_value := 'declined';
    recipient := employer_user;
  elsif new.status='scheduled' and (
    new.starts_at is distinct from old.starts_at
    or new.duration_minutes is distinct from old.duration_minutes
    or new.timezone is distinct from old.timezone
    or new.mode is distinct from old.mode
    or new.location is distinct from old.location
    or new.meeting_url is distinct from old.meeting_url
    or new.note is distinct from old.note
  ) then
    event_value := 'rescheduled';
    recipient := applicant_user;
  else
    return new;
  end if;

  insert into public.job_interview_events(
    interview_id,job_application_id,actor_user_id,event_type,starts_at,duration_minutes,timezone,mode,location,meeting_url,interview_status,note
  ) values (
    new.id,new.job_application_id,actor,event_value,new.starts_at,new.duration_minutes,new.timezone,new.mode,new.location,new.meeting_url,new.status,new.note
  );

  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(
    recipient,
    'job_interview_'||event_value,
    case event_value
      when 'scheduled' then 'Interview scheduled'
      when 'rescheduled' then 'Interview rescheduled'
      when 'accepted' then 'Interview accepted'
      when 'declined' then 'Interview declined'
      else 'Interview cancelled'
    end,
    case event_value
      when 'scheduled' then 'An interview was scheduled for '||job_title||'.'
      when 'rescheduled' then 'The interview schedule changed for '||job_title||'.'
      when 'accepted' then 'The applicant accepted the interview for '||job_title||'.'
      when 'declined' then 'The applicant declined the interview for '||job_title||'.'
      else 'The interview was cancelled for '||job_title||'.'
    end,
    '/provider/jobs'
  );
  return new;
end;
$$;
revoke all on function public.audit_and_notify_job_interview() from public,anon,authenticated;

drop trigger if exists job_interviews_audit_notify on public.job_interviews;
create trigger job_interviews_audit_notify
after insert or update on public.job_interviews
for each row execute function public.audit_and_notify_job_interview();

-- ---------------------------------------------------------------------------
-- 4) Open/close job conversations from the controlled application lifecycle.
-- ---------------------------------------------------------------------------
create or replace function public.sync_job_application_conversation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  applicant_user uuid;
  employer_user uuid;
  conversation_row public.marketplace_conversations%rowtype;
  existing_id uuid;
  applicant_name text;
  employer_name text;
  job_title text;
begin
  select profile.user_id,business.owner_user_id,posting.title
  into applicant_user,employer_user,job_title
  from public.professional_profiles profile
  join public.job_postings posting on posting.id=new.job_posting_id
  join public.businesses business on business.id=posting.business_id
  where profile.id=new.professional_id;

  if applicant_user is null or employer_user is null then return new; end if;

  if new.status in ('shortlisted','interview') and old.status is distinct from new.status then
    select id into existing_id
    from public.marketplace_conversations
    where job_application_id=new.id;

    if existing_id is null then
      insert into public.marketplace_conversations(
        conversation_kind,job_application_id,customer_id,provider_user_id,status,opened_at
      ) values (
        'job_application',new.id,applicant_user,employer_user,'open',now()
      ) returning * into conversation_row;

      insert into public.marketplace_conversation_reads(conversation_id,user_id,last_read_at,updated_at)
      values
        (conversation_row.id,applicant_user,now(),now()),
        (conversation_row.id,employer_user,now(),now())
      on conflict(conversation_id,user_id) do update
        set last_read_at=excluded.last_read_at,updated_at=now();

      applicant_name:=public.marketplace_safe_display_name(applicant_user);
      employer_name:=public.marketplace_safe_display_name(employer_user);

      insert into public.notifications(recipient_user_id,conversation_id,event_type,title,body,target_path)
      values
        (applicant_user,conversation_row.id,'job_chat_opened','Private job conversation is ready','You can now message '||employer_name||' about '||job_title||'.','/provider/messages?conversation='||conversation_row.id::text),
        (employer_user,conversation_row.id,'job_chat_opened','Applicant conversation is ready','You can now message '||applicant_name||' about '||job_title||'.','/provider/messages?conversation='||conversation_row.id::text);
    end if;
  end if;

  if new.status in ('hired','rejected','withdrawn') and old.status is distinct from new.status then
    update public.marketplace_conversations
    set status='closed',closed_reason=new.status,closed_at=now(),updated_at=now()
    where job_application_id=new.id and status<>'closed';
  end if;

  return new;
end;
$$;
revoke all on function public.sync_job_application_conversation() from public,anon,authenticated;

drop trigger if exists job_applications_sync_conversation on public.job_applications;
create trigger job_applications_sync_conversation
after update of status on public.job_applications
for each row execute function public.sync_job_application_conversation();

-- ---------------------------------------------------------------------------
-- 5) Make the existing messaging read/send RPCs context-aware.
-- ---------------------------------------------------------------------------
create or replace function public.get_marketplace_inbox()
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,
    'conversation_kind',c.conversation_kind,
    'requirement_id',r.id,
    'requirement_reference',r.requirement_reference,
    'requirement_title',r.title,
    'requirement_status',r.status,
    'job_application_id',ja.id,
    'job_posting_id',jp.id,
    'job_title',jp.title,
    'application_status',ja.status,
    'business_name',jb.name,
    'conversation_status',c.status,
    'closed_reason',c.closed_reason,
    'participant_role',case
      when c.conversation_kind='job_application' then case when c.customer_id=auth.uid() then 'applicant' else 'employer' end
      else case when c.customer_id=auth.uid() then 'customer' else 'provider' end
    end,
    'counterpart_name',public.marketplace_safe_display_name(case when c.customer_id=auth.uid() then c.provider_user_id else c.customer_id end),
    'proposal_reference',p.proposal_reference,
    'amount_minor',p.amount_minor,
    'currency',p.currency,
    'service_name',s.name,
    'last_message_body',(select left(m.body,160) from public.marketplace_messages m where m.conversation_id=c.id order by m.created_at desc,m.id desc limit 1),
    'last_message_at',c.last_message_at,
    'opened_at',c.opened_at,
    'unread_count',(select count(*)::int from public.marketplace_messages m where m.conversation_id=c.id and m.sender_user_id<>auth.uid() and m.created_at>coalesce((select rr.last_read_at from public.marketplace_conversation_reads rr where rr.conversation_id=c.id and rr.user_id=auth.uid()),'-infinity'::timestamptz))
  ) order by coalesce(c.last_message_at,c.opened_at) desc),'[]'::jsonb)
  into result_value
  from public.marketplace_conversations c
  left join public.customer_requirements r on r.id=c.requirement_id
  left join public.requirement_proposals p on p.id=c.proposal_id
  left join public.services s on s.id=p.service_id
  left join public.job_applications ja on ja.id=c.job_application_id
  left join public.job_postings jp on jp.id=ja.job_posting_id
  left join public.businesses jb on jb.id=jp.business_id
  where c.customer_id=auth.uid() or c.provider_user_id=auth.uid();

  return result_value;
end;
$$;
revoke all on function public.get_marketplace_inbox() from public,anon;
grant execute on function public.get_marketplace_inbox() to authenticated;

create or replace function public.get_marketplace_conversation(target_conversation_id uuid)
returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare c public.marketplace_conversations%rowtype; result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into c from public.marketplace_conversations where id=target_conversation_id;
  if not found then raise exception 'Conversation was not found.'; end if;
  if auth.uid() not in (c.customer_id,c.provider_user_id) then raise exception 'You are not a participant in this conversation.'; end if;

  select jsonb_build_object(
    'conversation',jsonb_build_object(
      'id',c.id,
      'conversation_kind',c.conversation_kind,
      'requirement_id',r.id,
      'requirement_reference',r.requirement_reference,
      'requirement_title',r.title,
      'requirement_status',r.status,
      'job_application_id',ja.id,
      'job_posting_id',jp.id,
      'job_title',jp.title,
      'application_status',ja.status,
      'business_name',jb.name,
      'conversation_status',c.status,
      'closed_reason',c.closed_reason,
      'participant_role',case
        when c.conversation_kind='job_application' then case when c.customer_id=auth.uid() then 'applicant' else 'employer' end
        else case when c.customer_id=auth.uid() then 'customer' else 'provider' end
      end,
      'counterpart_name',public.marketplace_safe_display_name(case when c.customer_id=auth.uid() then c.provider_user_id else c.customer_id end),
      'proposal_reference',p.proposal_reference,
      'amount_minor',p.amount_minor,
      'currency',p.currency,
      'service_name',s.name,
      'opened_at',c.opened_at,
      'last_message_at',c.last_message_at
    ),
    'messages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'body',m.body,'created_at',m.created_at,'is_mine',m.sender_user_id=auth.uid(),
      'sender_name',public.marketplace_safe_display_name(m.sender_user_id)
    ) order by m.created_at,m.id) from public.marketplace_messages m where m.conversation_id=c.id),'[]'::jsonb)
  ) into result_value
  from public.marketplace_conversations base
  left join public.customer_requirements r on r.id=base.requirement_id
  left join public.requirement_proposals p on p.id=base.proposal_id
  left join public.services s on s.id=p.service_id
  left join public.job_applications ja on ja.id=base.job_application_id
  left join public.job_postings jp on jp.id=ja.job_posting_id
  left join public.businesses jb on jb.id=jp.business_id
  where base.id=c.id;
  return result_value;
end;
$$;
revoke all on function public.get_marketplace_conversation(uuid) from public,anon;
grant execute on function public.get_marketplace_conversation(uuid) to authenticated;

create or replace function public.send_marketplace_message(
  target_conversation_id uuid,
  requested_idempotency_key text,
  requested_body text
)
returns public.marketplace_messages
language plpgsql security definer
set search_path = ''
as $$
declare
  c public.marketplace_conversations%rowtype;
  r public.customer_requirements%rowtype;
  ja public.job_applications%rowtype;
  row_value public.marketplace_messages%rowtype;
  body_value text:=btrim(coalesce(requested_body,''));
  key_value text:=btrim(coalesce(requested_idempotency_key,''));
  recipient_id uuid;
  sender_name text;
  applicant_user uuid;
  employer_user uuid;
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

  if c.conversation_kind='requirement' then
    select * into r from public.customer_requirements where id=c.requirement_id;
    if r.status<>'awarded' or r.accepted_proposal_id is distinct from c.proposal_id then
      raise exception 'Messaging is available only for the awarded provider relationship.';
    end if;
  elsif c.conversation_kind='job_application' then
    select application.*,profile.user_id,business.owner_user_id
    into ja,applicant_user,employer_user
    from public.job_applications application
    join public.professional_profiles profile on profile.id=application.professional_id
    join public.job_postings posting on posting.id=application.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where application.id=c.job_application_id;
    if not found then raise exception 'Job application conversation is invalid.'; end if;
    if ja.status not in ('shortlisted','interview') then raise exception 'Job conversation is read-only for this application status.'; end if;
    if c.customer_id is distinct from applicant_user or c.provider_user_id is distinct from employer_user then
      raise exception 'Job conversation participants do not match the application.';
    end if;
  else
    raise exception 'Conversation context is invalid.';
  end if;

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

comment on table public.job_interviews is
  'Participant-only job interview schedule records. Employer schedules/reschedules/cancels; applicant accepts/declines.';
comment on table public.job_interview_events is
  'Append-only participant-readable audit snapshots for job interview schedule lifecycle.';
