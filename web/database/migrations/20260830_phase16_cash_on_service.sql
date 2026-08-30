-- Phase 16: Cash on Service / Pay at Service interim payment option.
-- Cash is collected directly by the provider after service completion.
-- It must never be treated as money collected by Takeitesee for provider payout settlement.

alter table public.bookings
  add column if not exists payment_method text not null default 'unselected',
  add column if not exists payment_method_updated_at timestamptz,
  add column if not exists payment_method_updated_by uuid,
  add column if not exists cash_collected_at timestamptz,
  add column if not exists cash_collected_by uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conrelid='public.bookings'::regclass and conname='bookings_payment_method_check'
  ) then
    alter table public.bookings add constraint bookings_payment_method_check
      check (payment_method in ('unselected','online_gateway','cash_on_service'));
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid='public.bookings'::regclass and conname='bookings_payment_method_updated_by_fkey'
  ) then
    alter table public.bookings add constraint bookings_payment_method_updated_by_fkey
      foreign key (payment_method_updated_by) references public.users(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid='public.bookings'::regclass and conname='bookings_cash_collected_by_fkey'
  ) then
    alter table public.bookings add constraint bookings_cash_collected_by_fkey
      foreign key (cash_collected_by) references public.users(id) on delete set null;
  end if;
  if not exists (
    select 1 from pg_constraint where conrelid='public.bookings'::regclass and conname='bookings_cash_collection_method_check'
  ) then
    alter table public.bookings add constraint bookings_cash_collection_method_check
      check (cash_collected_at is null or payment_method='cash_on_service');
  end if;
end $$;

-- Preserve the intent of bookings that already entered an online gateway flow.
update public.bookings b
set payment_method='online_gateway',
    payment_method_updated_at=coalesce(b.payment_method_updated_at,b.updated_at,b.created_at)
where b.payment_method='unselected'
  and exists (
    select 1 from public.booking_payment_intents i
    where i.booking_id=b.id and (i.gateway is not null or i.gateway_session_id is not null)
  );

create table if not exists public.booking_payment_method_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  from_method text,
  to_method text not null,
  changed_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (from_method is null or from_method in ('unselected','online_gateway','cash_on_service')),
  check (to_method in ('unselected','online_gateway','cash_on_service'))
);
create index if not exists booking_payment_method_events_booking_created_idx
  on public.booking_payment_method_events(booking_id,created_at);

alter table public.booking_payment_method_events enable row level security;
revoke insert,update,delete on public.booking_payment_method_events from anon,authenticated;
grant select on public.booking_payment_method_events to authenticated;

drop policy if exists booking_payment_method_events_participant_read on public.booking_payment_method_events;
create policy booking_payment_method_events_participant_read on public.booking_payment_method_events
for select to authenticated using (
  exists (
    select 1 from public.bookings b
    where b.id=booking_payment_method_events.booking_id
      and (
        b.customer_id=auth.uid()
        or (b.provider_type::text='professional' and exists(
          select 1 from public.professional_profiles p where p.id=b.professional_id and p.user_id=auth.uid()
        ))
        or (b.provider_type::text='business' and exists(
          select 1 from public.businesses x where x.id=b.business_id and x.owner_user_id=auth.uid()
        ))
        or public.is_super_admin()
        or public.admin_can_manage(null,null,null,null)
      )
  )
);

create or replace function public.log_booking_payment_method_event()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.payment_method=old.payment_method then return new; end if;
  insert into public.booking_payment_method_events(booking_id,from_method,to_method,changed_by)
  values(new.id,case when tg_op='INSERT' then null else old.payment_method end,new.payment_method,auth.uid());
  return new;
end;
$$;
revoke all on function public.log_booking_payment_method_event() from public,anon,authenticated;

drop trigger if exists bookings_log_payment_method_event_insert on public.bookings;
create trigger bookings_log_payment_method_event_insert
after insert on public.bookings
for each row execute function public.log_booking_payment_method_event();

drop trigger if exists bookings_log_payment_method_event_update on public.bookings;
create trigger bookings_log_payment_method_event_update
after update of payment_method on public.bookings
for each row execute function public.log_booking_payment_method_event();

