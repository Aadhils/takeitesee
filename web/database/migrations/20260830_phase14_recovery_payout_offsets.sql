-- Phase 14 Module 6 completion: immutable provider recovery ledger and future payout offsets.
-- Existing recovery rows remain the case/projection; economic movements are append-only below.

alter table public.provider_payout_batches
  add column recovery_offset_minor bigint not null default 0,
  add column transfer_amount_minor bigint;

update public.provider_payout_batches
set transfer_amount_minor=provider_net_minor-recovery_offset_minor
where transfer_amount_minor is null;

alter table public.provider_payout_batches
  alter column transfer_amount_minor set not null,
  add constraint provider_payout_batches_recovery_offset_valid
    check (recovery_offset_minor>=0 and recovery_offset_minor<=provider_net_minor),
  add constraint provider_payout_batches_transfer_amount_valid
    check (transfer_amount_minor>=0 and transfer_amount_minor=provider_net_minor-recovery_offset_minor);

create table public.provider_recovery_ledger_entries (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references public.provider_recovery_entries(id) on delete restrict,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  payout_batch_id uuid references public.provider_payout_batches(id) on delete restrict,
  entry_type text not null check (entry_type in ('recovery_debit','payout_offset','payout_offset_reversal','manual_repayment','gateway_reversal_credit','admin_waiver')),
  direction text not null check (direction in ('debit','credit')),
  amount_minor bigint not null check (amount_minor>0),
  currency text not null check (currency in ('INR','USD')),
  idempotency_key text not null unique,
  public_note text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  check (char_length(idempotency_key) between 3 and 200),
  check (public_note is null or char_length(public_note)<=500),
  check (
    (entry_type in ('recovery_debit','payout_offset_reversal') and direction='debit')
    or (entry_type in ('payout_offset','manual_repayment','gateway_reversal_credit','admin_waiver') and direction='credit')
  ),
  check ((entry_type in ('payout_offset','payout_offset_reversal') and payout_batch_id is not null) or entry_type not in ('payout_offset','payout_offset_reversal'))
);

create index provider_recovery_ledger_recovery_created_idx on public.provider_recovery_ledger_entries(recovery_id,created_at,id);
create index provider_recovery_ledger_owner_currency_idx on public.provider_recovery_ledger_entries(owner_user_id,currency,created_at desc);
create index provider_recovery_ledger_payout_idx on public.provider_recovery_ledger_entries(payout_batch_id) where payout_batch_id is not null;

alter table public.provider_recovery_ledger_entries enable row level security;
revoke insert,update,delete on public.provider_recovery_ledger_entries from anon,authenticated;
grant select on public.provider_recovery_ledger_entries to authenticated;

drop policy if exists provider_recovery_ledger_actor_read on public.provider_recovery_ledger_entries;
create policy provider_recovery_ledger_actor_read on public.provider_recovery_ledger_entries
for select to authenticated using (
  owner_user_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_manage(null,null,null,null)
);

create or replace function public.prevent_provider_recovery_ledger_mutation()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  raise exception 'Provider recovery ledger entries are immutable.';
end;
$$;
revoke all on function public.prevent_provider_recovery_ledger_mutation() from public,anon,authenticated;
drop trigger if exists provider_recovery_ledger_immutable on public.provider_recovery_ledger_entries;
create trigger provider_recovery_ledger_immutable
before update or delete on public.provider_recovery_ledger_entries
for each row execute function public.prevent_provider_recovery_ledger_mutation();

create or replace function public.internal_recovery_outstanding(target_recovery_id uuid)
returns bigint
language sql stable security definer set search_path=public,pg_temp as $$
  select greatest(
    coalesce(sum(case when e.direction='debit' then e.amount_minor else -e.amount_minor end),0),
    0
  )::bigint
  from public.provider_recovery_ledger_entries e
  where e.recovery_id=target_recovery_id;
$$;
revoke all on function public.internal_recovery_outstanding(uuid) from public,anon,authenticated;

create or replace function public.internal_append_provider_recovery_ledger(
  target_recovery_id uuid,
  target_entry_type text,
  target_direction text,
  target_amount_minor bigint,
  target_idempotency_key text,
  target_payout_batch_id uuid default null,
  target_public_note text default null,
  target_created_by uuid default null
)
returns public.provider_recovery_ledger_entries
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  recovery_row public.provider_recovery_entries%rowtype;
  ledger_row public.provider_recovery_ledger_entries%rowtype;
  entry_value text:=lower(btrim(coalesce(target_entry_type,'')));
  direction_value text:=lower(btrim(coalesce(target_direction,'')));
  key_value text:=btrim(coalesce(target_idempotency_key,''));
  note_value text:=nullif(left(btrim(coalesce(target_public_note,'')),500),'');
  outstanding_value bigint;
