-- Phase 14 Module 3 hardening: keep cancelled payout batch snapshots immutable
-- and avoid UUID aggregates while preparing payout batches.

create or replace function public.reconcile_provider_booking_settlement(target_booking_id uuid)
returns public.provider_booking_settlements
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  booking_row public.bookings%rowtype;
  policy_row public.platform_finance_policies%rowtype;
  settlement_row public.provider_booking_settlements%rowtype;
  owner_id uuid;
  completion_at timestamptz;
  eligible_time timestamptz;
  gross_value bigint;
  fee_value bigint;
  net_value bigint;
  batch_id uuid;
  remaining_count integer;
  remaining_gross bigint;
  remaining_fee bigint;
  remaining_net bigint;
begin
  select * into booking_row from public.bookings where id=target_booking_id;
  if not found then return null; end if;

  select * into settlement_row from public.provider_booking_settlements where booking_id=target_booking_id;

  if booking_row.status='completed'::public.booking_status and booking_row.payment_status='paid'::public.payment_status then
    if found then return settlement_row; end if;

    select * into policy_row from public.platform_finance_policies where currency=booking_row.currency and active=true;
    if not found then return null; end if;

    if booking_row.provider_type::text='business' then
      select owner_user_id into owner_id from public.businesses where id=booking_row.business_id;
    else
      select user_id into owner_id from public.professional_profiles where id=booking_row.professional_id;
    end if;
    if owner_id is null then raise exception 'Provider owner was not found for finance settlement.'; end if;

    select max(created_at) into completion_at
    from public.booking_status_history
    where booking_id=booking_row.id and to_status='completed'::public.booking_status;
    completion_at:=coalesce(completion_at,booking_row.updated_at,now());
    eligible_time:=completion_at + make_interval(days=>policy_row.settlement_hold_days);
    gross_value:=round(booking_row.quoted_price*100)::bigint;
    if gross_value<=0 then raise exception 'Booking amount must be positive for finance settlement.'; end if;
    fee_value:=round((gross_value::numeric*policy_row.commission_bps::numeric)/10000)::bigint;
    net_value:=gross_value-fee_value;

    insert into public.provider_booking_settlements(
      booking_id,provider_type,professional_id,business_id,owner_user_id,currency,
      gross_minor,commission_bps,platform_fee_minor,provider_net_minor,policy_version,status,eligible_at
    ) values (
      booking_row.id,booking_row.provider_type::text,booking_row.professional_id,booking_row.business_id,owner_id,booking_row.currency,
      gross_value,policy_row.commission_bps,fee_value,net_value,policy_row.version,
      case when eligible_time<=now() then 'available' else 'held' end,eligible_time
    ) returning * into settlement_row;
    return settlement_row;
  end if;

  if found and settlement_row.status in ('held','available','assigned')
     and (booking_row.payment_status='refunded'::public.payment_status or booking_row.status='cancelled'::public.booking_status) then
    if settlement_row.status='assigned' then
      select payout_batch_id into batch_id from public.provider_payout_items where settlement_id=settlement_row.id limit 1;
      if batch_id is not null and exists(select 1 from public.provider_payout_batches where id=batch_id and status='ready') then
        delete from public.provider_payout_items where settlement_id=settlement_row.id;

        select count(i.id)::int,
               coalesce(sum(st.gross_minor),0)::bigint,
               coalesce(sum(st.platform_fee_minor),0)::bigint,
               coalesce(sum(i.provider_net_minor),0)::bigint
        into remaining_count,remaining_gross,remaining_fee,remaining_net
        from public.provider_payout_items i
        join public.provider_booking_settlements st on st.id=i.settlement_id
        where i.payout_batch_id=batch_id;

        if remaining_count=0 then
          -- Keep original financial totals as an immutable snapshot; only cancel the batch.
          update public.provider_payout_batches
          set status='cancelled',failure_message='All assigned settlements were reversed before transfer.',updated_at=now()
          where id=batch_id;
        else
          update public.provider_payout_batches
          set settlement_count=remaining_count,gross_minor=remaining_gross,
              platform_fee_minor=remaining_fee,provider_net_minor=remaining_net,updated_at=now()
          where id=batch_id;
        end if;
      else
        -- A processing/paid payout cannot be silently altered by booking reconciliation.
        return settlement_row;
      end if;
    end if;

    update public.provider_booking_settlements
    set status='reversed',
        reversal_reason=case when booking_row.payment_status='refunded'::public.payment_status then 'Booking payment refunded.' else 'Booking cancelled.' end,
        reversed_at=now(),updated_at=now()
    where id=settlement_row.id
    returning * into settlement_row;
  end if;
  return settlement_row;
