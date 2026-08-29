-- Phase 14 Module 5: full-booking gateway refund reconciliation.
-- Refunds are asynchronous. Booking payment_status changes to refunded only after verified SUCCESS.

create table if not exists public.booking_refunds (
  id uuid primary key,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  payment_intent_id uuid not null references public.booking_payment_intents(id) on delete restrict,
  attempt_no integer not null check (attempt_no > 0),
  gateway text not null check (char_length(gateway) between 2 and 40),
  gateway_order_id text not null,
  gateway_payment_id text,
  refund_id text not null,
  gateway_refund_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('INR','USD')),
  status text not null check (status in ('created','pending','onhold','succeeded','failed','cancelled','requires_review')),
  reason text not null,
  status_description text,
  refund_arn text,
  requested_speed text not null default 'STANDARD',
  accepted_speed text,
  processed_speed text,
  requested_by uuid references public.users(id) on delete set null,
  processed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(booking_id,attempt_no),
  unique(gateway,refund_id),
  check (char_length(gateway_order_id) between 1 and 200),
  check (gateway_payment_id is null or char_length(gateway_payment_id) <= 200),
  check (char_length(refund_id) between 3 and 40),
  check (gateway_refund_id is null or char_length(gateway_refund_id) <= 200),
  check (char_length(reason) between 3 and 100),
  check (status_description is null or char_length(status_description) <= 500),
  check (refund_arn is null or char_length(refund_arn) <= 200)
);
create index if not exists booking_refunds_booking_created_idx on public.booking_refunds(booking_id,created_at desc);
create index if not exists booking_refunds_status_created_idx on public.booking_refunds(status,created_at desc);
create unique index if not exists booking_refunds_one_active_idx on public.booking_refunds(booking_id)
  where status in ('created','pending','onhold','requires_review','succeeded');