begin
  if target_amount_minor is null or target_amount_minor<=0 then raise exception 'Recovery ledger amount must be positive.'; end if;
  if char_length(key_value)<3 or char_length(key_value)>200 then raise exception 'Recovery ledger idempotency key is invalid.'; end if;
  if entry_value not in ('recovery_debit','payout_offset','payout_offset_reversal','manual_repayment','gateway_reversal_credit','admin_waiver') then raise exception 'Recovery ledger entry type is invalid.'; end if;
  if direction_value not in ('debit','credit') then raise exception 'Recovery ledger direction is invalid.'; end if;
  if (entry_value in ('recovery_debit','payout_offset_reversal') and direction_value<>'debit') or
     (entry_value in ('payout_offset','manual_repayment','gateway_reversal_credit','admin_waiver') and direction_value<>'credit') then
    raise exception 'Recovery ledger direction does not match the entry type.';
  end if;
  if entry_value in ('payout_offset','payout_offset_reversal') and target_payout_batch_id is null then raise exception 'Payout recovery ledger entries require a payout batch.'; end if;

  select * into recovery_row from public.provider_recovery_entries where id=target_recovery_id for update;
  if not found then raise exception 'Provider recovery was not found.'; end if;

  select * into ledger_row from public.provider_recovery_ledger_entries where idempotency_key=key_value;
  if found then
    if ledger_row.recovery_id<>recovery_row.id or ledger_row.entry_type<>entry_value or ledger_row.direction<>direction_value or
       ledger_row.amount_minor<>target_amount_minor or ledger_row.payout_batch_id is distinct from target_payout_batch_id then
      raise exception 'Recovery ledger idempotency key collision.';
    end if;
    return ledger_row;
  end if;

  if entry_value='recovery_debit' and exists(select 1 from public.provider_recovery_ledger_entries where recovery_id=recovery_row.id and entry_type='recovery_debit') then
    raise exception 'Recovery opening debit already exists.';
  end if;

  outstanding_value:=public.internal_recovery_outstanding(recovery_row.id);
  if direction_value='credit' and target_amount_minor>outstanding_value then
    raise exception 'Recovery credit cannot exceed the outstanding balance.';
  end if;
  if entry_value='payout_offset_reversal' and not exists(
    select 1 from public.provider_recovery_ledger_entries
    where recovery_id=recovery_row.id and payout_batch_id=target_payout_batch_id and entry_type='payout_offset'
  ) then raise exception 'Recovery offset reversal requires an existing payout offset.'; end if;

  insert into public.provider_recovery_ledger_entries(
    recovery_id,owner_user_id,booking_id,payout_batch_id,entry_type,direction,amount_minor,currency,idempotency_key,public_note,created_by
  ) values(
    recovery_row.id,recovery_row.owner_user_id,recovery_row.booking_id,target_payout_batch_id,entry_value,direction_value,
    target_amount_minor,recovery_row.currency,key_value,note_value,target_created_by
  ) returning * into ledger_row;
  return ledger_row;
end;
$$;
revoke all on function public.internal_append_provider_recovery_ledger(uuid,text,text,bigint,text,uuid,text,uuid) from public,anon,authenticated;

-- Backfill already-created recovery cases into the immutable economic ledger.
insert into public.provider_recovery_ledger_entries(
  recovery_id,owner_user_id,booking_id,payout_batch_id,entry_type,direction,amount_minor,currency,idempotency_key,public_note,created_by,created_at
)
select r.id,r.owner_user_id,r.booking_id,null,'recovery_debit','debit',r.amount_minor,r.currency,
       'recovery:'||r.id::text||':opening','Finance recovery opened.',null,r.created_at
from public.provider_recovery_entries r
where not exists(select 1 from public.provider_recovery_ledger_entries e where e.recovery_id=r.id and e.entry_type='recovery_debit');

