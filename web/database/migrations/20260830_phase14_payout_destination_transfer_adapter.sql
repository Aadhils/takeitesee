-- Phase 14 Module 4: provider payout destinations and real transfer lifecycle.
-- Raw bank account numbers / VPAs are never persisted in Takeitesee tables.

create table if not exists public.provider_payout_destinations (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete restrict,
  provider_type text not null check (provider_type in ('professional','business')),
  professional_id uuid references public.professional_profiles(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  gateway text not null default 'cashfree_payout' check (char_length(gateway) between 2 and 40),
  gateway_beneficiary_id text not null,
  destination_type text not null check (destination_type in ('bank','upi')),
  masked_destination text not null,
  beneficiary_name text not null,
  status text not null check (status in ('pending','verified','invalid','failed','deleted')),
  gateway_status text,
  last_error_code text,
  last_error_message text,
  verified_at timestamptz,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (provider_type='professional' and professional_id is not null and business_id is null)
    or (provider_type='business' and business_id is not null and professional_id is null)
  ),
  check (char_length(gateway_beneficiary_id) between 1 and 50),
  check (char_length(masked_destination) between 3 and 120),
  check (char_length(beneficiary_name) between 2 and 100),
  check (last_error_code is null or char_length(last_error_code) <= 120),
  check (last_error_message is null or char_length(last_error_message) <= 500),
  unique(gateway,gateway_beneficiary_id)
);
create unique index if not exists provider_payout_destinations_one_active_owner_idx
  on public.provider_payout_destinations(owner_user_id)
  where status <> 'deleted';
create index if not exists provider_payout_destinations_owner_created_idx
  on public.provider_payout_destinations(owner_user_id,created_at desc);

alter table public.provider_payout_destinations enable row level security;
revoke insert,update,delete on public.provider_payout_destinations from anon,authenticated;
drop policy if exists provider_payout_destinations_private_read on public.provider_payout_destinations;
create policy provider_payout_destinations_private_read on public.provider_payout_destinations
for select to authenticated using (
  owner_user_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_manage(null,null,null,null)
);

alter table public.provider_payout_batches drop constraint if exists provider_payout_batches_status_check;
alter table public.provider_payout_batches add constraint provider_payout_batches_status_check
  check (status in ('ready','processing','paid','failed','cancelled','reversed'));

alter table public.provider_payout_batches
  add column if not exists payout_destination_id uuid references public.provider_payout_destinations(id) on delete restrict,
  add column if not exists gateway text,
  add column if not exists transfer_id text,
  add column if not exists gateway_transfer_id text,
  add column if not exists transfer_status text,
  add column if not exists transfer_status_code text,
  add column if not exists transfer_status_description text,
  add column if not exists transfer_mode text,
  add column if not exists transfer_utr text,
  add column if not exists initiated_at timestamptz,
  add column if not exists completed_at timestamptz,
  add column if not exists reversed_at timestamptz;

alter table public.provider_payout_batches drop constraint if exists provider_payout_items_settlement_id_key;
alter table public.provider_payout_items drop constraint if exists provider_payout_items_settlement_id_key;
create unique index if not exists provider_payout_batches_transfer_id_idx
  on public.provider_payout_batches(transfer_id) where transfer_id is not null;
create unique index if not exists provider_payout_batches_gateway_transfer_id_idx
  on public.provider_payout_batches(gateway_transfer_id) where gateway_transfer_id is not null;

create or replace function public.gateway_reserve_provider_payout_transfer(
  target_batch_id uuid,
  target_destination_id uuid,
  target_transfer_id text,
  target_transfer_mode text,
  target_actor_user_id uuid default null
)
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
  if batch_row.provider_net_minor<100 then raise exception 'Cashfree payout amount must be at least INR 1.00.'; end if;

  select * into destination_row from public.provider_payout_destinations where id=target_destination_id for update;
  if not found or destination_row.status<>'verified' then raise exception 'A verified payout destination is required.'; end if;
  if destination_row.owner_user_id<>batch_row.owner_user_id then raise exception 'Payout destination does not belong to this provider.'; end if;
  if (destination_row.destination_type='upi' and mode_value<>'upi') or (destination_row.destination_type='bank' and mode_value='upi') then
    raise exception 'Payout transfer mode does not match the provider destination.';
  end if;

  update public.provider_payout_batches
  set status='processing',payout_destination_id=destination_row.id,gateway='cashfree_payout',
      transfer_id=transfer_value,transfer_mode=mode_value,transfer_status='RESERVED',
      transfer_status_code='RESERVED',transfer_status_description='Transfer reserved before gateway submission.',
      external_reference=transfer_value,initiated_at=coalesce(initiated_at,now()),updated_at=now(),failure_message=null
  where id=batch_row.id returning * into batch_row;

  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(target_actor_user_id,'finance.payout.transfer_reserved','provider_payout',batch_row.id::text,jsonb_build_object(
    'owner_user_id',batch_row.owner_user_id,'currency',batch_row.currency,'provider_net_minor',batch_row.provider_net_minor,
    'destination_id',destination_row.id,'transfer_id',transfer_value,'transfer_mode',mode_value
  ));
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(batch_row.owner_user_id,'provider_payout_processing','Provider payout processing',
    'Your provider payout is being processed through the payout gateway.');
  return batch_row;