create table if not exists public.booking_refund_events (
  id uuid primary key default gen_random_uuid(),
  refund_id uuid not null references public.booking_refunds(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  from_status text,
  to_status text not null,
  gateway_refund_id text,
  refund_arn text,
  status_description text,
  recorded_at timestamptz not null default now(),
  check (from_status is null or from_status in ('created','pending','onhold','succeeded','failed','cancelled','requires_review')),
  check (to_status in ('created','pending','onhold','succeeded','failed','cancelled','requires_review')),
  check (gateway_refund_id is null or char_length(gateway_refund_id) <= 200),
  check (refund_arn is null or char_length(refund_arn) <= 200),
  check (status_description is null or char_length(status_description) <= 500)
);
create index if not exists booking_refund_events_refund_recorded_idx on public.booking_refund_events(refund_id,recorded_at desc);

alter table public.booking_refunds enable row level security;
alter table public.booking_refund_events enable row level security;
revoke insert,update,delete on public.booking_refunds from anon,authenticated;
revoke insert,update,delete on public.booking_refund_events from anon,authenticated;

drop policy if exists booking_refunds_actor_read on public.booking_refunds;
create policy booking_refunds_actor_read on public.booking_refunds
for select to authenticated using (
  exists(
    select 1 from public.bookings b
    where b.id=booking_refunds.booking_id
      and (
        b.customer_id=auth.uid()
        or exists(select 1 from public.businesses biz where biz.id=b.business_id and biz.owner_user_id=auth.uid())
        or exists(select 1 from public.professional_profiles p where p.id=b.professional_id and p.user_id=auth.uid())
        or public.is_super_admin()
        or public.admin_can_view(null,null,null,b.service_id)
      )
  )
);

drop policy if exists booking_refund_events_actor_read on public.booking_refund_events;
create policy booking_refund_events_actor_read on public.booking_refund_events
for select to authenticated using (
  exists(select 1 from public.booking_refunds r where r.id=booking_refund_events.refund_id)
);

create or replace function public.record_booking_refund_event()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and
     new.status is not distinct from old.status and
     new.gateway_refund_id is not distinct from old.gateway_refund_id and
     new.refund_arn is not distinct from old.refund_arn and
     new.status_description is not distinct from old.status_description then
    return new;
  end if;
  insert into public.booking_refund_events(refund_id,booking_id,from_status,to_status,gateway_refund_id,refund_arn,status_description)
  values(new.id,new.booking_id,case when tg_op='INSERT' then null else old.status end,new.status,new.gateway_refund_id,new.refund_arn,new.status_description);
  return new;
end;
$$;
revoke all on function public.record_booking_refund_event() from public,anon,authenticated;
drop trigger if exists booking_refund_event_history on public.booking_refunds;
create trigger booking_refund_event_history
after insert or update of status,gateway_refund_id,refund_arn,status_description on public.booking_refunds
for each row execute function public.record_booking_refund_event();

create or replace function public.admin_create_booking_refund_request(target_booking_id uuid, refund_reason text)
returns public.booking_refunds
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  booking_row public.bookings%rowtype;
  intent_row public.booking_payment_intents%rowtype;
  refund_row public.booking_refunds%rowtype;
  settlement_row public.provider_booking_settlements%rowtype;
  payout_row public.provider_payout_batches%rowtype;
  next_attempt integer;
  refund_uuid uuid:=gen_random_uuid();
  reason_value text:=btrim(coalesce(refund_reason,''));
  review_required boolean:=false;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then
    raise exception 'Platform payment management permission is required.';
  end if;
  if char_length(reason_value)<3 or char_length(reason_value)>100 then raise exception 'Refund reason must be 3 to 100 characters.'; end if;

  select * into booking_row from public.bookings where id=target_booking_id for update;
  if not found then raise exception 'Booking was not found.'; end if;
  if booking_row.payment_status<>'paid'::public.payment_status then raise exception 'Only a paid booking can start a gateway refund.'; end if;
  if booking_row.status not in ('cancelled'::public.booking_status,'completed'::public.booking_status) then
    raise exception 'Refunds are available only after a booking is cancelled or completed.';
  end if;

  select * into refund_row from public.booking_refunds
  where booking_id=target_booking_id and status in ('created','pending','onhold','requires_review','succeeded')
  order by created_at desc limit 1;
  if found then return refund_row; end if;

  select * into intent_row from public.booking_payment_intents
  where booking_id=target_booking_id and gateway='cashfree' and status='succeeded'
  order by created_at desc limit 1;
  if not found or intent_row.gateway_session_id is null then
    raise exception 'No successful Cashfree payment is linked to this booking. Use the manual refund path only for non-gateway payments.';
  end if;
  if intent_row.amount_minor<>round(booking_row.quoted_price*100)::bigint or intent_row.currency<>booking_row.currency then
    raise exception 'Gateway payment amount or currency does not match the booking.';
  end if;

  select * into settlement_row from public.provider_booking_settlements where booking_id=target_booking_id;
  if found then
    if settlement_row.status='paid' then
      review_required:=true;
    elsif settlement_row.status='assigned' then
      select b.* into payout_row
      from public.provider_payout_items i
      join public.provider_payout_batches b on b.id=i.payout_batch_id
      where i.settlement_id=settlement_row.id
      order by b.created_at desc limit 1;
      if found and payout_row.status='ready' then
        perform public.admin_cancel_provider_payout(payout_row.id,'Booking refund initiated before provider transfer.');
      elsif found and payout_row.status in ('processing','paid') then
        review_required:=true;
      end if;
    end if;
  end if;

  select coalesce(max(attempt_no),0)+1 into next_attempt from public.booking_refunds where booking_id=target_booking_id;
  insert into public.booking_refunds(
    id,booking_id,payment_intent_id,attempt_no,gateway,gateway_order_id,gateway_payment_id,
    refund_id,amount_minor,currency,status,reason,requested_by
  ) values(
    refund_uuid,booking_row.id,intent_row.id,next_attempt,'cashfree',intent_row.gateway_session_id,intent_row.gateway_payment_id,
    'tisref'||replace(refund_uuid::text,'-',''),intent_row.amount_minor,intent_row.currency,
    case when review_required then 'requires_review' else 'created' end,reason_value,auth.uid()
  ) returning * into refund_row;

  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'finance.refund.requested','booking_refund',refund_row.id::text,jsonb_build_object(
    'booking_id',booking_row.id,'booking_reference',booking_row.booking_reference,'refund_id',refund_row.refund_id,
    'amount_minor',refund_row.amount_minor,'currency',refund_row.currency,'requires_review',review_required
  ));
  return refund_row;
end;
$$;
revoke all on function public.admin_create_booking_refund_request(uuid,text) from public,anon;
grant execute on function public.admin_create_booking_refund_request(uuid,text) to authenticated;