create or replace function public.internal_finalize_payout_recovery_offsets(target_batch_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  recovery_row public.provider_recovery_entries%rowtype;
begin
  for recovery_row in
    select distinct r.*
    from public.provider_recovery_entries r
    join public.provider_recovery_ledger_entries e on e.recovery_id=r.id
    where e.payout_batch_id=target_batch_id and e.entry_type='payout_offset'
    for update of r
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

create or replace function public.internal_reverse_payout_recovery_offsets(target_batch_id uuid, target_reason text)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  offset_row record;
  recovery_row public.provider_recovery_entries%rowtype;
  reason_value text:=coalesce(nullif(left(btrim(coalesce(target_reason,'')),500),''),'Prepared payout did not complete; recovery offset reservation was released.');
begin
  for offset_row in
    select e.recovery_id,e.amount_minor
    from public.provider_recovery_ledger_entries e
    where e.payout_batch_id=target_batch_id and e.entry_type='payout_offset'
    order by e.created_at,e.id
  loop
    perform public.internal_append_provider_recovery_ledger(
      offset_row.recovery_id,'payout_offset_reversal','debit',offset_row.amount_minor,
      'payout:'||target_batch_id::text||':recovery:'||offset_row.recovery_id::text||':offset-reversal',
      target_batch_id,reason_value,null
    );
    select * into recovery_row from public.provider_recovery_entries where id=offset_row.recovery_id for update;
    if recovery_row.status='recovered' and public.internal_recovery_outstanding(recovery_row.id)>0 then
      update public.provider_recovery_entries
      set status='open',resolved_at=null,resolved_by=null,resolution_note=null,updated_at=now()
      where id=recovery_row.id;
      update public.provider_finance_holds
      set status='recovery_required',released_at=null,release_reason=null,updated_at=now()
      where source_type=recovery_row.source_type and source_reference=recovery_row.source_reference;
    end if;
  end loop;
end;
$$;
revoke all on function public.internal_reverse_payout_recovery_offsets(uuid,text) from public,anon,authenticated;

create or replace function public.internal_ensure_provider_recovery(target_booking_id uuid, target_source_type text, target_source_reference text, target_loss_minor bigint, target_currency text, target_reason text)
returns public.provider_recovery_entries
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  settlement_row public.provider_booking_settlements%rowtype;
  batch_row public.provider_payout_batches%rowtype;
  recovery_row public.provider_recovery_entries%rowtype;
  recovery_amount bigint;
begin
  select * into settlement_row from public.provider_booking_settlements where booking_id=target_booking_id for update;
  if not found or settlement_row.status<>'paid' or settlement_row.gross_minor<=0 then return null; end if;
  select b.* into batch_row from public.provider_payout_items i join public.provider_payout_batches b on b.id=i.payout_batch_id
  where i.settlement_id=settlement_row.id and b.status='paid' order by b.paid_at desc nulls last,b.created_at desc limit 1;
  if not found then return null; end if;
  recovery_amount:=least(settlement_row.provider_net_minor,round((target_loss_minor::numeric*settlement_row.provider_net_minor::numeric)/settlement_row.gross_minor::numeric)::bigint);
  if recovery_amount<=0 then return null; end if;
  select * into recovery_row from public.provider_recovery_entries where source_type=target_source_type and source_reference=target_source_reference and settlement_id=settlement_row.id for update;
  if found then
    perform public.internal_append_provider_recovery_ledger(
      recovery_row.id,'recovery_debit','debit',recovery_row.amount_minor,
      'recovery:'||recovery_row.id::text||':opening',null,'Finance recovery opened.',null
    );
    return recovery_row;
  end if;
  insert into public.provider_recovery_entries(owner_user_id,booking_id,settlement_id,payout_batch_id,source_type,source_reference,amount_minor,currency,status,reason)
  values(settlement_row.owner_user_id,target_booking_id,settlement_row.id,batch_row.id,target_source_type,target_source_reference,recovery_amount,target_currency,'open',left(target_reason,500)) returning * into recovery_row;
  perform public.internal_append_provider_recovery_ledger(
    recovery_row.id,'recovery_debit','debit',recovery_row.amount_minor,
    'recovery:'||recovery_row.id::text||':opening',null,'Finance recovery opened.',null
  );
  update public.provider_finance_holds set status='recovery_required',updated_at=now() where source_type=target_source_type and source_reference=target_source_reference and status<>'released';
  insert into public.notifications(recipient_user_id,booking_id,event_type,title,body)
  values(settlement_row.owner_user_id,target_booking_id,'provider_recovery_required','Provider payout recovery required',
         'A payment reversal or dispute affected funds already paid out. Future eligible payouts may be applied to the outstanding recovery balance.');
  return recovery_row;
end;
$$;
revoke all on function public.internal_ensure_provider_recovery(uuid,text,text,bigint,text,text) from public,anon,authenticated;

create or replace function public.admin_prepare_provider_payout(target_owner_user_id uuid,target_currency text)
returns public.provider_payout_batches
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  policy_row public.platform_finance_policies%rowtype;
  batch_row public.provider_payout_batches%rowtype;
  identity_row public.provider_booking_settlements%rowtype;
  recovery_row public.provider_recovery_entries%rowtype;
  gross_value bigint;
  fee_value bigint;
  net_value bigint;
  count_value integer;
  currency_value text:=upper(btrim(coalesce(target_currency,'')));
  recovery_total bigint:=0;
  offset_target bigint:=0;
  offset_remaining bigint:=0;
  recovery_outstanding bigint:=0;
  allocation_value bigint:=0;
  transfer_value bigint:=0;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(target_owner_user_id::text||':'||currency_value,0));
  select * into policy_row from public.platform_finance_policies where currency=currency_value and active=true;
  if not found then raise exception 'An active finance policy is required before preparing payouts.'; end if;
  if exists(select 1 from public.provider_payout_batches where owner_user_id=target_owner_user_id and currency=currency_value and status in ('ready','processing')) then raise exception 'This provider already has an open payout batch.'; end if;

  update public.provider_booking_settlements s set status='available',updated_at=now()
  where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='held' and s.eligible_at<=now()
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'))
    and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'));

  select * into identity_row from public.provider_booking_settlements s
  where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='available'
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'))
    and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'))
  order by s.created_at limit 1;
  if not found then raise exception 'No provider funds are currently available for payout.'; end if;

  select count(*)::int,coalesce(sum(s.gross_minor),0)::bigint,coalesce(sum(s.platform_fee_minor),0)::bigint,coalesce(sum(s.provider_net_minor),0)::bigint
  into count_value,gross_value,fee_value,net_value
  from public.provider_booking_settlements s
  where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='available'
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'))
    and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'));
  if count_value=0 or net_value<=0 then raise exception 'No provider funds are currently available for payout.'; end if;
  if net_value<policy_row.minimum_payout_minor then raise exception 'Available balance is below the configured minimum payout.'; end if;

  select coalesce(sum(public.internal_recovery_outstanding(r.id)),0)::bigint into recovery_total
  from public.provider_recovery_entries r
  where r.owner_user_id=target_owner_user_id and r.currency=currency_value and r.status='open';
  offset_target:=least(net_value,recovery_total);
  transfer_value:=net_value-offset_target;
  -- Cashfree transfer minimum is INR 1.00. If an offset would leave a sub-INR transfer,
  -- keep enough provider balance in the transfer instead of creating an invalid gateway request.
  if currency_value='INR' and transfer_value between 1 and 99 then
    offset_target:=greatest(net_value-100,0);
    transfer_value:=net_value-offset_target;
  end if;

  insert into public.provider_payout_batches(
    provider_type,professional_id,business_id,owner_user_id,currency,status,settlement_count,
    gross_minor,platform_fee_minor,provider_net_minor,recovery_offset_minor,transfer_amount_minor,created_by
  ) values(
    identity_row.provider_type,identity_row.professional_id,identity_row.business_id,target_owner_user_id,currency_value,'ready',count_value,
    gross_value,fee_value,net_value,0,net_value,auth.uid()
  ) returning * into batch_row;

  insert into public.provider_payout_items(payout_batch_id,settlement_id,provider_net_minor)
  select batch_row.id,s.id,s.provider_net_minor from public.provider_booking_settlements s
  where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='available'
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'))
    and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'));
  update public.provider_booking_settlements s set status='assigned',updated_at=now()
  where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id);

  offset_remaining:=offset_target;
  if offset_remaining>0 then
    for recovery_row in
      select r.* from public.provider_recovery_entries r
      where r.owner_user_id=target_owner_user_id and r.currency=currency_value and r.status='open'
      order by r.created_at,r.id
      for update
    loop
      recovery_outstanding:=public.internal_recovery_outstanding(recovery_row.id);
      if recovery_outstanding>0 then
        allocation_value:=least(recovery_outstanding,offset_remaining);
        if allocation_value>0 then
          perform public.internal_append_provider_recovery_ledger(
            recovery_row.id,'payout_offset','credit',allocation_value,
            'payout:'||batch_row.id::text||':recovery:'||recovery_row.id::text||':offset',
            batch_row.id,'Applied from a future provider payout.',auth.uid()
          );
          offset_remaining:=offset_remaining-allocation_value;
        end if;
      end if;
      exit when offset_remaining=0;
    end loop;
    if offset_remaining<>0 then raise exception 'Provider recovery offset allocation could not be completed safely.'; end if;
  end if;

  update public.provider_payout_batches
  set recovery_offset_minor=offset_target,transfer_amount_minor=transfer_value,updated_at=now()
  where id=batch_row.id returning * into batch_row;

  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'finance.payout.prepared','provider_payout',batch_row.id::text,jsonb_build_object(
    'owner_user_id',target_owner_user_id,'currency',currency_value,'settlement_count',count_value,'gross_minor',gross_value,
    'platform_fee_minor',fee_value,'provider_net_minor',net_value,'recovery_offset_minor',offset_target,'transfer_amount_minor',transfer_value
  ));
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(target_owner_user_id,'provider_payout_prepared','Provider payout prepared',
    case when offset_target>0 then
      'A payout batch has been prepared. '||currency_value||' '||to_char(offset_target/100.0,'FM9999999990.00')||
      ' is allocated to finance recovery and '||currency_value||' '||to_char(transfer_value/100.0,'FM9999999990.00')||' remains for transfer.'
    else 'A provider payout batch has been prepared for '||currency_value||' '||to_char(net_value/100.0,'FM9999999990.00')||'.' end
  );
  return batch_row;