end;
$$;
revoke all on function public.gateway_reserve_provider_payout_transfer(uuid,uuid,text,text,uuid) from public,anon,authenticated;
grant execute on function public.gateway_reserve_provider_payout_transfer(uuid,uuid,text,text,uuid) to service_role;

create or replace function public.gateway_apply_provider_payout_transfer_status(
  target_batch_id uuid,
  target_gateway_status text,
  target_gateway_status_code text,
  target_gateway_status_description text default null,
  target_gateway_transfer_id text default null,
  target_transfer_utr text default null
)
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
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for payout gateway reconciliation.'; end if;
  if status_value='' then raise exception 'Gateway payout status is required.'; end if;

  select * into batch_row from public.provider_payout_batches where id=target_batch_id for update;
  if not found then raise exception 'Payout batch was not found.'; end if;
  old_status:=batch_row.status;

  -- A reversal may arrive after a previously completed payout. Other terminal states are idempotent.
  if old_status='reversed' then return batch_row; end if;
  if old_status in ('failed','cancelled') then return batch_row; end if;
  if old_status='paid' and status_value<>'REVERSED' then return batch_row; end if;

  update public.provider_payout_batches
  set gateway_transfer_id=coalesce(gateway_id_value,gateway_transfer_id),
      transfer_status=status_value,transfer_status_code=nullif(code_value,''),
      transfer_status_description=description_value,transfer_utr=coalesce(utr_value,transfer_utr),updated_at=now()
  where id=batch_row.id returning * into batch_row;

  if status_value='SUCCESS' and code_value='COMPLETED' then
    update public.provider_payout_batches
    set status='paid',paid_at=coalesce(paid_at,now()),completed_at=coalesce(completed_at,now()),
        external_reference=coalesce(utr_value,gateway_id_value,transfer_id),failure_message=null,updated_at=now()
    where id=batch_row.id returning * into batch_row;
    update public.provider_booking_settlements s set status='paid',updated_at=now()
    where s.id in (select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id)
      and s.status='assigned';
    if old_status<>'paid' then
      insert into public.notifications(recipient_user_id,event_type,title,body)
      values(batch_row.owner_user_id,'provider_payout_paid','Provider payout completed',
        'Your provider payout has been completed successfully.');
    end if;
  elsif status_value='REVERSED' then
    update public.provider_payout_batches
    set status='reversed',reversed_at=coalesce(reversed_at,now()),failure_message=coalesce(description_value,'Gateway payout was reversed.'),updated_at=now()
    where id=batch_row.id returning * into batch_row;
    update public.provider_booking_settlements s
    set status=case when s.eligible_at<=now() then 'available' else 'held' end,updated_at=now()
    where s.id in (select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id)
      and s.status in ('assigned','paid');
    if old_status<>'reversed' then
      insert into public.notifications(recipient_user_id,event_type,title,body)
      values(batch_row.owner_user_id,'provider_payout_reversed','Provider payout reversed',
        coalesce(description_value,'The payout was reversed by the beneficiary bank and the balance is available for review.'));
    end if;
  elsif status_value in ('FAILED','REJECTED') then
    update public.provider_payout_batches
    set status='failed',failure_message=coalesce(description_value,'Gateway payout failed.'),updated_at=now()
    where id=batch_row.id returning * into batch_row;
    update public.provider_booking_settlements s
    set status=case when s.eligible_at<=now() then 'available' else 'held' end,updated_at=now()
    where s.id in (select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id)
      and s.status='assigned';
    if old_status<>'failed' then
      insert into public.notifications(recipient_user_id,event_type,title,body)
      values(batch_row.owner_user_id,'provider_payout_failed','Provider payout needs attention',
        coalesce(description_value,'The payout could not be completed and the balance has been released for review.'));
    end if;
  else
    update public.provider_payout_batches set status='processing',updated_at=now() where id=batch_row.id returning * into batch_row;
  end if;
  return batch_row;
