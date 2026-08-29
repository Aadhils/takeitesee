-- Phase 14 Module 6 recovery payout offset hardening.
-- Avoid DISTINCT with row locking while finalizing allocated recovery cases.
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