end;
$$;
revoke all on function public.admin_prepare_provider_payout(uuid,text) from public,anon;
grant execute on function public.admin_prepare_provider_payout(uuid,text) to authenticated;

create or replace function public.admin_cancel_provider_payout(target_batch_id uuid,action_reason text)
returns public.provider_payout_batches
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  batch_row public.provider_payout_batches%rowtype;
  reason_value text:=nullif(btrim(coalesce(action_reason,'')),'');
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  if reason_value is null or char_length(reason_value)<3 or char_length(reason_value)>500 then raise exception 'A cancellation reason between 3 and 500 characters is required.'; end if;
  select * into batch_row from public.provider_payout_batches where id=target_batch_id and status='ready' for update;
  if not found then raise exception 'Ready payout batch was not found.'; end if;
  perform public.internal_reverse_payout_recovery_offsets(batch_row.id,'Prepared payout cancelled: '||reason_value);
  update public.provider_booking_settlements s
  set status=case when s.eligible_at<=now() then 'available' else 'held' end,updated_at=now()
  where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id);
  delete from public.provider_payout_items where payout_batch_id=batch_row.id;
  update public.provider_payout_batches set status='cancelled',failure_message=reason_value,updated_at=now()
  where id=batch_row.id returning * into batch_row;
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'finance.payout.cancelled','provider_payout',batch_row.id::text,jsonb_build_object(
    'reason',reason_value,'owner_user_id',batch_row.owner_user_id,'recovery_offset_minor',batch_row.recovery_offset_minor
  ));
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(batch_row.owner_user_id,'provider_payout_cancelled','Provider payout cancelled',reason_value);
  return batch_row;
end;
$$;
revoke all on function public.admin_cancel_provider_payout(uuid,text) from public,anon;
grant execute on function public.admin_cancel_provider_payout(uuid,text) to authenticated;