end;
$$;
revoke all on function public.gateway_apply_provider_payout_transfer_status(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gateway_apply_provider_payout_transfer_status(uuid,text,text,text,text,text) to service_role;

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
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select id into professional from public.professional_profiles where user_id=auth.uid() limit 1;
  select id into business from public.businesses where owner_user_id=auth.uid() limit 1;
  if professional is null and business is null then raise exception 'Provider account is required.'; end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'currency',p.currency,'active',p.active,'commission_bps',p.commission_bps,
    'settlement_hold_days',p.settlement_hold_days,'minimum_payout_minor',p.minimum_payout_minor,
    'version',p.version,'updated_at',p.updated_at
  ) order by p.currency),'[]'::jsonb) into policy_json from public.platform_finance_policies p;

  select jsonb_build_object(
    'gross_minor',coalesce(sum(s.gross_minor) filter(where s.status<>'reversed'),0),
    'platform_fee_minor',coalesce(sum(s.platform_fee_minor) filter(where s.status<>'reversed'),0),
    'provider_net_minor',coalesce(sum(s.provider_net_minor) filter(where s.status<>'reversed'),0),
    'held_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='held' and s.eligible_at>now()),0),
    'available_minor',coalesce(sum(s.provider_net_minor) filter(where (s.status='available') or (s.status='held' and s.eligible_at<=now())),0),
    'assigned_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='assigned'),0),
    'paid_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='paid'),0),
    'reversed_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='reversed'),0),
    'settlement_count',count(*) filter(where s.status<>'reversed'),
    'available_count',count(*) filter(where (s.status='available') or (s.status='held' and s.eligible_at<=now()))
  ) into summary_json from public.provider_booking_settlements s where s.owner_user_id=owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'booking_id',s.booking_id,'currency',s.currency,'gross_minor',s.gross_minor,
    'commission_bps',s.commission_bps,'platform_fee_minor',s.platform_fee_minor,
    'provider_net_minor',s.provider_net_minor,'policy_version',s.policy_version,
    'status',case when s.status='held' and s.eligible_at<=now() then 'available' else s.status end,
    'eligible_at',s.eligible_at,'reversal_reason',s.reversal_reason,'created_at',s.created_at
  ) order by s.created_at desc),'[]'::jsonb) into settlements_json
  from public.provider_booking_settlements s where s.owner_user_id=owner_id;

  select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc),'[]'::jsonb) into payouts_json
  from public.provider_payout_batches b where b.owner_user_id=owner_id;

  select coalesce((select jsonb_build_object(
    'id',d.id,'gateway',d.gateway,'gateway_beneficiary_id',d.gateway_beneficiary_id,
    'destination_type',d.destination_type,'masked_destination',d.masked_destination,
    'beneficiary_name',d.beneficiary_name,'status',d.status,'gateway_status',d.gateway_status,
    'last_error_code',d.last_error_code,'last_error_message',d.last_error_message,
    'verified_at',d.verified_at,'created_at',d.created_at,'updated_at',d.updated_at
  ) from public.provider_payout_destinations d
  where d.owner_user_id=owner_id and d.status<>'deleted'
  order by d.created_at desc limit 1),'null'::jsonb) into destination_json;

  return jsonb_build_object('policies',policy_json,'summary',coalesce(summary_json,'{}'::jsonb),
    'settlements',settlements_json,'payouts',payouts_json,'payout_destination',destination_json);
end;
$$;
revoke all on function public.get_my_provider_finance_overview() from public,anon;
grant execute on function public.get_my_provider_finance_overview() to authenticated;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (event_type = any(array[
  'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
  'reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded',
  'review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
  'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
  'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
  'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected',
  'provider_reverification_required','provider_suspended','provider_restored',
  'provider_payout_prepared','provider_payout_cancelled','provider_payout_processing','provider_payout_paid','provider_payout_failed','provider_payout_reversed',
  'provider_payout_destination_updated'
]));