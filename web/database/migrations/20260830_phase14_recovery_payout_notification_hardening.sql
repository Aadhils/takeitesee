-- Reuse the existing provider recovery notification event allow-list for recovery-only payout completion.
create or replace function public.gateway_complete_recovery_only_payout(target_batch_id uuid,target_actor_user_id uuid default null)
returns public.provider_payout_batches
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  batch_row public.provider_payout_batches%rowtype;
  settlement_record record;
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for internal payout completion.'; end if;
  select * into batch_row from public.provider_payout_batches where id=target_batch_id for update;
  if not found then raise exception 'Payout batch was not found.'; end if;
  if batch_row.status<>'ready' then raise exception 'Only a ready payout batch can be completed internally.'; end if;
  if batch_row.transfer_amount_minor<>0 or batch_row.recovery_offset_minor<>batch_row.provider_net_minor then
    raise exception 'Only a fully recovery-offset payout can be completed internally.';
  end if;
  if exists(
    select 1 from public.provider_payout_items i
    join public.provider_booking_settlements s on s.id=i.settlement_id
    where i.payout_batch_id=batch_row.id and (
      exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'))
      or exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'))
    )
  ) then raise exception 'Payout risk changed after preparation. Cancel and prepare the payout again.'; end if;
  update public.provider_payout_batches
  set status='paid',gateway=null,transfer_id=null,gateway_transfer_id=null,transfer_status='INTERNAL_RECOVERY',
      transfer_status_code='COMPLETED',transfer_status_description='Provider earnings were fully applied to outstanding finance recovery; no external transfer was created.',
      external_reference='recovery_'||replace(id::text,'-',''),paid_at=coalesce(paid_at,now()),completed_at=coalesce(completed_at,now()),updated_at=now(),failure_message=null
  where id=batch_row.id returning * into batch_row;
  update public.provider_booking_settlements s set status='paid',updated_at=now()
  where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id) and s.status='assigned';
  perform public.internal_finalize_payout_recovery_offsets(batch_row.id);
  for settlement_record in
    select s.booking_id from public.provider_payout_items i join public.provider_booking_settlements s on s.id=i.settlement_id where i.payout_batch_id=batch_row.id
  loop perform public.internal_reconcile_booking_risk_after_payout(settlement_record.booking_id); end loop;
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(target_actor_user_id,'finance.payout.recovery_only_completed','provider_payout',batch_row.id::text,jsonb_build_object(
    'owner_user_id',batch_row.owner_user_id,'currency',batch_row.currency,'provider_net_minor',batch_row.provider_net_minor,
    'recovery_offset_minor',batch_row.recovery_offset_minor,'transfer_amount_minor',0
  ));
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(batch_row.owner_user_id,'provider_recovery_resolved','Provider recovery applied',
         'This payout balance was fully applied to an outstanding finance recovery. No external bank or UPI transfer was created.');
  return batch_row;
end;
$$;
revoke all on function public.gateway_complete_recovery_only_payout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gateway_complete_recovery_only_payout(uuid,uuid) to service_role;
