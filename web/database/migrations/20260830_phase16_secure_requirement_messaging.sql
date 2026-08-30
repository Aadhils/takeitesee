-- Phase 16 Module 3: secure customer <-> accepted provider messaging.
-- A conversation exists only for an awarded requirement and its accepted proposal.

create table if not exists public.marketplace_conversations (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null unique references public.customer_requirements(id) on delete restrict,
  proposal_id uuid not null unique references public.requirement_proposals(id) on delete restrict,
  customer_id uuid not null references public.users(id) on delete restrict,
  provider_user_id uuid not null references public.users(id) on delete restrict,
  status text not null default 'open' check (status in ('open','closed')),
  closed_reason text,
  opened_at timestamptz not null default now(),
  closed_at timestamptz,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (customer_id <> provider_user_id),
  check ((status='open' and closed_at is null) or (status='closed' and closed_at is not null)),
  check (closed_reason is null or closed_reason in ('fulfilled','cancelled'))
);
create index if not exists marketplace_conversations_customer_activity_idx
  on public.marketplace_conversations(customer_id,coalesce(last_message_at,opened_at) desc);
create index if not exists marketplace_conversations_provider_activity_idx
  on public.marketplace_conversations(provider_user_id,coalesce(last_message_at,opened_at) desc);

create table if not exists public.marketplace_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.marketplace_conversations(id) on delete restrict,
  sender_user_id uuid not null references public.users(id) on delete restrict,
  idempotency_key text not null,
  body text not null,
  created_at timestamptz not null default now(),
  unique(sender_user_id,idempotency_key),
  check (char_length(idempotency_key) between 8 and 120),
  check (char_length(btrim(body)) between 1 and 2000)
);
create index if not exists marketplace_messages_conversation_created_idx
  on public.marketplace_messages(conversation_id,created_at,id);

create table if not exists public.marketplace_conversation_reads (
  conversation_id uuid not null references public.marketplace_conversations(id) on delete restrict,
  user_id uuid not null references public.users(id) on delete restrict,
  last_read_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(conversation_id,user_id)
);
create index if not exists marketplace_conversation_reads_user_idx
  on public.marketplace_conversation_reads(user_id,updated_at desc);

alter table public.marketplace_conversations enable row level security;
alter table public.marketplace_messages enable row level security;
alter table public.marketplace_conversation_reads enable row level security;

revoke all on public.marketplace_conversations from anon;
revoke all on public.marketplace_messages from anon;
revoke all on public.marketplace_conversation_reads from anon;
revoke insert,update,delete on public.marketplace_conversations from authenticated;
revoke insert,update,delete on public.marketplace_messages from authenticated;
revoke insert,update,delete on public.marketplace_conversation_reads from authenticated;
grant select on public.marketplace_conversations to authenticated;
grant select on public.marketplace_messages to authenticated;
grant select on public.marketplace_conversation_reads to authenticated;
grant select,insert,update,delete on public.marketplace_conversations to service_role;
grant select,insert,update,delete on public.marketplace_messages to service_role;
grant select,insert,update,delete on public.marketplace_conversation_reads to service_role;

drop policy if exists marketplace_conversations_participant_read on public.marketplace_conversations;
create policy marketplace_conversations_participant_read on public.marketplace_conversations
for select to authenticated using (customer_id=auth.uid() or provider_user_id=auth.uid());

drop policy if exists marketplace_messages_participant_read on public.marketplace_messages;
create policy marketplace_messages_participant_read on public.marketplace_messages
for select to authenticated using (
  exists(
    select 1 from public.marketplace_conversations c
    where c.id=marketplace_messages.conversation_id
      and (c.customer_id=auth.uid() or c.provider_user_id=auth.uid())
  )
);

drop policy if exists marketplace_conversation_reads_own_read on public.marketplace_conversation_reads;
create policy marketplace_conversation_reads_own_read on public.marketplace_conversation_reads
for select to authenticated using (user_id=auth.uid());

-- Attach message notifications to a conversation without changing booking notification semantics.
alter table public.notifications add column if not exists conversation_id uuid;
do $$
begin
  if not exists(select 1 from pg_constraint where conname='notifications_conversation_id_fkey') then
    alter table public.notifications
      add constraint notifications_conversation_id_fkey
      foreign key(conversation_id) references public.marketplace_conversations(id) on delete set null;
  end if;
