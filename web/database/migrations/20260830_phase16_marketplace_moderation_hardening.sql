-- Safe participant-only read model for conversation blocking state.

create or replace function public.get_marketplace_conversation_safety(target_conversation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  c public.marketplace_conversations%rowtype;
  counterpart_id uuid;
  blocked_by_me_value boolean;
  messaging_blocked_value boolean;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into c from public.marketplace_conversations where id=target_conversation_id;
  if not found then raise exception 'Conversation was not found.'; end if;
  if auth.uid() not in (c.customer_id,c.provider_user_id) then raise exception 'You are not a participant in this conversation.'; end if;
  counterpart_id:=case when auth.uid()=c.customer_id then c.provider_user_id else c.customer_id end;
  select exists(
    select 1 from public.marketplace_user_blocks b
    where b.conversation_id=c.id and b.blocker_user_id=auth.uid() and b.blocked_user_id=counterpart_id
  ) into blocked_by_me_value;
  select exists(
    select 1 from public.marketplace_user_blocks b
    where b.conversation_id=c.id
      and ((b.blocker_user_id=c.customer_id and b.blocked_user_id=c.provider_user_id)
        or (b.blocker_user_id=c.provider_user_id and b.blocked_user_id=c.customer_id))
  ) into messaging_blocked_value;
  return jsonb_build_object('blocked_by_me',blocked_by_me_value,'messaging_blocked',messaging_blocked_value);
end;
$$;
revoke all on function public.get_marketplace_conversation_safety(uuid) from public,anon;
grant execute on function public.get_marketplace_conversation_safety(uuid) to authenticated;
