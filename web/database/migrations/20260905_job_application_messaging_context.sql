-- Product: Context-aware marketplace messaging for job applications.
-- Requirement conversations keep their existing behavior. Job conversations use
-- the same inbox/thread/message transport after shortlist/interview activation.

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
  if exists(
    select 1 from public.marketplace_user_blocks block
    where block.conversation_id=c.id
      and ((block.blocker_user_id=c.customer_id and block.blocked_user_id=c.provider_user_id)
        or (block.blocker_user_id=c.provider_user_id and block.blocked_user_id=c.customer_id))
  ) then
    raise exception 'Messaging is blocked for this conversation.';
  end if;

  if c.conversation_kind='requirement' then
    select * into r from public.customer_requirements where id=c.requirement_id;
    if r.status<>'awarded' or r.accepted_proposal_id is distinct from c.proposal_id then
      raise exception 'Messaging is available only for the awarded provider relationship.';
    end if;
  elsif c.conversation_kind='job_application' then
    select * into ja
    from public.job_applications application
    where application.id=c.job_application_id;
    if not found then raise exception 'Job application conversation is invalid.'; end if;

    select profile.user_id,business.owner_user_id
    into applicant_user,employer_user
    from public.professional_profiles profile
    join public.job_postings posting on posting.id=ja.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where profile.id=ja.professional_id;

    if ja.status not in ('shortlisted','interview') then
      raise exception 'Job conversation is read-only for this application status.';
    end if;
    if c.customer_id is distinct from applicant_user or c.provider_user_id is distinct from employer_user then
      raise exception 'Job conversation participants do not match the application.';
    end if;
  else
    raise exception 'Conversation context is invalid.';
  end if;

  select * into row_value
  from public.marketplace_messages
  where sender_user_id=auth.uid() and idempotency_key=key_value;
  if found then return row_value; end if;

  insert into public.marketplace_messages(conversation_id,sender_user_id,idempotency_key,body)
  values(c.id,auth.uid(),key_value,body_value)
  returning * into row_value;

  update public.marketplace_conversations
  set last_message_at=row_value.created_at,updated_at=now()
  where id=c.id;

  insert into public.marketplace_conversation_reads(conversation_id,user_id,last_read_at,updated_at)
  values(c.id,auth.uid(),row_value.created_at,now())
  on conflict(conversation_id,user_id) do update
    set last_read_at=excluded.last_read_at,updated_at=now();

  recipient_id:=case when auth.uid()=c.customer_id then c.provider_user_id else c.customer_id end;
  sender_name:=public.marketplace_safe_display_name(auth.uid());
  insert into public.notifications(recipient_user_id,conversation_id,event_type,title,body,target_path)
  values(
    recipient_id,c.id,'message_received','New message from '||sender_name,left(body_value,180),
    case when c.conversation_kind='job_application' then '/provider/messages?conversation='||c.id::text else null end
  );
  return row_value;
end;
$$;
revoke all on function public.send_marketplace_message(uuid,text,text) from public,anon;
grant execute on function public.send_marketplace_message(uuid,text,text) to authenticated;
