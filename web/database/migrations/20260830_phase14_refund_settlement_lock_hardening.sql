-- Phase 14 Module 5 hardening: serialize refund reservation against provider settlement preparation.

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

  -- Serialize this booking's settlement against payout preparation while the refund reservation is created.
  select * into settlement_row from public.provider_booking_settlements where booking_id=target_booking_id for update;
  if found then
    if settlement_row.status='paid' then
      review_required:=true;
    elsif settlement_row.status='assigned' then
      select b.* into payout_row
      from public.provider_payout_items i
      join public.provider_payout_batches b on b.id=i.payout_batch_id
      where i.settlement_id=settlement_row.id
      order by b.created_at desc limit 1
      for update of b;
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
