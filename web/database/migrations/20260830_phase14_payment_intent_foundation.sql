-- Phase 14 Module 1: gateway-neutral payment intent and webhook reconciliation foundation.
-- This migration does not contact a payment gateway or move money.

create table if not exists public.booking_payment_intents (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  customer_id uuid not null references public.users(id) on delete cascade,
  attempt_no integer not null check (attempt_no > 0),
  idempotency_key text not null,
  gateway text,
  gateway_session_id text,
  gateway_payment_id text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('INR','USD')),
  status text not null default 'created' check (status in ('created','processing','requires_action','succeeded','failed','cancelled','expired')),
  failure_code text,
  failure_message text,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(idempotency_key) between 8 and 120),
  check (gateway is null or char_length(gateway) between 2 and 40),
  check (gateway_session_id is null or char_length(gateway_session_id) <= 200),
  check (gateway_payment_id is null or char_length(gateway_payment_id) <= 200),
  check (failure_code is null or char_length(failure_code) <= 120),
  check (failure_message is null or char_length(failure_message) <= 500),
  unique(customer_id,idempotency_key),
  unique(booking_id,attempt_no)
);

create unique index if not exists booking_payment_intents_one_active_idx
  on public.booking_payment_intents(booking_id)
  where status in ('created','processing','requires_action');
create index if not exists booking_payment_intents_booking_created_idx
  on public.booking_payment_intents(booking_id,created_at desc);
create index if not exists booking_payment_intents_customer_created_idx
  on public.booking_payment_intents(customer_id,created_at desc);

create table if not exists public.payment_gateway_webhook_events (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  gateway_event_id text not null,
  event_type text not null,
  payload jsonb not null default '{}'::jsonb,
  payload_sha256 text not null,
  processing_status text not null default 'received' check (processing_status in ('received','processing','processed','ignored','failed')),
  processing_error text,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  unique(gateway,gateway_event_id),
  check (char_length(gateway) between 2 and 40),
  check (char_length(gateway_event_id) between 1 and 240),
  check (char_length(event_type) between 1 and 160),
  check (char_length(payload_sha256) = 64),
  check (processing_error is null or char_length(processing_error) <= 1200)
);
create index if not exists payment_gateway_webhook_events_status_received_idx
  on public.payment_gateway_webhook_events(processing_status,received_at);

alter table public.booking_payment_intents enable row level security;
alter table public.payment_gateway_webhook_events enable row level security;

revoke insert,update,delete on public.booking_payment_intents from anon,authenticated;
revoke all on public.payment_gateway_webhook_events from anon,authenticated;

-- Customers can read their own payment attempts. Platform-manage admins can inspect all.
drop policy if exists payment_intents_customer_read on public.booking_payment_intents;
create policy payment_intents_customer_read on public.booking_payment_intents
for select to authenticated using (
  customer_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_manage(null,null,null,null)
);

create or replace function public.create_booking_payment_intent(
  target_booking_id uuid,
  requested_idempotency_key text
)
returns public.booking_payment_intents
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  booking_row public.bookings%rowtype;
  intent_row public.booking_payment_intents%rowtype;
  key_value text:=btrim(coalesce(requested_idempotency_key,''));
  next_attempt integer;
  minor_amount bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if char_length(key_value)<8 or char_length(key_value)>120 then raise exception 'Payment idempotency key must be 8 to 120 characters.'; end if;

  select * into intent_row
  from public.booking_payment_intents
  where customer_id=auth.uid() and idempotency_key=key_value
  limit 1;
  if found then
    if intent_row.booking_id<>target_booking_id then raise exception 'Idempotency key is already used for another booking.'; end if;
    return intent_row;
  end if;

  select * into booking_row from public.bookings where id=target_booking_id for update;
  if not found then raise exception 'Booking was not found.'; end if;
  if booking_row.customer_id<>auth.uid() then raise exception 'You can create a payment only for your own booking.'; end if;
  if booking_row.status not in ('confirmed','completed') then raise exception 'Payment is available after provider confirmation.'; end if;
  if booking_row.payment_status='paid' then raise exception 'This booking is already paid.'; end if;
  if booking_row.payment_status='refunded' then raise exception 'A refunded booking cannot start a new payment.'; end if;

  select * into intent_row
  from public.booking_payment_intents
  where booking_id=target_booking_id and status in ('created','processing','requires_action')
  order by created_at desc limit 1;
  if found then return intent_row; end if;

  select coalesce(max(attempt_no),0)+1 into next_attempt from public.booking_payment_intents where booking_id=target_booking_id;
  minor_amount:=round(booking_row.quoted_price*100)::bigint;
  if minor_amount<=0 then raise exception 'Booking amount must be greater than zero for online payment.'; end if;

  insert into public.booking_payment_intents(
    booking_id,customer_id,attempt_no,idempotency_key,amount_minor,currency,status
  ) values (
    booking_row.id,auth.uid(),next_attempt,key_value,minor_amount,booking_row.currency,'created'
  ) returning * into intent_row;

  return intent_row;