end $$;
create index if not exists notifications_conversation_idx on public.notifications(conversation_id);

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
    'requirement_chat_opened','message_received'
  ));

create or replace function public.marketplace_safe_display_name(target_user_id uuid)
returns text
language sql stable security definer set search_path=''
as $$
  select coalesce(
    (select b.name from public.businesses b where b.owner_user_id=target_user_id limit 1),
    (select nullif(btrim(p.headline),'') from public.professional_profiles p where p.user_id=target_user_id limit 1),
    (select nullif(btrim(u.name),'') from public.users u where u.id=target_user_id),
    'Marketplace user'
  );
$$;
revoke all on function public.marketplace_safe_display_name(uuid) from public,anon,authenticated;
grant execute on function public.marketplace_safe_display_name(uuid) to service_role;

create or replace function public.sync_awarded_requirement_conversation()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  proposal_row public.requirement_proposals%rowtype;
  conversation_row public.marketplace_conversations%rowtype;
  customer_name text;
  provider_name text;
begin
  if new.status='awarded' and (old.status is distinct from new.status or old.accepted_proposal_id is distinct from new.accepted_proposal_id) then
    if new.accepted_proposal_id is null then
      raise exception 'Awarded requirement requires an accepted proposal.';
    end if;
    select * into proposal_row from public.requirement_proposals
      where id=new.accepted_proposal_id and requirement_id=new.id and status='accepted';
    if not found then raise exception 'Accepted proposal is invalid for this requirement.'; end if;

    insert into public.marketplace_conversations(requirement_id,proposal_id,customer_id,provider_user_id,status,opened_at)
    values(new.id,proposal_row.id,new.customer_id,proposal_row.provider_user_id,'open',now())
    on conflict(requirement_id) do update
      set proposal_id=excluded.proposal_id,
          customer_id=excluded.customer_id,
          provider_user_id=excluded.provider_user_id,
          status='open',closed_reason=null,closed_at=null,updated_at=now()
    returning * into conversation_row;

    insert into public.marketplace_conversation_reads(conversation_id,user_id,last_read_at,updated_at)
    values(conversation_row.id,new.customer_id,now(),now()),(conversation_row.id,proposal_row.provider_user_id,now(),now())
    on conflict(conversation_id,user_id) do update set last_read_at=excluded.last_read_at,updated_at=now();

    customer_name:=public.marketplace_safe_display_name(new.customer_id);
    provider_name:=public.marketplace_safe_display_name(proposal_row.provider_user_id);

    insert into public.notifications(recipient_user_id,conversation_id,event_type,title,body)
    values
      (new.customer_id,conversation_row.id,'requirement_chat_opened','Private chat is ready','You can now message '||provider_name||' about '||new.requirement_reference||'.'),
      (proposal_row.provider_user_id,conversation_row.id,'requirement_chat_opened','Your proposal was accepted','You can now message '||customer_name||' about '||new.requirement_reference||'.');
  end if;

  if new.status in ('fulfilled','cancelled') and old.status is distinct from new.status then
    update public.marketplace_conversations
    set status='closed',closed_reason=new.status,closed_at=now(),updated_at=now()
    where requirement_id=new.id and status<>'closed';
  end if;
  return new;
end;
$$;
revoke all on function public.sync_awarded_requirement_conversation() from public,anon,authenticated;

drop trigger if exists customer_requirements_sync_conversation on public.customer_requirements;
create trigger customer_requirements_sync_conversation
after update of status,accepted_proposal_id on public.customer_requirements
for each row execute function public.sync_awarded_requirement_conversation();

create or replace function public.get_marketplace_inbox()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',c.id,
    'requirement_id',r.id,
    'requirement_reference',r.requirement_reference,
    'requirement_title',r.title,
    'requirement_status',r.status,
    'conversation_status',c.status,
    'closed_reason',c.closed_reason,
    'participant_role',case when c.customer_id=auth.uid() then 'customer' else 'provider' end,
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
  join public.customer_requirements r on r.id=c.requirement_id
  join public.requirement_proposals p on p.id=c.proposal_id
  join public.services s on s.id=p.service_id
  where c.customer_id=auth.uid() or c.provider_user_id=auth.uid();

  return result_value;
end;
$$;
revoke all on function public.get_marketplace_inbox() from public,anon;
grant execute on function public.get_marketplace_inbox() to authenticated;

