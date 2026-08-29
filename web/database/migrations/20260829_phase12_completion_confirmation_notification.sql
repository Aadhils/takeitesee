-- Phase 12 Module 8: customer completion acknowledgement notifies the provider exactly once.
create or replace function public.customer_confirm_service_completion(target_booking_id uuid)
returns public.booking_closeouts
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  b public.bookings%rowtype;
  c public.booking_closeouts%rowtype;
  provider_user_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where id=target_booking_id and customer_id=auth.uid();
  if not found or b.status<>'completed' then raise exception 'Only your completed booking can be confirmed.'; end if;

  select * into c from public.booking_closeouts where booking_id=b.id for update;
  if c.customer_completion_confirmed_at is not null then return c; end if;

  insert into public.booking_closeouts(booking_id,attendance_outcome,state,service_completed_at,customer_completion_confirmed_at,updated_at)
  values(b.id,'service_completed','open',coalesce(b.updated_at,now()),now(),now())
  on conflict(booking_id) do update set
    customer_completion_confirmed_at=now(),
    state=case when booking_closeouts.state='awaiting_customer' then 'open' else booking_closeouts.state end,
    updated_at=now()
  returning * into c;

  insert into public.booking_closeout_events(booking_id,actor_user_id,actor_type,event_type,note)
  values(b.id,auth.uid(),'customer','customer_completion_confirmed','Customer acknowledged service completion.');

  if b.provider_type='professional' then
    select user_id into provider_user_id from public.professional_profiles where id=b.professional_id;
  else
    select owner_user_id into provider_user_id from public.businesses where id=b.business_id;
  end if;
  if provider_user_id is not null and provider_user_id is distinct from b.customer_id then
    insert into public.notifications(recipient_user_id,booking_id,event_type,title,body)
    values(provider_user_id,b.id,'completion_confirmed','Customer confirmed completion','The customer confirmed that the service was completed.');
  end if;
  return c;
end;
$$;