create or replace function public.gateway_apply_booking_refund_result(
  target_refund_id uuid,
  target_gateway_status text,
  target_gateway_refund_id text default null,
  target_status_description text default null,
  target_refund_arn text default null,
  target_accepted_speed text default null,
  target_processed_speed text default null,
  target_processed_at timestamptz default null
)
returns public.booking_refunds
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  refund_row public.booking_refunds%rowtype;
  booking_row public.bookings%rowtype;
  settlement_row public.provider_booking_settlements%rowtype;
  payout_status text;
  status_value text:=upper(btrim(coalesce(target_gateway_status,'')));
  next_status text;
  description_value text:=nullif(left(btrim(coalesce(target_status_description,'')),500),'');
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for gateway refund reconciliation.'; end if;
  next_status:=case status_value when 'SUCCESS' then 'succeeded' when 'PENDING' then 'pending' when 'ONHOLD' then 'onhold' when 'FAILED' then 'failed' when 'CANCELLED' then 'cancelled' else null end;
  if next_status is null then raise exception 'Gateway refund status is unsupported.'; end if;

  select * into refund_row from public.booking_refunds where id=target_refund_id for update;
  if not found then raise exception 'Refund record was not found.'; end if;
  if refund_row.status='succeeded' then return refund_row; end if;
  if refund_row.status='requires_review' then raise exception 'Refund requires finance review before gateway processing.'; end if;
  if refund_row.status in ('failed','cancelled') and next_status not in ('failed','cancelled') then return refund_row; end if;

  if next_status='succeeded' then
    select * into settlement_row from public.provider_booking_settlements where booking_id=refund_row.booking_id;
    if found and settlement_row.status='paid' then raise exception 'Provider payout already completed. Refund cannot finalize without recovery review.'; end if;
    if found and settlement_row.status='assigned' then
      select b.status into payout_status from public.provider_payout_items i join public.provider_payout_batches b on b.id=i.payout_batch_id
      where i.settlement_id=settlement_row.id order by b.created_at desc limit 1;
      if payout_status in ('processing','paid') then raise exception 'Provider payout is already processing or paid. Refund cannot finalize automatically.'; end if;
    end if;
  end if;

  update public.booking_refunds set
    status=next_status,
    gateway_refund_id=coalesce(nullif(btrim(coalesce(target_gateway_refund_id,'')),''),gateway_refund_id),
    status_description=description_value,
    refund_arn=coalesce(nullif(btrim(coalesce(target_refund_arn,'')),''),refund_arn),
    accepted_speed=coalesce(nullif(btrim(coalesce(target_accepted_speed,'')),''),accepted_speed),
    processed_speed=coalesce(nullif(btrim(coalesce(target_processed_speed,'')),''),processed_speed),
    processed_at=case when next_status='succeeded' then coalesce(target_processed_at,processed_at,now()) else processed_at end,
    updated_at=now()
  where id=refund_row.id returning * into refund_row;

  if next_status='succeeded' then
    select * into booking_row from public.bookings where id=refund_row.booking_id for update;
    if booking_row.payment_status='paid'::public.payment_status then
      perform set_config('takeitesee.payment_source','gateway',true);
      perform set_config('takeitesee.payment_note','Cashfree refund completed successfully.',true);
      perform set_config('takeitesee.payment_reference',coalesce(refund_row.refund_arn,refund_row.gateway_refund_id,refund_row.refund_id),true);
      update public.bookings set payment_status='refunded',updated_at=now() where id=booking_row.id;
    end if;
  end if;
  return refund_row;
