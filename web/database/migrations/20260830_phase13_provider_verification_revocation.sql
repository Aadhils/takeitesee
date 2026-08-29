-- Phase 13 Module 2 hardening: represent verification revocation explicitly.

alter table public.provider_verification_requests drop constraint if exists provider_verification_requests_status_check;
alter table public.provider_verification_requests add constraint provider_verification_requests_status_check
  check (status in ('pending','approved','changes_requested','rejected','withdrawn','revoked'));

create or replace function public.revoke_provider_verification(target_provider_type text,target_provider_id uuid,revocation_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare
  note_value text:=btrim(coalesce(revocation_note,''));
  owner_id uuid;
  latest_request uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform manage permission is required.'; end if;
  if char_length(note_value)<3 or char_length(note_value)>1200 then raise exception 'A revocation reason is required.'; end if;

  if target_provider_type='professional' then
    update public.professional_profiles set verified=false,updated_at=now() where id=target_provider_id and verified=true returning user_id into owner_id;
  elsif target_provider_type='business' then
    update public.businesses set verified=false,updated_at=now() where id=target_provider_id and verified=true returning owner_user_id into owner_id;
  else
    raise exception 'Provider type is invalid.';
  end if;
  if owner_id is null then raise exception 'Verified provider was not found.'; end if;

  update public.services set status='paused'::public.service_status,active=false,updated_at=now()
  where (target_provider_type='professional' and professional_id=target_provider_id)
     or (target_provider_type='business' and business_id=target_provider_id);

  select id into latest_request from public.provider_verification_requests
  where applicant_user_id=owner_id and status='approved'
  order by reviewed_at desc nulls last,created_at desc limit 1;

  if latest_request is not null then
    update public.provider_verification_requests
      set status='revoked',review_note=note_value,reviewed_by=auth.uid(),reviewed_at=now(),updated_at=now()
      where id=latest_request;
    insert into public.provider_verification_events(verification_request_id,actor_user_id,actor_type,event_type,note)
    values(latest_request,auth.uid(),'admin','revoked',note_value);
  end if;

  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(owner_id,'provider_verification_revoked','Provider verification paused',note_value || ' Active services were paused until verification is approved again.');
end;
$$;
revoke all on function public.revoke_provider_verification(text,uuid,text) from public,anon;
grant execute on function public.revoke_provider_verification(text,uuid,text) to authenticated;