create or replace function public.gateway_reserve_provider_payout_transfer(target_batch_id uuid,target_destination_id uuid,target_transfer_id text,target_transfer_mode text,target_actor_user_id uuid default null)
returns public.provider_payout_batches
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  batch_row public.provider_payout_batches%rowtype;
  destination_row public.provider_payout_destinations%rowtype;
  transfer_value text:=btrim(coalesce(target_transfer_id,''));
  mode_value text:=lower(btrim(coalesce(target_transfer_mode,'')));
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for payout transfer reservation.'; end if;
  if transfer_value !~ '^[A-Za-z0-9_]{6,40}$' then raise exception 'Payout transfer id is invalid.'; end if;
  if mode_value not in ('banktransfer','upi') then raise exception 'Payout transfer mode is invalid.'; end if;
  select * into batch_row from public.provider_payout_batches where id=target_batch_id for update;
  if not found then raise exception 'Payout batch was not found.'; end if;
  if batch_row.status<>'ready' then raise exception 'Only a ready payout batch can start a transfer.'; end if;
  if batch_row.currency<>'INR' then raise exception 'Cashfree provider payouts currently support INR batches only.'; end if;
  if batch_row.transfer_amount_minor<100 then raise exception 'Cashfree payout amount must be at least INR 1.00.'; end if;
  if exists(
    select 1 from public.provider_payout_items i
    join public.provider_booking_settlements s on s.id=i.settlement_id
    where i.payout_batch_id=batch_row.id and (
      exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'))
      or exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'))
    )
  ) then raise exception 'Payout risk changed after preparation. Cancel and prepare the payout again.'; end if;
  if exists(
    select 1 from public.provider_recovery_entries r
    where r.owner_user_id=batch_row.owner_user_id and r.currency=batch_row.currency and r.status='open'
      and public.internal_recovery_outstanding(r.id)>0
  ) then raise exception 'Provider recovery changed after payout preparation. Cancel and prepare the payout again.'; end if;

  select * into destination_row from public.provider_payout_destinations where id=target_destination_id for update;
  if not found or destination_row.status<>'verified' then raise exception 'A verified payout destination is required.'; end if;
  if destination_row.owner_user_id<>batch_row.owner_user_id then raise exception 'Payout destination does not belong to this provider.'; end if;
  if (destination_row.destination_type='upi' and mode_value<>'upi') or (destination_row.destination_type='bank' and mode_value='upi') then
    raise exception 'Payout transfer mode does not match the provider destination.';
  end if;
  update public.provider_payout_batches
  set status='processing',payout_destination_id=destination_row.id,gateway='cashfree_payout',
      transfer_id=transfer_value,transfer_mode=mode_value,transfer_status='RESERVED',transfer_status_code='RESERVED',
      transfer_status_description='Transfer reserved before gateway submission.',external_reference=transfer_value,
      initiated_at=coalesce(initiated_at,now()),updated_at=now(),failure_message=null
  where id=batch_row.id returning * into batch_row;
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(target_actor_user_id,'finance.payout.transfer_reserved','provider_payout',batch_row.id::text,jsonb_build_object(
    'owner_user_id',batch_row.owner_user_id,'currency',batch_row.currency,'provider_net_minor',batch_row.provider_net_minor,
    'recovery_offset_minor',batch_row.recovery_offset_minor,'transfer_amount_minor',batch_row.transfer_amount_minor,
    'destination_id',destination_row.id,'transfer_id',transfer_value,'transfer_mode',mode_value
  ));
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(batch_row.owner_user_id,'provider_payout_processing','Provider payout processing','Your provider payout is being processed through the payout gateway.');
  return batch_row;
end;
$$;
revoke all on function public.gateway_reserve_provider_payout_transfer(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.gateway_reserve_provider_payout_transfer(uuid,uuid,text,text,uuid) to service_role;

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
  values(batch_row.owner_user_id,'provider_payout_recovery_applied','Provider recovery applied',
         'This payout balance was fully applied to an outstanding finance recovery. No external bank or UPI transfer was created.');
  return batch_row;
end;
$$;
revoke all on function public.gateway_complete_recovery_only_payout(uuid,uuid) from public,anon,authenticated;
grant execute on function public.gateway_complete_recovery_only_payout(uuid,uuid) to service_role;

create or replace function public.gateway_apply_provider_payout_transfer_status(target_batch_id uuid,target_gateway_status text,target_gateway_status_code text,target_gateway_status_description text default null,target_gateway_transfer_id text default null,target_transfer_utr text default null)
returns public.provider_payout_batches
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  batch_row public.provider_payout_batches%rowtype;
  old_status text;
  status_value text:=upper(btrim(coalesce(target_gateway_status,'')));
  code_value text:=upper(btrim(coalesce(target_gateway_status_code,'')));
  description_value text:=nullif(left(btrim(coalesce(target_gateway_status_description,'')),500),'');
  gateway_id_value text:=nullif(left(btrim(coalesce(target_gateway_transfer_id,'')),200),'');
  utr_value text:=nullif(left(btrim(coalesce(target_transfer_utr,'')),200),'');
  settlement_record record;
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for payout gateway reconciliation.'; end if;
  if status_value='' then raise exception 'Gateway payout status is required.'; end if;
  select * into batch_row from public.provider_payout_batches where id=target_batch_id for update;
  if not found then raise exception 'Payout batch was not found.'; end if;
  if batch_row.transfer_amount_minor<=0 then raise exception 'Recovery-only payouts do not accept gateway transfer statuses.'; end if;
  old_status:=batch_row.status;
  if old_status='reversed' then return batch_row; end if;
  if old_status in ('failed','cancelled') then return batch_row; end if;
  if old_status='paid' and status_value<>'REVERSED' then return batch_row; end if;
  update public.provider_payout_batches
  set gateway_transfer_id=coalesce(gateway_id_value,gateway_transfer_id),transfer_status=status_value,
      transfer_status_code=nullif(code_value,''),transfer_status_description=description_value,
      transfer_utr=coalesce(utr_value,transfer_utr),updated_at=now()
  where id=batch_row.id returning * into batch_row;
  if status_value='SUCCESS' and code_value='COMPLETED' then
    update public.provider_payout_batches
    set status='paid',paid_at=coalesce(paid_at,now()),completed_at=coalesce(completed_at,now()),
        external_reference=coalesce(utr_value,gateway_id_value,transfer_id),failure_message=null,updated_at=now()
    where id=batch_row.id returning * into batch_row;
    update public.provider_booking_settlements s set status='paid',updated_at=now()
    where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id) and s.status='assigned';
    perform public.internal_finalize_payout_recovery_offsets(batch_row.id);
    for settlement_record in select s.booking_id from public.provider_payout_items i join public.provider_booking_settlements s on s.id=i.settlement_id where i.payout_batch_id=batch_row.id
    loop perform public.internal_reconcile_booking_risk_after_payout(settlement_record.booking_id); end loop;
    if old_status<>'paid' then insert into public.notifications(recipient_user_id,event_type,title,body)
      values(batch_row.owner_user_id,'provider_payout_paid','Provider payout completed','Your provider payout has been completed successfully.'); end if;
  elsif status_value='REVERSED' then
    perform public.internal_reverse_payout_recovery_offsets(batch_row.id,coalesce(description_value,'Gateway payout was reversed.'));
    update public.provider_payout_batches
    set status='reversed',reversed_at=coalesce(reversed_at,now()),failure_message=coalesce(description_value,'Gateway payout was reversed.'),updated_at=now()
    where id=batch_row.id returning * into batch_row;
    update public.provider_booking_settlements s
    set status=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then 'reversed' when s.eligible_at<=now() then 'available' else 'held' end,
        reversal_reason=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then 'Booking payment was reversed before provider payout could remain settled.' else s.reversal_reason end,
        reversed_at=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then now() else s.reversed_at end,updated_at=now()
    where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id) and s.status in ('assigned','paid');
    for settlement_record in select s.booking_id from public.provider_payout_items i join public.provider_booking_settlements s on s.id=i.settlement_id where i.payout_batch_id=batch_row.id
    loop perform public.internal_reconcile_booking_risk_after_transfer_return(settlement_record.booking_id,batch_row.id); end loop;
    if old_status<>'reversed' then insert into public.notifications(recipient_user_id,event_type,title,body)
      values(batch_row.owner_user_id,'provider_payout_reversed','Provider payout reversed',coalesce(description_value,'The payout was reversed by the beneficiary bank and the balance is available for review.')); end if;
  elsif status_value in ('FAILED','REJECTED') then
    perform public.internal_reverse_payout_recovery_offsets(batch_row.id,coalesce(description_value,'Gateway payout failed before completion.'));
    update public.provider_payout_batches
    set status='failed',failure_message=coalesce(description_value,'Gateway payout failed.'),updated_at=now()
    where id=batch_row.id returning * into batch_row;
    update public.provider_booking_settlements s
    set status=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then 'reversed' when s.eligible_at<=now() then 'available' else 'held' end,
        reversal_reason=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then 'Booking payment was reversed before provider payout completed.' else s.reversal_reason end,
        reversed_at=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then now() else s.reversed_at end,updated_at=now()
    where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id) and s.status='assigned';
    for settlement_record in select s.booking_id from public.provider_payout_items i join public.provider_booking_settlements s on s.id=i.settlement_id where i.payout_batch_id=batch_row.id
    loop perform public.internal_reconcile_booking_risk_after_transfer_return(settlement_record.booking_id,batch_row.id); end loop;
    if old_status<>'failed' then insert into public.notifications(recipient_user_id,event_type,title,body)
      values(batch_row.owner_user_id,'provider_payout_failed','Provider payout needs attention',coalesce(description_value,'The payout could not be completed and the balance has been released for review.')); end if;
  else
    update public.provider_payout_batches set status='processing',updated_at=now() where id=batch_row.id returning * into batch_row;
  end if;
  return batch_row;