end;
$$;
revoke all on function public.gateway_apply_booking_refund_result(uuid,text,text,text,text,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.gateway_apply_booking_refund_result(uuid,text,text,text,text,text,text,timestamptz) to service_role;

create or replace function public.prevent_manual_gateway_refund()
returns trigger
language plpgsql set search_path=public,pg_temp as $$
begin
  if new.payment_status='refunded'::public.payment_status and old.payment_status='paid'::public.payment_status
     and coalesce(current_setting('takeitesee.payment_source',true),'')<>'gateway'
     and exists(select 1 from public.booking_payment_intents i where i.booking_id=new.id and i.gateway='cashfree' and i.status='succeeded') then
    raise exception 'Gateway-paid bookings must use the verified gateway refund workflow.';
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_prevent_manual_gateway_refund on public.bookings;
create trigger bookings_prevent_manual_gateway_refund
before update of payment_status on public.bookings
for each row execute function public.prevent_manual_gateway_refund();

create or replace function public.admin_prepare_provider_payout(target_owner_user_id uuid,target_currency text)
returns public.provider_payout_batches
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  policy_row public.platform_finance_policies%rowtype;
  batch_row public.provider_payout_batches%rowtype;
  identity_row public.provider_booking_settlements%rowtype;
  gross_value bigint; fee_value bigint; net_value bigint; count_value integer;
  currency_value text:=upper(btrim(coalesce(target_currency,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  select * into policy_row from public.platform_finance_policies where currency=currency_value and active=true;
  if not found then raise exception 'An active finance policy is required before preparing payouts.'; end if;
  if exists(select 1 from public.provider_payout_batches where owner_user_id=target_owner_user_id and currency=currency_value and status in ('ready','processing')) then raise exception 'This provider already has an open payout batch.'; end if;

  update public.provider_booking_settlements s set status='available',updated_at=now()
  where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='held' and s.eligible_at<=now()
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'));

  select * into identity_row from public.provider_booking_settlements s
  where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='available'
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'))
  order by s.created_at limit 1;
  if not found then raise exception 'No provider funds are currently available for payout.'; end if;

  select count(*)::int,coalesce(sum(s.gross_minor),0)::bigint,coalesce(sum(s.platform_fee_minor),0)::bigint,coalesce(sum(s.provider_net_minor),0)::bigint
  into count_value,gross_value,fee_value,net_value
  from public.provider_booking_settlements s
  where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='available'
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'));
  if count_value=0 or net_value<=0 then raise exception 'No provider funds are currently available for payout.'; end if;
  if net_value<policy_row.minimum_payout_minor then raise exception 'Available balance is below the configured minimum payout.'; end if;

  insert into public.provider_payout_batches(provider_type,professional_id,business_id,owner_user_id,currency,status,settlement_count,gross_minor,platform_fee_minor,provider_net_minor,created_by)
  values(identity_row.provider_type,identity_row.professional_id,identity_row.business_id,target_owner_user_id,currency_value,'ready',count_value,gross_value,fee_value,net_value,auth.uid()) returning * into batch_row;

  insert into public.provider_payout_items(payout_batch_id,settlement_id,provider_net_minor)
  select batch_row.id,s.id,s.provider_net_minor from public.provider_booking_settlements s
  where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='available'
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'));
  update public.provider_booking_settlements s set status='assigned',updated_at=now()
  where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id);

  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'finance.payout.prepared','provider_payout',batch_row.id::text,jsonb_build_object('owner_user_id',target_owner_user_id,'currency',currency_value,'settlement_count',count_value,'gross_minor',gross_value,'platform_fee_minor',fee_value,'provider_net_minor',net_value));
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(target_owner_user_id,'provider_payout_prepared','Provider payout prepared','A provider payout batch has been prepared for '||currency_value||' '||to_char(net_value/100.0,'FM9999999990.00')||'.');
  return batch_row;
end;
$$;
revoke all on function public.admin_prepare_provider_payout(uuid,text) from public,anon;
grant execute on function public.admin_prepare_provider_payout(uuid,text) to authenticated;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (event_type = any(array[
  'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
  'reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded',
  'review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
  'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
  'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
  'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected',
  'provider_reverification_required','provider_suspended','provider_restored',
  'provider_payout_prepared','provider_payout_cancelled','provider_payout_processing','provider_payout_paid','provider_payout_failed','provider_payout_reversed','provider_payout_destination_updated',
  'refund_requested','refund_onhold','refund_failed','refund_cancelled'
]));

create or replace function public.emit_refund_notifications()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  booking_row public.bookings%rowtype;
  provider_user_id uuid;
  event_value text;
  title_value text;
  body_value text;
begin
  if tg_op='UPDATE' and new.status=old.status then return new; end if;
  if new.status not in ('created','pending','onhold','failed','cancelled') then return new; end if;
  select * into booking_row from public.bookings where id=new.booking_id;
  if booking_row.provider_type::text='business' then select owner_user_id into provider_user_id from public.businesses where id=booking_row.business_id;
  else select user_id into provider_user_id from public.professional_profiles where id=booking_row.professional_id; end if;
  if new.status in ('created','pending') then event_value:='refund_requested'; title_value:='Refund processing'; body_value:='A full refund for '||booking_row.service_name_snapshot||' is being processed.';
  elsif new.status='onhold' then event_value:='refund_onhold'; title_value:='Refund under review'; body_value:='The refund for '||booking_row.service_name_snapshot||' is temporarily on hold with the payment gateway.';
  elsif new.status='failed' then event_value:='refund_failed'; title_value:='Refund needs attention'; body_value:='The refund for '||booking_row.service_name_snapshot||' could not be completed.';
  else event_value:='refund_cancelled'; title_value:='Refund cancelled'; body_value:='The refund for '||booking_row.service_name_snapshot||' was cancelled before completion.'; end if;
  insert into public.notifications(recipient_user_id,booking_id,event_type,title,body)
  values(booking_row.customer_id,booking_row.id,event_value,title_value,body_value);
  if provider_user_id is not null and provider_user_id is distinct from booking_row.customer_id then
    insert into public.notifications(recipient_user_id,booking_id,event_type,title,body)
    values(provider_user_id,booking_row.id,event_value,title_value,body_value);
  end if;
  return new;
end;
$$;
revoke all on function public.emit_refund_notifications() from public,anon,authenticated;
drop trigger if exists booking_refunds_emit_notifications on public.booking_refunds;
create trigger booking_refunds_emit_notifications
after insert or update of status on public.booking_refunds
for each row execute function public.emit_refund_notifications();