create or replace function public.customer_set_booking_payment_method(target_booking_id uuid, target_method text)
returns public.bookings
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  booking_row public.bookings%rowtype;
  method_value text:=lower(btrim(coalesce(target_method,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if method_value not in ('online_gateway','cash_on_service') then raise exception 'Payment method is invalid.'; end if;

  select * into booking_row from public.bookings where id=target_booking_id for update;
  if not found then raise exception 'Booking was not found.'; end if;
  if booking_row.customer_id<>auth.uid() then raise exception 'You can change the payment method only for your own booking.'; end if;
  if booking_row.status not in ('confirmed','completed') then raise exception 'Choose a payment method after provider confirmation.'; end if;
  if booking_row.payment_status in ('pending','paid','refunded') then raise exception 'Payment method cannot be changed in the current payment state.'; end if;
  if booking_row.cash_collected_at is not null then raise exception 'Cash has already been recorded for this booking.'; end if;
  if booking_row.payment_method=method_value then return booking_row; end if;

  if method_value='cash_on_service' and exists (
    select 1 from public.booking_payment_intents i
    where i.booking_id=booking_row.id
      and (i.status in ('created','processing','requires_action','succeeded')
           or (i.gateway_session_id is not null and i.status<>'failed'))
  ) then
    raise exception 'An online payment attempt is still active or already succeeded. Cash cannot be selected.';
  end if;

  if booking_row.payment_status='failed' then
    perform set_config('takeitesee.payment_source','customer_payment_method',true);
    perform set_config('takeitesee.payment_note','Payment method changed after a failed online attempt.',true);
  end if;

  update public.bookings
  set payment_method=method_value,
      payment_method_updated_at=now(),
      payment_method_updated_by=auth.uid(),
      payment_status=case when payment_status='failed'::public.payment_status then 'unpaid'::public.payment_status else payment_status end,
      updated_at=now()
  where id=booking_row.id
  returning * into booking_row;

  return booking_row;
end;
$$;
revoke all on function public.customer_set_booking_payment_method(uuid,text) from public,anon;
grant execute on function public.customer_set_booking_payment_method(uuid,text) to authenticated;

create or replace function public.provider_confirm_cash_collection(target_booking_id uuid, collection_note text default null)
returns public.bookings
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  booking_row public.bookings%rowtype;
  note_value text:=nullif(btrim(coalesce(collection_note,'')),'');
  owns_booking boolean:=false;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if note_value is not null and char_length(note_value)>500 then raise exception 'Cash collection note must be 500 characters or fewer.'; end if;

  select * into booking_row from public.bookings where id=target_booking_id for update;
  if not found then raise exception 'Booking was not found.'; end if;

  if booking_row.provider_type::text='professional' then
    select exists(select 1 from public.professional_profiles p where p.id=booking_row.professional_id and p.user_id=auth.uid()) into owns_booking;
  else
    select exists(select 1 from public.businesses b where b.id=booking_row.business_id and b.owner_user_id=auth.uid()) into owns_booking;
  end if;
  if not owns_booking then raise exception 'Provider ownership is required.'; end if;
  if booking_row.payment_method<>'cash_on_service' then raise exception 'This booking is not configured for Cash on Service.'; end if;
  if booking_row.status<>'completed'::public.booking_status then raise exception 'Cash can be confirmed only after the service is completed.'; end if;
  if booking_row.payment_status='paid'::public.payment_status and booking_row.cash_collected_at is not null then return booking_row; end if;
  if booking_row.payment_status<>'unpaid'::public.payment_status then raise exception 'Cash cannot be confirmed in the current payment state.'; end if;

  perform set_config('takeitesee.payment_source','cash_on_service_provider',true);
  perform set_config('takeitesee.payment_note',coalesce(note_value,'Provider confirmed full cash payment after service completion.'),true);
  perform set_config('takeitesee.payment_reference','cash_on_service',true);

  update public.bookings
  set payment_status='paid'::public.payment_status,
      cash_collected_at=now(),
      cash_collected_by=auth.uid(),
      updated_at=now()
  where id=booking_row.id
  returning * into booking_row;

  return booking_row;
end;
$$;
revoke all on function public.provider_confirm_cash_collection(uuid,text) from public,anon;
grant execute on function public.provider_confirm_cash_collection(uuid,text) to authenticated;

-- Cash-on-service is not platform-collected money. Silently suppress any provider payout settlement row.
create or replace function public.skip_cash_on_service_provider_settlement()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(
    select 1 from public.bookings b
    where b.id=new.booking_id and b.payment_method='cash_on_service'
  ) then
    return null;
  end if;
  return new;
end;
$$;
revoke all on function public.skip_cash_on_service_provider_settlement() from public,anon,authenticated;

drop trigger if exists provider_settlements_skip_cash_on_service on public.provider_booking_settlements;
create trigger provider_settlements_skip_cash_on_service
before insert on public.provider_booking_settlements
for each row execute function public.skip_cash_on_service_provider_settlement();

-- Online payment intents must never be created while the customer has selected Cash on Service.
create or replace function public.create_booking_payment_intent(target_booking_id uuid, requested_idempotency_key text)
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

  select * into booking_row from public.bookings where id=target_booking_id for update;
  if not found then raise exception 'Booking was not found.'; end if;
  if booking_row.customer_id<>auth.uid() then raise exception 'You can create a payment only for your own booking.'; end if;
  if booking_row.status not in ('confirmed','completed') then raise exception 'Payment is available after provider confirmation.'; end if;
  if booking_row.payment_status='paid' then raise exception 'This booking is already paid.'; end if;
  if booking_row.payment_status='refunded' then raise exception 'A refunded booking cannot start a new payment.'; end if;
  if booking_row.payment_method='cash_on_service' then raise exception 'Cash on Service is selected. Switch the payment method before starting online checkout.'; end if;

  select * into intent_row from public.booking_payment_intents
  where customer_id=auth.uid() and idempotency_key=key_value limit 1;
  if found then
    if intent_row.booking_id<>target_booking_id then raise exception 'Idempotency key is already used for another booking.'; end if;
    return intent_row;
  end if;

  if booking_row.payment_method='unselected' then
    update public.bookings
    set payment_method='online_gateway',payment_method_updated_at=now(),payment_method_updated_by=auth.uid(),updated_at=now()
    where id=booking_row.id;
    booking_row.payment_method:='online_gateway';
  end if;

  select * into intent_row from public.booking_payment_intents
  where booking_id=target_booking_id and status in ('created','processing','requires_action')
  order by created_at desc limit 1;
  if found then return intent_row; end if;

  select coalesce(max(attempt_no),0)+1 into next_attempt from public.booking_payment_intents where booking_id=target_booking_id;
  minor_amount:=round(booking_row.quoted_price*100)::bigint;
  if minor_amount<=0 then raise exception 'Booking amount must be greater than zero for online payment.'; end if;

  insert into public.booking_payment_intents(booking_id,customer_id,attempt_no,idempotency_key,amount_minor,currency,status)
  values(booking_row.id,auth.uid(),next_attempt,key_value,minor_amount,booking_row.currency,'created')
  returning * into intent_row;
  return intent_row;
end;
$$;
revoke all on function public.create_booking_payment_intent(uuid,text) from public,anon;
grant execute on function public.create_booking_payment_intent(uuid,text) to authenticated;