end;
$$;
revoke all on function public.gateway_apply_provider_payout_transfer_status(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gateway_apply_provider_payout_transfer_status(uuid,text,text,text,text,text) to service_role;

create or replace function public.admin_resolve_provider_recovery(target_recovery_id uuid,target_action text,target_note text)
returns public.provider_recovery_entries
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  row_value public.provider_recovery_entries%rowtype;
  action_value text:=lower(btrim(coalesce(target_action,'')));
  note_value text:=btrim(coalesce(target_note,''));
  dispute_row public.payment_disputes%rowtype;
  outstanding_value bigint;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  if action_value not in ('recovered','waived') then raise exception 'Recovery action is invalid.'; end if;
  if char_length(note_value)<3 or char_length(note_value)>500 then raise exception 'Resolution note must be 3 to 500 characters.'; end if;
  select * into row_value from public.provider_recovery_entries where id=target_recovery_id for update;
  if not found then raise exception 'Provider recovery entry was not found.'; end if;
  if row_value.status<>'open' then return row_value; end if;
  if exists(
    select 1 from public.provider_recovery_ledger_entries e
    join public.provider_payout_batches b on b.id=e.payout_batch_id
    where e.recovery_id=row_value.id and e.entry_type='payout_offset' and b.status in ('ready','processing')
      and not exists(select 1 from public.provider_recovery_ledger_entries x where x.recovery_id=e.recovery_id and x.payout_batch_id=e.payout_batch_id and x.entry_type='payout_offset_reversal')
  ) then raise exception 'This recovery is already allocated to an open payout batch. Complete or cancel that payout first.'; end if;
  outstanding_value:=public.internal_recovery_outstanding(row_value.id);
  if outstanding_value>0 then
    if action_value='waived' then
      perform public.internal_append_provider_recovery_ledger(row_value.id,'admin_waiver','credit',outstanding_value,
        'recovery:'||row_value.id::text||':admin-waiver',null,'Outstanding recovery waived by platform finance.',auth.uid());
    else
      perform public.internal_append_provider_recovery_ledger(row_value.id,'manual_repayment','credit',outstanding_value,
        'recovery:'||row_value.id::text||':manual-repayment',null,'Recovery confirmed manually by platform finance.',auth.uid());
    end if;
  end if;
  update public.provider_recovery_entries
  set status=action_value,resolved_at=now(),resolved_by=auth.uid(),resolution_note=note_value,updated_at=now()
  where id=row_value.id returning * into row_value;
  if row_value.source_type='dispute' then
    select * into dispute_row from public.payment_disputes where gateway='cashfree' and 'dispute:'||gateway_dispute_id=row_value.source_reference limit 1;
    if found then update public.payment_disputes set local_state=case when gateway_status like '%_MERCHANT_ACCEPTED' then 'accepted' when gateway_status like '%_MERCHANT_LOST' then 'lost' else local_state end,last_seen_at=now() where id=dispute_row.id; end if;
  elsif row_value.source_type='auto_refund' then
    update public.payment_gateway_exceptions
    set status='resolved',severity='info',resolved_by=auth.uid(),resolved_at=now(),resolution_note='Provider recovery resolved: '||note_value,last_seen_at=now()
    where gateway='cashfree' and exception_key=row_value.source_reference;
  end if;
  perform public.internal_release_booking_holds_if_clear(row_value.booking_id);
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'finance.provider_recovery.'||action_value,'provider_recovery',row_value.id::text,jsonb_build_object(
    'owner_user_id',row_value.owner_user_id,'booking_id',row_value.booking_id,'amount_minor',row_value.amount_minor,
    'resolved_outstanding_minor',outstanding_value,'currency',row_value.currency,'note',note_value
  ));
  insert into public.notifications(recipient_user_id,booking_id,event_type,title,body)
  values(row_value.owner_user_id,row_value.booking_id,'provider_recovery_resolved','Finance recovery resolved','The finance recovery hold for a booking has been resolved by platform finance.');
  return row_value;