create or replace function public.get_marketplace_conversation(target_conversation_id uuid)
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare c public.marketplace_conversations%rowtype; result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into c from public.marketplace_conversations where id=target_conversation_id;
  if not found then raise exception 'Conversation was not found.'; end if;
  if auth.uid() not in (c.customer_id,c.provider_user_id) then raise exception 'You are not a participant in this conversation.'; end if;

  select jsonb_build_object(
    'conversation',jsonb_build_object(
      'id',c.id,'requirement_id',r.id,'requirement_reference',r.requirement_reference,'requirement_title',r.title,
      'requirement_status',r.status,'conversation_status',c.status,'closed_reason',c.closed_reason,
      'participant_role',case when c.customer_id=auth.uid() then 'customer' else 'provider' end,
      'counterpart_name',public.marketplace_safe_display_name(case when c.customer_id=auth.uid() then c.provider_user_id else c.customer_id end),
      'proposal_reference',p.proposal_reference,'amount_minor',p.amount_minor,'currency',p.currency,'service_name',s.name,
      'opened_at',c.opened_at,'last_message_at',c.last_message_at
    ),
    'messages',coalesce((select jsonb_agg(jsonb_build_object(
      'id',m.id,'body',m.body,'created_at',m.created_at,'is_mine',m.sender_user_id=auth.uid(),
      'sender_name',public.marketplace_safe_display_name(m.sender_user_id)
    ) order by m.created_at,m.id) from public.marketplace_messages m where m.conversation_id=c.id),'[]'::jsonb)
  ) into result_value
  from public.customer_requirements r
  join public.requirement_proposals p on p.id=c.proposal_id
  join public.services s on s.id=p.service_id
  where r.id=c.requirement_id;
  return result_value;
end;
$$;
revoke all on function public.get_marketplace_conversation(uuid) from public,anon;
grant execute on function public.get_marketplace_conversation(uuid) to authenticated;

create or replace function public.mark_marketplace_conversation_read(target_conversation_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare c public.marketplace_conversations%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into c from public.marketplace_conversations where id=target_conversation_id;
  if not found then raise exception 'Conversation was not found.'; end if;
  if auth.uid() not in (c.customer_id,c.provider_user_id) then raise exception 'You are not a participant in this conversation.'; end if;
  insert into public.marketplace_conversation_reads(conversation_id,user_id,last_read_at,updated_at)
  values(c.id,auth.uid(),now(),now())
  on conflict(conversation_id,user_id) do update set last_read_at=excluded.last_read_at,updated_at=now();
end;
$$;
revoke all on function public.mark_marketplace_conversation_read(uuid) from public,anon;
grant execute on function public.mark_marketplace_conversation_read(uuid) to authenticated;

create or replace function public.send_marketplace_message(
  target_conversation_id uuid,
  requested_idempotency_key text,
  requested_body text
)
returns public.marketplace_messages
language plpgsql security definer set search_path=public,pg_temp as $$
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
  select * into r from public.customer_requirements where id=c.requirement_id;
  if r.status<>'awarded' or r.accepted_proposal_id is distinct from c.proposal_id then
    raise exception 'Messaging is available only for the awarded provider relationship.';
  end if;

  select * into row_value from public.marketplace_messages where sender_user_id=auth.uid() and idempotency_key=key_value;
  if found then return row_value; end if;

  insert into public.marketplace_messages(conversation_id,sender_user_id,idempotency_key,body)
  values(c.id,auth.uid(),key_value,body_value)
  returning * into row_value;

  update public.marketplace_conversations set last_message_at=row_value.created_at,updated_at=now() where id=c.id;
  insert into public.marketplace_conversation_reads(conversation_id,user_id,last_read_at,updated_at)
  values(c.id,auth.uid(),row_value.created_at,now())
  on conflict(conversation_id,user_id) do update set last_read_at=excluded.last_read_at,updated_at=now();

  recipient_id:=case when auth.uid()=c.customer_id then c.provider_user_id else c.customer_id end;
  sender_name:=public.marketplace_safe_display_name(auth.uid());
  insert into public.notifications(recipient_user_id,conversation_id,event_type,title,body)
  values(recipient_id,c.id,'message_received','New message from '||sender_name,left(body_value,180));

  return row_value;
end;
$$;
revoke all on function public.send_marketplace_message(uuid,text,text) from public,anon;
grant execute on function public.send_marketplace_message(uuid,text,text) to authenticated;
