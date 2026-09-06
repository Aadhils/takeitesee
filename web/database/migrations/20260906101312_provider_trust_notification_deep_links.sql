create or replace function public.set_provider_trust_state(
  target_provider_type text,
  target_provider_id uuid,
  target_action text,
  action_reason text
)
returns jsonb
language plpgsql
security definer
set search_path=''
as $$
declare
  state_row public.provider_trust_states%rowtype;
  owner_id uuid;
  previous_status text;
  next_status text;
  reason_value text:=nullif(btrim(coalesce(action_reason,'')),'');
  event_value text;
  notification_type text;
  notification_title text;
  notification_body text;
  notification_target_path text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform manage permission is required.'; end if;
  if target_provider_type not in ('professional','business') then raise exception 'Provider type is invalid.'; end if;
  if target_action not in ('require_reverification','suspend','restore') then raise exception 'Trust action is invalid.'; end if;
  if reason_value is null or char_length(reason_value)<3 or char_length(reason_value)>1200 then raise exception 'A reason between 3 and 1200 characters is required.'; end if;

  if target_provider_type='professional' then
    select user_id into owner_id from public.professional_profiles where id=target_provider_id;
  else
    select owner_user_id into owner_id from public.businesses where id=target_provider_id;
  end if;
  if owner_id is null then raise exception 'Provider was not found.'; end if;
  if owner_id=auth.uid() then raise exception 'You cannot change trust state for your own provider account.'; end if;

  select * into state_row from public.provider_trust_states
  where (target_provider_type='professional' and professional_id=target_provider_id)
     or (target_provider_type='business' and business_id=target_provider_id)
  for update;
  if not found then
    insert into public.provider_trust_states(provider_type,professional_id,business_id,owner_user_id,status,reason)
    values(target_provider_type,case when target_provider_type='professional' then target_provider_id end,case when target_provider_type='business' then target_provider_id end,owner_id,'normal','Trust state initialized.')
    returning * into state_row;
  end if;
  previous_status:=state_row.status;

  if target_action='require_reverification' then
    if previous_status<>'normal' then raise exception 'Re-verification can be required only from normal trust state.'; end if;
    next_status:='reverification_required';
    event_value:='reverification_required';
    notification_type:='provider_reverification_required';
    notification_title:='Re-verification required';
    notification_body:=reason_value;
    notification_target_path:='/provider/verification';
  elsif target_action='suspend' then
    if previous_status='suspended' then raise exception 'Provider is already suspended.'; end if;
    next_status:='suspended';
    event_value:='suspended';
    notification_type:='provider_suspended';
    notification_title:='Provider account suspended';
    notification_body:=reason_value;
    notification_target_path:='/provider/setup';
  else
    if previous_status='normal' then raise exception 'Provider trust state is already normal.'; end if;
    next_status:='normal';
    event_value:='restored';
    notification_type:='provider_restored';
    notification_title:='Provider trust access restored';
    notification_body:=reason_value;
    notification_target_path:='/provider/setup';
  end if;

  update public.provider_trust_states
  set status=next_status,reason=reason_value,changed_by=auth.uid(),updated_at=now()
  where id=state_row.id returning * into state_row;

  insert into public.provider_trust_events(trust_state_id,actor_user_id,actor_type,event_type,from_status,to_status,reason)
  values(state_row.id,auth.uid(),'admin',event_value,previous_status,next_status,reason_value);

  if target_action='require_reverification' then
    if target_provider_type='professional' then
      update public.professional_profiles set verified=false,updated_at=now() where id=target_provider_id;
    else
      update public.businesses set verified=false,updated_at=now() where id=target_provider_id;
    end if;
  end if;

  if target_action in ('require_reverification','suspend') then
    update public.services set status='paused'::public.service_status,active=false,updated_at=now()
    where status='active'::public.service_status
      and ((target_provider_type='professional' and professional_id=target_provider_id)
        or (target_provider_type='business' and business_id=target_provider_id));
  end if;

  insert into public.notifications(recipient_user_id,event_type,title,body,target_path)
  values(owner_id,notification_type,notification_title,notification_body,notification_target_path);

  return jsonb_build_object('trust_state_id',state_row.id,'provider_type',target_provider_type,'provider_id',target_provider_id,'status',state_row.status,'reason',state_row.reason,'updated_at',state_row.updated_at);
end;
$$;