end;
$$;
revoke all on function public.create_booking_payment_intent(uuid,text) from public,anon;
grant execute on function public.create_booking_payment_intent(uuid,text) to authenticated;

-- Service-role gateway adapter registers a checkout/order session and moves booking payment to pending.
create or replace function public.gateway_attach_payment_session(
  target_intent_id uuid,
  target_gateway text,
  target_gateway_session_id text,
  target_expires_at timestamptz default null
)
returns public.booking_payment_intents
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  intent_row public.booking_payment_intents%rowtype;
  booking_row public.bookings%rowtype;
  gateway_value text:=lower(btrim(coalesce(target_gateway,'')));
  session_value text:=btrim(coalesce(target_gateway_session_id,''));
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for gateway session registration.'; end if;
  if char_length(gateway_value)<2 or char_length(gateway_value)>40 then raise exception 'Gateway name is invalid.'; end if;
  if char_length(session_value)<1 or char_length(session_value)>200 then raise exception 'Gateway session reference is invalid.'; end if;

  select * into intent_row from public.booking_payment_intents where id=target_intent_id for update;
  if not found then raise exception 'Payment intent was not found.'; end if;
  if intent_row.status not in ('created','processing') then raise exception 'Payment intent cannot attach a gateway session in its current state.'; end if;

  update public.booking_payment_intents
  set gateway=gateway_value,gateway_session_id=session_value,status='requires_action',expires_at=target_expires_at,updated_at=now()
  where id=intent_row.id returning * into intent_row;

  select * into booking_row from public.bookings where id=intent_row.booking_id for update;
  if booking_row.payment_status in ('unpaid','failed') then
    perform set_config('takeitesee.payment_source','gateway',true);
    perform set_config('takeitesee.payment_note','Gateway checkout session created.',true);
    perform set_config('takeitesee.payment_reference',session_value,true);
    update public.bookings set payment_status='pending',updated_at=now() where id=booking_row.id;
  end if;
  return intent_row;
end;
$$;
revoke all on function public.gateway_attach_payment_session(uuid,text,text,timestamptz) from public,anon,authenticated;
grant execute on function public.gateway_attach_payment_session(uuid,text,text,timestamptz) to service_role;

