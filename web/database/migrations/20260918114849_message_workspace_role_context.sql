create or replace function private.marketplace_participant_display_name(target_user_id uuid, participant_role text)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when participant_role = 'customer' then coalesce(
      (select nullif(btrim(u.name),'') from public.users u where u.id = target_user_id),
      'Marketplace user'
    )
    else public.marketplace_safe_display_name(target_user_id)
  end;
$$;

revoke all on function private.marketplace_participant_display_name(uuid,text) from public, anon, authenticated;
grant execute on function private.marketplace_participant_display_name(uuid,text) to service_role;

create or replace function public.get_marketplace_inbox()
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
    'business_product_order_id',po.id,
    'product_order_status',po.status,
    'product_name',po.product_name_snapshot,
    'product_order_business_name',po.business_name_snapshot,
    'product_order_quantity',po.quantity,
    'conversation_status',c.status,
    'closed_reason',c.closed_reason,
    'participant_role',case
      when c.conversation_kind='job_application' then case when c.customer_id=auth.uid() then 'applicant' else 'employer' end
      when c.conversation_kind='product_order' then case when c.customer_id=auth.uid() then 'customer' else 'business' end
      else case when c.customer_id=auth.uid() then 'customer' else 'provider' end
    end,
    'counterpart_name',private.marketplace_participant_display_name(
      case when c.customer_id=auth.uid() then c.provider_user_id else c.customer_id end,
      case
        when c.conversation_kind='job_application' then case when c.customer_id=auth.uid() then 'employer' else 'applicant' end
        when c.conversation_kind='product_order' then case when c.customer_id=auth.uid() then 'business' else 'customer' end
        else case when c.customer_id=auth.uid() then 'provider' else 'customer' end
      end
    ),
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
  left join public.business_product_orders po on po.id=c.business_product_order_id
  where c.customer_id=auth.uid() or c.provider_user_id=auth.uid();

  return result_value;
end;
$$;

create or replace function public.get_marketplace_conversation(target_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
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
      'business_product_order_id',po.id,
      'product_order_status',po.status,
      'product_name',po.product_name_snapshot,
      'product_order_business_name',po.business_name_snapshot,
      'product_order_quantity',po.quantity,
      'conversation_status',c.status,
      'closed_reason',c.closed_reason,
      'participant_role',case
        when c.conversation_kind='job_application' then case when c.customer_id=auth.uid() then 'applicant' else 'employer' end
        when c.conversation_kind='product_order' then case when c.customer_id=auth.uid() then 'customer' else 'business' end
        else case when c.customer_id=auth.uid() then 'customer' else 'provider' end
      end,
      'counterpart_name',private.marketplace_participant_display_name(
        case when c.customer_id=auth.uid() then c.provider_user_id else c.customer_id end,
        case
          when c.conversation_kind='job_application' then case when c.customer_id=auth.uid() then 'employer' else 'applicant' end
          when c.conversation_kind='product_order' then case when c.customer_id=auth.uid() then 'business' else 'customer' end
          else case when c.customer_id=auth.uid() then 'provider' else 'customer' end
        end
      ),
      'proposal_reference',p.proposal_reference,
      'amount_minor',p.amount_minor,
      'currency',p.currency,
      'service_name',s.name,
      'opened_at',c.opened_at,
      'last_message_at',c.last_message_at
    ),
    'messages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'body',m.body,'created_at',m.created_at,'is_mine',m.sender_user_id=auth.uid(),
      'sender_name',private.marketplace_participant_display_name(
        m.sender_user_id,
        case
          when c.conversation_kind='job_application' then case when m.sender_user_id=c.customer_id then 'applicant' else 'employer' end
          when c.conversation_kind='product_order' then case when m.sender_user_id=c.customer_id then 'customer' else 'business' end
          else case when m.sender_user_id=c.customer_id then 'customer' else 'provider' end
        end
      )
    ) order by m.created_at,m.id) from public.marketplace_messages m where m.conversation_id=c.id),'[]'::jsonb)
  ) into result_value
  from public.marketplace_conversations base
  left join public.customer_requirements r on r.id=base.requirement_id
  left join public.requirement_proposals p on p.id=base.proposal_id
  left join public.services s on s.id=p.service_id
  left join public.job_applications ja on ja.id=base.job_application_id
  left join public.job_postings jp on jp.id=ja.job_posting_id
  left join public.businesses jb on jb.id=jp.business_id
  left join public.business_product_orders po on po.id=base.business_product_order_id
  where base.id=c.id;
  return result_value;
end;
$$;

create or replace function public.send_marketplace_message(target_conversation_id uuid, requested_idempotency_key text, requested_body text)
returns public.marketplace_messages
language plpgsql
security definer
set search_path = ''
as $$
declare
  c public.marketplace_conversations%rowtype;
  r public.customer_requirements%rowtype;
  ja public.job_applications%rowtype;
  po public.business_product_orders%rowtype;
  row_value public.marketplace_messages%rowtype;
  body_value text:=btrim(coalesce(requested_body,''));
  key_value text:=btrim(coalesce(requested_idempotency_key,''));
  recipient_id uuid;
  sender_name text;
  applicant_user uuid;
  employer_user uuid;
  order_business_owner_user uuid;
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
    select * into ja from public.job_applications application where application.id=c.job_application_id;
    if not found then raise exception 'Job application conversation is invalid.'; end if;

    select profile.user_id,business.owner_user_id
    into applicant_user,employer_user
    from public.professional_profiles profile
    join public.job_postings posting on posting.id=ja.job_posting_id
    join public.businesses business on business.id=posting.business_id
    where profile.id=ja.professional_id;

    if ja.status not in ('shortlisted','interview') then raise exception 'Job conversation is read-only for this application status.'; end if;
    if c.customer_id is distinct from applicant_user or c.provider_user_id is distinct from employer_user then
      raise exception 'Job conversation participants do not match the application.';
    end if;
  elsif c.conversation_kind='product_order' then
    select * into po from public.business_product_orders order_row where order_row.id=c.business_product_order_id;
    if not found then raise exception 'Product order conversation is invalid.'; end if;

    select business.owner_user_id into order_business_owner_user
    from public.businesses business where business.id=po.business_id;
    if order_business_owner_user is null then raise exception 'Product order Business identity is invalid.'; end if;

    if po.status not in ('requested','accepted') then raise exception 'Product order conversation is read-only for this order status.'; end if;
    if c.customer_id is distinct from po.customer_user_id or c.provider_user_id is distinct from order_business_owner_user then
      raise exception 'Product order conversation participants do not match the order.';
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
  sender_name:=private.marketplace_participant_display_name(
    auth.uid(),
    case
      when c.conversation_kind='job_application' then case when auth.uid()=c.customer_id then 'applicant' else 'employer' end
      when c.conversation_kind='product_order' then case when auth.uid()=c.customer_id then 'customer' else 'business' end
      else case when auth.uid()=c.customer_id then 'customer' else 'provider' end
    end
  );

  insert into public.notifications(recipient_user_id,conversation_id,event_type,title,body,target_path)
  values(
    recipient_id,c.id,'message_received','New message from '||sender_name,left(body_value,180),
    case
      when c.conversation_kind='job_application' then '/provider/messages?conversation='||c.id::text
      when c.conversation_kind='product_order' and recipient_id=c.provider_user_id then '/provider/messages?conversation='||c.id::text
      when c.conversation_kind='product_order' then '/messages?conversation='||c.id::text
      else null
    end
  );
  return row_value;
end;
$$;