end;
$$;
revoke all on function public.admin_resolve_provider_recovery(uuid,text,text) from public,anon;
grant execute on function public.admin_resolve_provider_recovery(uuid,text,text) to authenticated;

create or replace function public.internal_reconcile_booking_risk_after_transfer_return(target_booking_id uuid,target_batch_id uuid)
returns void
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  d public.payment_disputes%rowtype;
  e public.payment_gateway_exceptions%rowtype;
  r public.provider_recovery_entries%rowtype;
  outstanding_value bigint;
begin
  for r in
    select * from public.provider_recovery_entries
    where booking_id=target_booking_id and payout_batch_id=target_batch_id and status='open'
    order by created_at,id for update
  loop
    outstanding_value:=public.internal_recovery_outstanding(r.id);
    if outstanding_value>0 then
      perform public.internal_append_provider_recovery_ledger(
        r.id,'gateway_reversal_credit','credit',outstanding_value,
        'recovery:'||r.id::text||':gateway-transfer-return:'||target_batch_id::text,
        null,'Original provider payout returned through the gateway.',null
      );
    end if;
    update public.provider_recovery_entries
    set status='recovered',resolved_at=coalesce(resolved_at,now()),resolved_by=null,
        resolution_note=coalesce(resolution_note,'The original provider payout returned through the gateway.'),updated_at=now()
    where id=r.id;
  end loop;
  for d in select * from public.payment_disputes where booking_id=target_booking_id and local_state='recovery_required' and (gateway_status like '%_MERCHANT_LOST' or gateway_status like '%_MERCHANT_ACCEPTED') loop
    if d.amount_minor=(select amount_minor from public.booking_payment_intents where id=d.payment_intent_id) then
      update public.payment_disputes set local_state=case when gateway_status like '%_MERCHANT_ACCEPTED' then 'accepted' else 'lost' end where id=d.id;
    end if;
  end loop;
  for e in select * from public.payment_gateway_exceptions where booking_id=target_booking_id and category='auto_refund' and status='recovery_required' loop
    update public.payment_gateway_exceptions
    set status='resolved',severity='info',resolved_at=coalesce(resolved_at,now()),resolution_note='Provider payout did not escape or was reversed; auto-refund financial risk is reconciled.',last_seen_at=now()
    where id=e.id;
  end loop;
  perform public.internal_release_booking_holds_if_clear(target_booking_id);
end;
$$;
revoke all on function public.internal_reconcile_booking_risk_after_transfer_return(uuid,uuid) from public,anon,authenticated;