-- Idempotent service-role result application. Existing booking triggers produce ledger + notifications.
create or replace function public.gateway_apply_payment_result(
  target_intent_id uuid,
  result_status text,
  target_gateway_payment_id text default null,
  result_code text default null,
  result_message text default null
)
returns public.booking_payment_intents
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  intent_row public.booking_payment_intents%rowtype;
  booking_row public.bookings%rowtype;
  payment_ref text:=nullif(btrim(coalesce(target_gateway_payment_id,'')),'');
  message_value text:=nullif(btrim(coalesce(result_message,'')),'');
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for gateway result application.'; end if;
  if result_status not in ('succeeded','failed','cancelled','expired') then raise exception 'Gateway payment result is invalid.'; end if;

  select * into intent_row from public.booking_payment_intents where id=target_intent_id for update;
  if not found then raise exception 'Payment intent was not found.'; end if;
  if intent_row.status in ('succeeded','failed','cancelled','expired') then return intent_row; end if;

  update public.booking_payment_intents
  set status=result_status,
      gateway_payment_id=coalesce(payment_ref,gateway_payment_id),
      failure_code=case when result_status='failed' then nullif(btrim(coalesce(result_code,'')),'') else null end,
      failure_message=case when result_status='failed' then message_value else null end,
      updated_at=now()
  where id=intent_row.id returning * into intent_row;

  select * into booking_row from public.bookings where id=intent_row.booking_id for update;
  if result_status='succeeded' and booking_row.payment_status in ('unpaid','pending','failed') then
    perform set_config('takeitesee.payment_source','gateway',true);
    perform set_config('takeitesee.payment_note','Gateway payment succeeded.',true);
    perform set_config('takeitesee.payment_reference',coalesce(payment_ref,intent_row.gateway_session_id,''),true);
    update public.bookings set payment_status='paid',updated_at=now() where id=booking_row.id;
  elsif result_status='failed' and booking_row.payment_status='pending' then
    perform set_config('takeitesee.payment_source','gateway',true);
    perform set_config('takeitesee.payment_note',coalesce(message_value,'Gateway payment failed.'),true);
    perform set_config('takeitesee.payment_reference',coalesce(payment_ref,intent_row.gateway_session_id,''),true);
    update public.bookings set payment_status='failed',updated_at=now() where id=booking_row.id;
  elsif result_status in ('cancelled','expired') and booking_row.payment_status='pending' then
    perform set_config('takeitesee.payment_source','gateway',true);
    perform set_config('takeitesee.payment_note','Gateway checkout ended without payment.',true);
    perform set_config('takeitesee.payment_reference',coalesce(intent_row.gateway_session_id,''),true);
    update public.bookings set payment_status='unpaid',updated_at=now() where id=booking_row.id;
  end if;
  return intent_row;
end;
$$;
revoke all on function public.gateway_apply_payment_result(uuid,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gateway_apply_payment_result(uuid,text,text,text,text) to service_role;

create or replace function public.gateway_record_webhook_event(
  target_gateway text,
  target_gateway_event_id text,
  target_event_type text,
  target_payload jsonb,
  target_payload_sha256 text
)
returns public.payment_gateway_webhook_events
language plpgsql security definer set search_path=public,pg_temp as $$
declare event_row public.payment_gateway_webhook_events%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for webhook ingestion.'; end if;
  insert into public.payment_gateway_webhook_events(gateway,gateway_event_id,event_type,payload,payload_sha256)
  values(lower(btrim(target_gateway)),btrim(target_gateway_event_id),btrim(target_event_type),coalesce(target_payload,'{}'::jsonb),lower(btrim(target_payload_sha256)))
  on conflict(gateway,gateway_event_id) do update set gateway_event_id=excluded.gateway_event_id
  returning * into event_row;
  return event_row;
end;
$$;
revoke all on function public.gateway_record_webhook_event(text,text,text,jsonb,text) from public,anon,authenticated;
grant execute on function public.gateway_record_webhook_event(text,text,text,jsonb,text) to service_role;

create or replace function public.gateway_finish_webhook_event(
  target_event_id uuid,
  target_processing_status text,
  target_processing_error text default null
)
returns public.payment_gateway_webhook_events
language plpgsql security definer set search_path=public,pg_temp as $$
declare event_row public.payment_gateway_webhook_events%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for webhook processing.'; end if;
  if target_processing_status not in ('processed','ignored','failed') then raise exception 'Webhook result status is invalid.'; end if;
  update public.payment_gateway_webhook_events
  set processing_status=target_processing_status,processing_error=nullif(btrim(coalesce(target_processing_error,'')),''),processed_at=now()
  where id=target_event_id returning * into event_row;
  if not found then raise exception 'Webhook event was not found.'; end if;
  return event_row;
end;
$$;
revoke all on function public.gateway_finish_webhook_event(uuid,text,text) from public,anon,authenticated;
grant execute on function public.gateway_finish_webhook_event(uuid,text,text) to service_role;
