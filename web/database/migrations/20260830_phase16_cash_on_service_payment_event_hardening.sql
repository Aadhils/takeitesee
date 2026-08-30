-- Phase 16 hardening: preserve immutable payment audit actors for customer/provider cash actions.

alter table public.booking_payment_events drop constraint if exists booking_payment_events_source_check;
alter table public.booking_payment_events add constraint booking_payment_events_source_check
  check (source in ('system','admin','gateway','migration','customer','provider'));

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
    perform set_config('takeitesee.payment_source','customer',true);
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

  perform set_config('takeitesee.payment_source','provider',true);
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
