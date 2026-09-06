create or replace function public.assign_requirement_conversation_notification_target()
returns trigger
language plpgsql
security definer
set search_path = ''
as $function$
declare
  conversation_row public.marketplace_conversations%rowtype;
begin
  if new.target_path is not null or new.conversation_id is null then
    return new;
  end if;

  if new.event_type not in ('requirement_chat_opened','message_received') then
    return new;
  end if;

  select * into conversation_row
  from public.marketplace_conversations
  where id=new.conversation_id;

  if not found or conversation_row.conversation_kind<>'requirement' then
    return new;
  end if;

  if new.recipient_user_id=conversation_row.customer_id then
    new.target_path:='/messages?conversation='||new.conversation_id::text;
  elsif new.recipient_user_id=conversation_row.provider_user_id then
    new.target_path:='/provider/messages?conversation='||new.conversation_id::text;
  end if;

  return new;
end;
$function$;

revoke all on function public.assign_requirement_conversation_notification_target() from public, anon, authenticated;
grant execute on function public.assign_requirement_conversation_notification_target() to service_role;

drop trigger if exists notifications_assign_requirement_conversation_target on public.notifications;
create trigger notifications_assign_requirement_conversation_target
before insert on public.notifications
for each row execute function public.assign_requirement_conversation_notification_target();