end;
$$;
revoke all on function public.reconcile_provider_booking_settlement(uuid) from public,anon,authenticated;
grant execute on function public.reconcile_provider_booking_settlement(uuid) to service_role;

create or replace function public.admin_prepare_provider_payout(target_owner_user_id uuid,target_currency text)
returns public.provider_payout_batches
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  policy_row public.platform_finance_policies%rowtype;
  batch_row public.provider_payout_batches%rowtype;
  identity_row public.provider_booking_settlements%rowtype;
  gross_value bigint;
  fee_value bigint;
  net_value bigint;
  count_value integer;
  currency_value text:=upper(btrim(coalesce(target_currency,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  select * into policy_row from public.platform_finance_policies where currency=currency_value and active=true;
  if not found then raise exception 'An active finance policy is required before preparing payouts.'; end if;
  if exists(select 1 from public.provider_payout_batches where owner_user_id=target_owner_user_id and currency=currency_value and status in ('ready','processing')) then
    raise exception 'This provider already has an open payout batch.';
  end if;

  update public.provider_booking_settlements set status='available',updated_at=now()
  where owner_user_id=target_owner_user_id and currency=currency_value and status='held' and eligible_at<=now();

  select * into identity_row
  from public.provider_booking_settlements
  where owner_user_id=target_owner_user_id and currency=currency_value and status='available'
  order by created_at limit 1;
  if not found then raise exception 'No provider funds are currently available for payout.'; end if;

  select count(*)::int,
         coalesce(sum(gross_minor),0)::bigint,
         coalesce(sum(platform_fee_minor),0)::bigint,
         coalesce(sum(provider_net_minor),0)::bigint
  into count_value,gross_value,fee_value,net_value
  from public.provider_booking_settlements
  where owner_user_id=target_owner_user_id and currency=currency_value and status='available';

  if count_value=0 or net_value<=0 then raise exception 'No provider funds are currently available for payout.'; end if;
  if net_value<policy_row.minimum_payout_minor then raise exception 'Available balance is below the configured minimum payout.'; end if;

  insert into public.provider_payout_batches(
    provider_type,professional_id,business_id,owner_user_id,currency,status,settlement_count,
    gross_minor,platform_fee_minor,provider_net_minor,created_by
  ) values (
    identity_row.provider_type,identity_row.professional_id,identity_row.business_id,target_owner_user_id,currency_value,'ready',count_value,
    gross_value,fee_value,net_value,auth.uid()
  ) returning * into batch_row;

  insert into public.provider_payout_items(payout_batch_id,settlement_id,provider_net_minor)
  select batch_row.id,s.id,s.provider_net_minor from public.provider_booking_settlements s
  where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='available';

  update public.provider_booking_settlements s set status='assigned',updated_at=now()
  where s.id in (select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id);

  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'finance.payout.prepared','provider_payout',batch_row.id::text,jsonb_build_object(
    'owner_user_id',target_owner_user_id,'currency',currency_value,'settlement_count',count_value,
    'gross_minor',gross_value,'platform_fee_minor',fee_value,'provider_net_minor',net_value
  ));
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(target_owner_user_id,'provider_payout_prepared','Provider payout prepared',
    'A provider payout batch has been prepared for '||currency_value||' '||to_char(net_value/100.0,'FM9999999990.00')||'.');
  return batch_row;
end;
$$;
revoke all on function public.admin_prepare_provider_payout(uuid,text) from public,anon;
grant execute on function public.admin_prepare_provider_payout(uuid,text) to authenticated;
