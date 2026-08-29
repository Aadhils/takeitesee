-- Final ordered hardening for Phase 14 Module 6 recovery payout offsets.
-- This file intentionally sorts after the base/earlier hardening migrations so a fresh deployment ends on the tested definitions.

create or replace function public.internal_finalize_payout_recovery_offsets(target_batch_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  recovery_row public.provider_recovery_entries%rowtype;
begin
  for recovery_row in
    select r.*
    from public.provider_recovery_entries r
    where exists(
      select 1 from public.provider_recovery_ledger_entries e
      where e.recovery_id=r.id and e.payout_batch_id=target_batch_id and e.entry_type='payout_offset'
    )
    order by r.created_at,r.id
    for update
  loop
    if recovery_row.status='open' and public.internal_recovery_outstanding(recovery_row.id)=0 then
      update public.provider_recovery_entries
      set status='recovered',resolved_at=coalesce(resolved_at,now()),resolved_by=null,
          resolution_note=coalesce(resolution_note,'Recovered through a future provider payout offset.'),updated_at=now()
      where id=recovery_row.id;
      perform public.internal_release_booking_holds_if_clear(recovery_row.booking_id);
      insert into public.notifications(recipient_user_id,booking_id,event_type,title,body)
      values(recovery_row.owner_user_id,recovery_row.booking_id,'provider_recovery_resolved','Finance recovery resolved',
             'The outstanding finance recovery for this booking has been fully cleared through payout offsets.');
    end if;
  end loop;
end;
$$;
revoke all on function public.internal_finalize_payout_recovery_offsets(uuid) from public,anon,authenticated;

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