create or replace function public.admin_list_finance_overview()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  return jsonb_build_object(
    'policies',coalesce((select jsonb_agg(to_jsonb(p) order by p.currency) from public.platform_finance_policies p),'[]'::jsonb),
    'providers',coalesce((
      select jsonb_agg(row_data order by (row_data->>'available_minor')::bigint desc) from (
        select jsonb_build_object(
          'owner_user_id',s.owner_user_id,'provider_type',max(s.provider_type),'professional_id',max(s.professional_id::text),'business_id',max(s.business_id::text),
          'display_name',coalesce(max(b.name),max(p.headline),max(u.name),'Provider'),'currency',s.currency,
          'gross_minor',coalesce(sum(s.gross_minor) filter(where s.status<>'reversed'),0),
          'platform_fee_minor',coalesce(sum(s.platform_fee_minor) filter(where s.status<>'reversed'),0),
          'provider_net_minor',coalesce(sum(s.provider_net_minor) filter(where s.status<>'reversed'),0),
          'available_minor',coalesce(sum(s.provider_net_minor) filter(where (s.status='available' or (s.status='held' and s.eligible_at<=now()))
            and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'))),0),
          'held_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='held' and s.eligible_at>now()),0),
          'assigned_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='assigned'),0),
          'recovery_open_minor',coalesce((select sum(public.internal_recovery_outstanding(r.id)) from public.provider_recovery_entries r where r.owner_user_id=s.owner_user_id and r.currency=s.currency and r.status='open'),0),
          'settlement_count',count(*) filter(where s.status<>'reversed')
        ) as row_data
        from public.provider_booking_settlements s
        left join public.businesses b on b.id=s.business_id
        left join public.professional_profiles p on p.id=s.professional_id
        left join public.users u on u.id=s.owner_user_id
        group by s.owner_user_id,s.currency
      ) q
    ),'[]'::jsonb),
    'payouts',coalesce((select jsonb_agg(to_jsonb(b) order by b.created_at desc) from public.provider_payout_batches b),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.admin_list_finance_overview() from public,anon;
grant execute on function public.admin_list_finance_overview() to authenticated;

create or replace function public.get_my_provider_finance_overview()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  owner_id uuid:=auth.uid();
  professional uuid;
  business uuid;
  policy_json jsonb;
  summary_json jsonb;
  settlements_json jsonb;
  payouts_json jsonb;
  destination_json jsonb;
  holds_json jsonb;
  recoveries_json jsonb;
  recovery_ledger_json jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select id into professional from public.professional_profiles where user_id=auth.uid() limit 1;
  select id into business from public.businesses where owner_user_id=auth.uid() limit 1;
  if professional is null and business is null then raise exception 'Provider account is required.'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('currency',p.currency,'active',p.active,'commission_bps',p.commission_bps,'settlement_hold_days',p.settlement_hold_days,'minimum_payout_minor',p.minimum_payout_minor,'version',p.version,'updated_at',p.updated_at) order by p.currency),'[]'::jsonb) into policy_json from public.platform_finance_policies p;
  select jsonb_build_object(
    'gross_minor',coalesce(sum(s.gross_minor) filter(where s.status<>'reversed'),0),
    'platform_fee_minor',coalesce(sum(s.platform_fee_minor) filter(where s.status<>'reversed'),0),
    'provider_net_minor',coalesce(sum(s.provider_net_minor) filter(where s.status<>'reversed'),0),
    'held_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='held' and s.eligible_at>now() and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'))),0),
    'risk_held_minor',coalesce(sum(s.provider_net_minor) filter(where s.status<>'reversed' and exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'))),0),
    'available_minor',coalesce(sum(s.provider_net_minor) filter(where ((s.status='available') or (s.status='held' and s.eligible_at<=now())) and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'))),0),
    'assigned_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='assigned'),0),
    'paid_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='paid'),0),
    'reversed_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='reversed'),0),
    'recovery_open_minor',coalesce((select sum(public.internal_recovery_outstanding(r.id)) from public.provider_recovery_entries r where r.owner_user_id=owner_id and r.status='open'),0),
    'recovery_offset_applied_minor',coalesce((select sum(b.recovery_offset_minor) from public.provider_payout_batches b where b.owner_user_id=owner_id and b.status='paid'),0),
    'transferred_minor',coalesce((select sum(b.transfer_amount_minor) from public.provider_payout_batches b where b.owner_user_id=owner_id and b.status='paid'),0),
    'finance_hold_count',(select count(*) from public.provider_finance_holds h where h.owner_user_id=owner_id and h.status in ('open','recovery_required')),
    'settlement_count',count(*) filter(where s.status<>'reversed'),
    'available_count',count(*) filter(where ((s.status='available') or (s.status='held' and s.eligible_at<=now())) and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required')))
  ) into summary_json from public.provider_booking_settlements s where s.owner_user_id=owner_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'booking_id',s.booking_id,'currency',s.currency,'gross_minor',s.gross_minor,'commission_bps',s.commission_bps,'platform_fee_minor',s.platform_fee_minor,'provider_net_minor',s.provider_net_minor,'policy_version',s.policy_version,'status',case when exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required')) then 'risk_hold' when s.status='held' and s.eligible_at<=now() then 'available' else s.status end,'eligible_at',s.eligible_at,'reversal_reason',s.reversal_reason,'created_at',s.created_at) order by s.created_at desc),'[]'::jsonb) into settlements_json from public.provider_booking_settlements s where s.owner_user_id=owner_id;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc),'[]'::jsonb) into payouts_json from public.provider_payout_batches b where b.owner_user_id=owner_id;
  select coalesce((select jsonb_build_object('id',d.id,'gateway',d.gateway,'gateway_beneficiary_id',d.gateway_beneficiary_id,'destination_type',d.destination_type,'masked_destination',d.masked_destination,'beneficiary_name',d.beneficiary_name,'status',d.status,'gateway_status',d.gateway_status,'last_error_code',d.last_error_code,'last_error_message',d.last_error_message,'verified_at',d.verified_at,'created_at',d.created_at,'updated_at',d.updated_at) from public.provider_payout_destinations d where d.owner_user_id=owner_id and d.status<>'deleted' order by d.created_at desc limit 1),'null'::jsonb) into destination_json;
  select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'booking_id',h.booking_id,'source_type',h.source_type,'amount_minor',h.amount_minor,'currency',h.currency,'status',h.status,'summary',h.public_summary,'opened_at',h.opened_at,'updated_at',h.updated_at) order by h.opened_at desc),'[]'::jsonb) into holds_json from public.provider_finance_holds h where h.owner_user_id=owner_id and h.status<>'released';
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'booking_id',r.booking_id,'amount_minor',r.amount_minor,'outstanding_minor',public.internal_recovery_outstanding(r.id),'currency',r.currency,'status',r.status,'reason',r.reason,'created_at',r.created_at,'resolved_at',r.resolved_at,'resolution_note',r.resolution_note) order by r.created_at desc),'[]'::jsonb) into recoveries_json from public.provider_recovery_entries r where r.owner_user_id=owner_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'recovery_id',e.recovery_id,'booking_id',e.booking_id,'payout_batch_id',e.payout_batch_id,'entry_type',e.entry_type,'direction',e.direction,'amount_minor',e.amount_minor,'currency',e.currency,'note',e.public_note,'created_at',e.created_at) order by e.created_at desc,e.id desc),'[]'::jsonb) into recovery_ledger_json from public.provider_recovery_ledger_entries e where e.owner_user_id=owner_id;
  return jsonb_build_object('policies',policy_json,'summary',coalesce(summary_json,'{}'::jsonb),'settlements',settlements_json,'payouts',payouts_json,'payout_destination',destination_json,'finance_holds',holds_json,'recoveries',recoveries_json,'recovery_ledger',recovery_ledger_json);
end;
$$;
revoke all on function public.get_my_provider_finance_overview() from public,anon;
grant execute on function public.get_my_provider_finance_overview() to authenticated;
