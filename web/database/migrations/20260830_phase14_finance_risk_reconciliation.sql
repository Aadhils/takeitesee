-- Phase 14 Module 6: gateway auto-refunds, disputes/chargebacks, finance holds and provider recovery ledger.
-- External payment truth is recorded independently from customer support issues.

create table if not exists public.payment_gateway_exceptions (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  exception_key text not null,
  event_type text not null,
  category text not null check (category in (
    'auto_refund','unmatched_auto_refund','noncanonical_auto_refund','partial_auto_refund',
    'unmatched_dispute','dispute_mismatch','partial_dispute_loss','gateway_exception'
  )),
  booking_id uuid references public.bookings(id) on delete set null,
  payment_intent_id uuid references public.booking_payment_intents(id) on delete set null,
  gateway_order_id text,
  gateway_payment_id text,
  gateway_reference text,
  amount_minor bigint check (amount_minor is null or amount_minor > 0),
  currency text check (currency is null or currency in ('INR','USD')),
  severity text not null check (severity in ('info','warning','critical')),
  status text not null check (status in ('open','resolved','ignored','recovery_required')),
  summary text not null check (char_length(summary) between 3 and 240),
  detail text check (detail is null or char_length(detail) <= 1000),
  payload_sha256 text check (payload_sha256 is null or char_length(payload_sha256) <= 128),
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  resolved_by uuid references public.users(id) on delete set null,
  resolved_at timestamptz,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  unique(gateway,exception_key)
);
create index if not exists payment_gateway_exceptions_status_seen_idx on public.payment_gateway_exceptions(status,last_seen_at desc);
create index if not exists payment_gateway_exceptions_booking_idx on public.payment_gateway_exceptions(booking_id,last_seen_at desc);

create table if not exists public.payment_gateway_exception_events (
  id uuid primary key default gen_random_uuid(),
  exception_id uuid not null references public.payment_gateway_exceptions(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  from_status text,
  to_status text not null,
  category text not null,
  severity text not null,
  summary text not null,
  detail text,
  recorded_at timestamptz not null default now()
);
create index if not exists payment_gateway_exception_events_exception_idx on public.payment_gateway_exception_events(exception_id,recorded_at desc);
create index if not exists payment_gateway_exception_events_booking_idx on public.payment_gateway_exception_events(booking_id,recorded_at desc);

create table if not exists public.payment_disputes (
  id uuid primary key default gen_random_uuid(),
  gateway text not null,
  gateway_dispute_id text not null,
  booking_id uuid references public.bookings(id) on delete set null,
  payment_intent_id uuid references public.booking_payment_intents(id) on delete set null,
  provider_owner_user_id uuid references public.users(id) on delete set null,
  gateway_order_id text,
  gateway_payment_id text,
  dispute_type text not null check (dispute_type in ('DISPUTE','RETRIEVAL','CHARGEBACK','PRE_ARBITRATION','ARBITRATION')),
  reason_code text,
  reason_description text,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('INR','USD')),
  gateway_status text not null,
  local_state text not null check (local_state in ('unmatched','action_required','under_review','won','lost','accepted','recovery_required')),
  dispute_action_on text check (dispute_action_on is null or dispute_action_on in ('MERCHANT','CASHFREE')),
  cf_remarks text check (cf_remarks is null or char_length(cf_remarks) <= 1000),
  respond_by timestamptz,
  gateway_created_at timestamptz,
  gateway_updated_at timestamptz,
  gateway_resolved_at timestamptz,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  unique(gateway,gateway_dispute_id)
);
create index if not exists payment_disputes_state_deadline_idx on public.payment_disputes(local_state,respond_by);
create index if not exists payment_disputes_booking_idx on public.payment_disputes(booking_id,last_seen_at desc);

create table if not exists public.payment_dispute_events (
  id uuid primary key default gen_random_uuid(),
  dispute_id uuid not null references public.payment_disputes(id) on delete restrict,
  booking_id uuid references public.bookings(id) on delete set null,
  event_type text not null,
  dispute_type text not null,
  from_gateway_status text,
  to_gateway_status text not null,
  from_local_state text,
  to_local_state text not null,
  dispute_action_on text,
  respond_by timestamptz,
  recorded_at timestamptz not null default now()
);
create index if not exists payment_dispute_events_dispute_idx on public.payment_dispute_events(dispute_id,recorded_at desc);
create index if not exists payment_dispute_events_booking_idx on public.payment_dispute_events(booking_id,recorded_at desc);

create table if not exists public.provider_finance_holds (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete restrict,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  source_type text not null check (source_type in ('dispute','auto_refund','exception')),
  source_reference text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('INR','USD')),
  status text not null check (status in ('open','released','recovery_required')),
  public_summary text not null check (char_length(public_summary) between 3 and 300),
  opened_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  released_at timestamptz,
  release_reason text check (release_reason is null or char_length(release_reason) <= 500),
  unique(source_type,source_reference)
);
create index if not exists provider_finance_holds_owner_status_idx on public.provider_finance_holds(owner_user_id,status,opened_at desc);
create index if not exists provider_finance_holds_booking_status_idx on public.provider_finance_holds(booking_id,status);

create table if not exists public.provider_finance_hold_events (
  id uuid primary key default gen_random_uuid(),
  hold_id uuid not null references public.provider_finance_holds(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  from_status text,
  to_status text not null,
  summary text not null,
  recorded_at timestamptz not null default now()
);
create index if not exists provider_finance_hold_events_hold_idx on public.provider_finance_hold_events(hold_id,recorded_at desc);

create table if not exists public.provider_recovery_entries (
  id uuid primary key default gen_random_uuid(),
  owner_user_id uuid not null references public.users(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  settlement_id uuid not null references public.provider_booking_settlements(id) on delete restrict,
  payout_batch_id uuid references public.provider_payout_batches(id) on delete set null,
  source_type text not null check (source_type in ('dispute','auto_refund','exception')),
  source_reference text not null,
  amount_minor bigint not null check (amount_minor > 0),
  currency text not null check (currency in ('INR','USD')),
  status text not null check (status in ('open','recovered','waived')),
  reason text not null check (char_length(reason) between 3 and 500),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_at timestamptz,
  resolved_by uuid references public.users(id) on delete set null,
  resolution_note text check (resolution_note is null or char_length(resolution_note) <= 500),
  unique(source_type,source_reference,settlement_id)
);
create index if not exists provider_recovery_entries_owner_status_idx on public.provider_recovery_entries(owner_user_id,status,created_at desc);
create index if not exists provider_recovery_entries_booking_idx on public.provider_recovery_entries(booking_id,created_at desc);

create table if not exists public.provider_recovery_events (
  id uuid primary key default gen_random_uuid(),
  recovery_id uuid not null references public.provider_recovery_entries(id) on delete restrict,
  booking_id uuid not null references public.bookings(id) on delete restrict,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  from_status text,
  to_status text not null,
  amount_minor bigint not null,
  currency text not null,
  recorded_at timestamptz not null default now()
);
create index if not exists provider_recovery_events_recovery_idx on public.provider_recovery_events(recovery_id,recorded_at desc);

alter table public.payment_gateway_exceptions enable row level security;
alter table public.payment_gateway_exception_events enable row level security;
alter table public.payment_disputes enable row level security;
alter table public.payment_dispute_events enable row level security;
alter table public.provider_finance_holds enable row level security;
alter table public.provider_finance_hold_events enable row level security;
alter table public.provider_recovery_entries enable row level security;
alter table public.provider_recovery_events enable row level security;

revoke insert,update,delete on public.payment_gateway_exceptions from anon,authenticated;
revoke insert,update,delete on public.payment_gateway_exception_events from anon,authenticated;
revoke insert,update,delete on public.payment_disputes from anon,authenticated;
revoke insert,update,delete on public.payment_dispute_events from anon,authenticated;
revoke insert,update,delete on public.provider_finance_holds from anon,authenticated;
revoke insert,update,delete on public.provider_finance_hold_events from anon,authenticated;
revoke insert,update,delete on public.provider_recovery_entries from anon,authenticated;
revoke insert,update,delete on public.provider_recovery_events from anon,authenticated;
grant select on public.payment_gateway_exceptions,public.payment_gateway_exception_events,public.payment_disputes,public.payment_dispute_events,public.provider_finance_holds,public.provider_finance_hold_events,public.provider_recovery_entries,public.provider_recovery_events to authenticated;

drop policy if exists payment_gateway_exceptions_finance_read on public.payment_gateway_exceptions;
create policy payment_gateway_exceptions_finance_read on public.payment_gateway_exceptions for select to authenticated using (
  public.is_super_admin() or public.admin_can_manage(null,null,null,null)
);
drop policy if exists payment_gateway_exception_events_finance_read on public.payment_gateway_exception_events;
create policy payment_gateway_exception_events_finance_read on public.payment_gateway_exception_events for select to authenticated using (
  public.is_super_admin() or public.admin_can_manage(null,null,null,null)
);
drop policy if exists payment_disputes_finance_read on public.payment_disputes;
create policy payment_disputes_finance_read on public.payment_disputes for select to authenticated using (
  public.is_super_admin() or public.admin_can_manage(null,null,null,null)
);
drop policy if exists payment_dispute_events_finance_read on public.payment_dispute_events;
create policy payment_dispute_events_finance_read on public.payment_dispute_events for select to authenticated using (
  public.is_super_admin() or public.admin_can_manage(null,null,null,null)
);
drop policy if exists provider_finance_holds_owner_read on public.provider_finance_holds;
create policy provider_finance_holds_owner_read on public.provider_finance_holds for select to authenticated using (
  owner_user_id=auth.uid() or public.is_super_admin() or public.admin_can_manage(null,null,null,null)
);
drop policy if exists provider_finance_hold_events_owner_read on public.provider_finance_hold_events;
create policy provider_finance_hold_events_owner_read on public.provider_finance_hold_events for select to authenticated using (
  owner_user_id=auth.uid() or public.is_super_admin() or public.admin_can_manage(null,null,null,null)
);
drop policy if exists provider_recovery_entries_owner_read on public.provider_recovery_entries;
create policy provider_recovery_entries_owner_read on public.provider_recovery_entries for select to authenticated using (
  owner_user_id=auth.uid() or public.is_super_admin() or public.admin_can_manage(null,null,null,null)
);
drop policy if exists provider_recovery_events_owner_read on public.provider_recovery_events;
create policy provider_recovery_events_owner_read on public.provider_recovery_events for select to authenticated using (
  owner_user_id=auth.uid() or public.is_super_admin() or public.admin_can_manage(null,null,null,null)
);

create or replace function public.record_payment_gateway_exception_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status and new.severity is not distinct from old.severity and new.summary is not distinct from old.summary and new.detail is not distinct from old.detail then return new; end if;
  insert into public.payment_gateway_exception_events(exception_id,booking_id,from_status,to_status,category,severity,summary,detail)
  values(new.id,new.booking_id,case when tg_op='INSERT' then null else old.status end,new.status,new.category,new.severity,new.summary,new.detail);
  return new;
end; $$;
revoke all on function public.record_payment_gateway_exception_event() from public,anon,authenticated;
drop trigger if exists payment_gateway_exception_event_history on public.payment_gateway_exceptions;
create trigger payment_gateway_exception_event_history after insert or update of status,severity,summary,detail on public.payment_gateway_exceptions for each row execute function public.record_payment_gateway_exception_event();

create or replace function public.record_payment_dispute_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.gateway_status is not distinct from old.gateway_status and new.local_state is not distinct from old.local_state and new.dispute_type is not distinct from old.dispute_type and new.dispute_action_on is not distinct from old.dispute_action_on and new.respond_by is not distinct from old.respond_by then return new; end if;
  insert into public.payment_dispute_events(dispute_id,booking_id,event_type,dispute_type,from_gateway_status,to_gateway_status,from_local_state,to_local_state,dispute_action_on,respond_by)
  values(new.id,new.booking_id,case when tg_op='INSERT' then 'DISPUTE_CREATED' else 'DISPUTE_UPDATED' end,new.dispute_type,case when tg_op='INSERT' then null else old.gateway_status end,new.gateway_status,case when tg_op='INSERT' then null else old.local_state end,new.local_state,new.dispute_action_on,new.respond_by);
  return new;
end; $$;
revoke all on function public.record_payment_dispute_event() from public,anon,authenticated;
drop trigger if exists payment_dispute_event_history on public.payment_disputes;
create trigger payment_dispute_event_history after insert or update of gateway_status,local_state,dispute_type,dispute_action_on,respond_by on public.payment_disputes for each row execute function public.record_payment_dispute_event();

create or replace function public.record_provider_finance_hold_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status and new.public_summary is not distinct from old.public_summary then return new; end if;
  insert into public.provider_finance_hold_events(hold_id,booking_id,owner_user_id,from_status,to_status,summary)
  values(new.id,new.booking_id,new.owner_user_id,case when tg_op='INSERT' then null else old.status end,new.status,new.public_summary);
  return new;
end; $$;
revoke all on function public.record_provider_finance_hold_event() from public,anon,authenticated;
drop trigger if exists provider_finance_hold_event_history on public.provider_finance_holds;
create trigger provider_finance_hold_event_history after insert or update of status,public_summary on public.provider_finance_holds for each row execute function public.record_provider_finance_hold_event();

create or replace function public.record_provider_recovery_event()
returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status then return new; end if;
  insert into public.provider_recovery_events(recovery_id,booking_id,owner_user_id,from_status,to_status,amount_minor,currency)
  values(new.id,new.booking_id,new.owner_user_id,case when tg_op='INSERT' then null else old.status end,new.status,new.amount_minor,new.currency);
  return new;
end; $$;
revoke all on function public.record_provider_recovery_event() from public,anon,authenticated;
drop trigger if exists provider_recovery_event_history on public.provider_recovery_entries;
create trigger provider_recovery_event_history after insert or update of status on public.provider_recovery_entries for each row execute function public.record_provider_recovery_event();

create or replace function public.internal_provider_owner_for_booking(target_booking_id uuid)
returns uuid language plpgsql stable security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; owner_id uuid;
begin
  select * into b from public.bookings where id=target_booking_id;
  if not found then return null; end if;
  if b.provider_type::text='business' then select owner_user_id into owner_id from public.businesses where id=b.business_id;
  else select user_id into owner_id from public.professional_profiles where id=b.professional_id; end if;
  return owner_id;
end; $$;
revoke all on function public.internal_provider_owner_for_booking(uuid) from public,anon,authenticated;

create or replace function public.internal_ensure_provider_finance_hold(
  target_booking_id uuid,target_source_type text,target_source_reference text,target_amount_minor bigint,target_currency text,target_public_summary text
) returns public.provider_finance_holds
language plpgsql security definer set search_path=public,pg_temp as $$
declare hold_row public.provider_finance_holds%rowtype; settlement_row public.provider_booking_settlements%rowtype; batch_row public.provider_payout_batches%rowtype; owner_id uuid; was_existing boolean:=false; remaining_count integer; remaining_gross bigint; remaining_fee bigint; remaining_net bigint;
begin
  if target_source_type not in ('dispute','auto_refund','exception') then raise exception 'Finance hold source type is invalid.'; end if;
  if target_amount_minor<=0 then raise exception 'Finance hold amount must be positive.'; end if;
  owner_id:=public.internal_provider_owner_for_booking(target_booking_id);
  if owner_id is null then raise exception 'Provider owner was not found for finance hold.'; end if;
  select * into hold_row from public.provider_finance_holds where source_type=target_source_type and source_reference=target_source_reference for update;
  was_existing:=found;
  if found then
    update public.provider_finance_holds set booking_id=target_booking_id,owner_user_id=owner_id,amount_minor=target_amount_minor,currency=target_currency,
      status=case when status='released' then 'open' else status end,public_summary=left(target_public_summary,300),updated_at=now(),released_at=null,release_reason=null
    where id=hold_row.id returning * into hold_row;
  else
    insert into public.provider_finance_holds(booking_id,owner_user_id,source_type,source_reference,amount_minor,currency,status,public_summary)
    values(target_booking_id,owner_id,target_source_type,target_source_reference,target_amount_minor,target_currency,'open',left(target_public_summary,300)) returning * into hold_row;
  end if;

  select * into settlement_row from public.provider_booking_settlements where booking_id=target_booking_id for update;
  if found and settlement_row.status='assigned' then
    select b.* into batch_row from public.provider_payout_items i join public.provider_payout_batches b on b.id=i.payout_batch_id
    where i.settlement_id=settlement_row.id order by b.created_at desc limit 1 for update of b;
    if found and batch_row.status='ready' then
      delete from public.provider_payout_items where payout_batch_id=batch_row.id and settlement_id=settlement_row.id;
      update public.provider_booking_settlements set status=case when eligible_at<=now() then 'available' else 'held' end,updated_at=now() where id=settlement_row.id;
      select count(i.id)::int,coalesce(sum(s.gross_minor),0)::bigint,coalesce(sum(s.platform_fee_minor),0)::bigint,coalesce(sum(i.provider_net_minor),0)::bigint
      into remaining_count,remaining_gross,remaining_fee,remaining_net from public.provider_payout_items i join public.provider_booking_settlements s on s.id=i.settlement_id where i.payout_batch_id=batch_row.id;
      if remaining_count=0 then
        update public.provider_payout_batches set status='cancelled',failure_message='Payout cancelled because a payment risk hold was opened.',updated_at=now() where id=batch_row.id;
      else
        update public.provider_payout_batches set settlement_count=remaining_count,gross_minor=remaining_gross,platform_fee_minor=remaining_fee,provider_net_minor=remaining_net,updated_at=now() where id=batch_row.id;
      end if;
    end if;
  end if;
  if not was_existing then
    insert into public.notifications(recipient_user_id,booking_id,event_type,title,body)
    values(owner_id,target_booking_id,'provider_finance_hold','Payout balance under finance review',left(target_public_summary,500));
  end if;
  return hold_row;
end; $$;
revoke all on function public.internal_ensure_provider_finance_hold(uuid,text,text,bigint,text,text) from public,anon,authenticated;

create or replace function public.internal_release_finance_hold(target_source_type text,target_source_reference text,target_reason text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  update public.provider_finance_holds set status='released',released_at=now(),release_reason=left(target_reason,500),updated_at=now()
  where source_type=target_source_type and source_reference=target_source_reference and status<>'released';
end; $$;
revoke all on function public.internal_release_finance_hold(text,text,text) from public,anon,authenticated;

create or replace function public.internal_release_booking_holds_if_clear(target_booking_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if exists(select 1 from public.payment_disputes d where d.booking_id=target_booking_id and d.local_state in ('action_required','under_review','recovery_required','unmatched')) then return; end if;
  if exists(select 1 from public.payment_gateway_exceptions e where e.booking_id=target_booking_id and e.status in ('open','recovery_required')) then return; end if;
  if exists(select 1 from public.provider_recovery_entries r where r.booking_id=target_booking_id and r.status='open') then return; end if;
  update public.provider_finance_holds set status='released',released_at=coalesce(released_at,now()),release_reason=coalesce(release_reason,'Finance risk cleared.'),updated_at=now()
  where booking_id=target_booking_id and status<>'released';
end; $$;
revoke all on function public.internal_release_booking_holds_if_clear(uuid) from public,anon,authenticated;

create or replace function public.internal_ensure_provider_recovery(target_booking_id uuid,target_source_type text,target_source_reference text,target_loss_minor bigint,target_currency text,target_reason text)
returns public.provider_recovery_entries
language plpgsql security definer set search_path=public,pg_temp as $$
declare settlement_row public.provider_booking_settlements%rowtype; batch_row public.provider_payout_batches%rowtype; recovery_row public.provider_recovery_entries%rowtype; recovery_amount bigint; existing boolean:=false;
begin
  select * into settlement_row from public.provider_booking_settlements where booking_id=target_booking_id for update;
  if not found or settlement_row.status<>'paid' then return null; end if;
  select b.* into batch_row from public.provider_payout_items i join public.provider_payout_batches b on b.id=i.payout_batch_id
  where i.settlement_id=settlement_row.id and b.status='paid' order by b.paid_at desc nulls last,b.created_at desc limit 1;
  if not found then return null; end if;
  recovery_amount:=least(settlement_row.provider_net_minor,round((target_loss_minor::numeric*settlement_row.provider_net_minor::numeric)/settlement_row.gross_minor::numeric)::bigint);
  if recovery_amount<=0 then return null; end if;
  select * into recovery_row from public.provider_recovery_entries where source_type=target_source_type and source_reference=target_source_reference and settlement_id=settlement_row.id for update;
  existing:=found;
  if found then return recovery_row; end if;
  insert into public.provider_recovery_entries(owner_user_id,booking_id,settlement_id,payout_batch_id,source_type,source_reference,amount_minor,currency,status,reason)
  values(settlement_row.owner_user_id,target_booking_id,settlement_row.id,batch_row.id,target_source_type,target_source_reference,recovery_amount,target_currency,'open',left(target_reason,500)) returning * into recovery_row;
  update public.provider_finance_holds set status='recovery_required',updated_at=now() where source_type=target_source_type and source_reference=target_source_reference and status<>'released';
  if not existing then
    insert into public.notifications(recipient_user_id,booking_id,event_type,title,body)
    values(settlement_row.owner_user_id,target_booking_id,'provider_recovery_required','Provider payout recovery required','A payment reversal or dispute affected a booking that had already been paid out. Finance recovery is required before another payout can be prepared.');
  end if;
  return recovery_row;
end; $$;
revoke all on function public.internal_ensure_provider_recovery(uuid,text,text,bigint,text,text) from public,anon,authenticated;

create or replace function public.gateway_upsert_payment_exception(
  target_exception_key text,target_event_type text,target_category text,target_booking_id uuid,target_payment_intent_id uuid,
  target_gateway_order_id text,target_gateway_payment_id text,target_gateway_reference text,target_amount_minor bigint,target_currency text,
  target_severity text,target_status text,target_summary text,target_detail text,target_payload_sha256 text
) returns public.payment_gateway_exceptions
language plpgsql security definer set search_path=public,pg_temp as $$
declare row_value public.payment_gateway_exceptions%rowtype;
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for gateway exception reconciliation.'; end if;
  insert into public.payment_gateway_exceptions(gateway,exception_key,event_type,category,booking_id,payment_intent_id,gateway_order_id,gateway_payment_id,gateway_reference,amount_minor,currency,severity,status,summary,detail,payload_sha256)
  values('cashfree',left(target_exception_key,240),left(target_event_type,120),target_category,target_booking_id,target_payment_intent_id,nullif(left(target_gateway_order_id,200),''),nullif(left(target_gateway_payment_id,200),''),nullif(left(target_gateway_reference,200),''),target_amount_minor,target_currency,target_severity,target_status,left(target_summary,240),nullif(left(target_detail,1000),''),nullif(left(target_payload_sha256,128),''))
  on conflict(gateway,exception_key) do update set event_type=excluded.event_type,category=excluded.category,booking_id=coalesce(excluded.booking_id,payment_gateway_exceptions.booking_id),payment_intent_id=coalesce(excluded.payment_intent_id,payment_gateway_exceptions.payment_intent_id),gateway_order_id=coalesce(excluded.gateway_order_id,payment_gateway_exceptions.gateway_order_id),gateway_payment_id=coalesce(excluded.gateway_payment_id,payment_gateway_exceptions.gateway_payment_id),gateway_reference=coalesce(excluded.gateway_reference,payment_gateway_exceptions.gateway_reference),amount_minor=coalesce(excluded.amount_minor,payment_gateway_exceptions.amount_minor),currency=coalesce(excluded.currency,payment_gateway_exceptions.currency),severity=excluded.severity,status=excluded.status,summary=excluded.summary,detail=excluded.detail,payload_sha256=coalesce(excluded.payload_sha256,payment_gateway_exceptions.payload_sha256),last_seen_at=now()
  returning * into row_value;
  return row_value;
end; $$;
revoke all on function public.gateway_upsert_payment_exception(text,text,text,uuid,uuid,text,text,text,bigint,text,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gateway_upsert_payment_exception(text,text,text,uuid,uuid,text,text,text,bigint,text,text,text,text,text,text) to service_role;

create or replace function public.validate_booking_payment_transition()
returns trigger language plpgsql set search_path=public as $$
begin
  if new.payment_status=old.payment_status then return new; end if;
  if not ((old.payment_status='unpaid' and new.payment_status in ('pending','paid')) or (old.payment_status='pending' and new.payment_status in ('unpaid','paid','failed')) or (old.payment_status='failed' and new.payment_status in ('unpaid','pending')) or (old.payment_status='paid' and new.payment_status='refunded')) then raise exception 'Invalid payment transition from % to %.',old.payment_status,new.payment_status; end if;
  if new.payment_status='paid' and new.status='cancelled' then raise exception 'A cancelled booking cannot be newly marked paid.'; end if;
  if new.payment_status='refunded' and new.status not in ('cancelled','completed') and coalesce(current_setting('takeitesee.payment_source',true),'')<>'gateway' then raise exception 'Manual refunds are allowed only for cancelled or completed bookings.'; end if;
  return new;
end; $$;

create or replace function public.gateway_apply_cashfree_auto_refund(
  target_cf_refund_id text,target_cf_payment_id text,target_order_id text,target_amount_minor bigint,target_currency text,
  target_refund_status text,target_refund_reason text,target_status_description text,target_payload_sha256 text
) returns public.payment_gateway_exceptions
language plpgsql security definer set search_path=public,pg_temp as $$
declare intent_row public.booking_payment_intents%rowtype; order_intent public.booking_payment_intents%rowtype; booking_row public.bookings%rowtype; exception_row public.payment_gateway_exceptions%rowtype; settlement_row public.provider_booking_settlements%rowtype; source_ref text:='auto:'||target_cf_refund_id; status_value text:=upper(btrim(coalesce(target_refund_status,'')));
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for auto-refund reconciliation.'; end if;
  if status_value<>'SUCCESS' then
    return public.gateway_upsert_payment_exception(source_ref,'AUTO_REFUND_STATUS_WEBHOOK','auto_refund',null,null,target_order_id,target_cf_payment_id,target_cf_refund_id,target_amount_minor,target_currency,'warning','open','Cashfree auto-refund status requires review',coalesce(target_status_description,'Auto-refund has not reached SUCCESS.'),target_payload_sha256);
  end if;
  select * into intent_row from public.booking_payment_intents where gateway='cashfree' and gateway_session_id=target_order_id and gateway_payment_id=target_cf_payment_id order by created_at desc limit 1;
  if not found then
    select * into order_intent from public.booking_payment_intents where gateway='cashfree' and gateway_session_id=target_order_id order by created_at desc limit 1;
    if found then
      return public.gateway_upsert_payment_exception(source_ref,'AUTO_REFUND_STATUS_WEBHOOK','noncanonical_auto_refund',order_intent.booking_id,order_intent.id,target_order_id,target_cf_payment_id,target_cf_refund_id,target_amount_minor,target_currency,'info','resolved','Extra payment auto-refunded by Cashfree','Cashfree refunded a payment attempt that is not the canonical successful Takeitesee payment for this order.',target_payload_sha256);
    end if;
    return public.gateway_upsert_payment_exception(source_ref,'AUTO_REFUND_STATUS_WEBHOOK','unmatched_auto_refund',null,null,target_order_id,target_cf_payment_id,target_cf_refund_id,target_amount_minor,target_currency,'warning','open','Unmatched Cashfree auto-refund','Cashfree reported an auto-refund that is not linked to a Takeitesee payment intent.',target_payload_sha256);
  end if;
  if intent_row.status<>'succeeded' then
    return public.gateway_upsert_payment_exception(source_ref,'AUTO_REFUND_STATUS_WEBHOOK','noncanonical_auto_refund',intent_row.booking_id,intent_row.id,target_order_id,target_cf_payment_id,target_cf_refund_id,target_amount_minor,target_currency,'info','resolved','Unsuccessful payment attempt auto-refunded','The gateway auto-refunded a payment attempt that Takeitesee never treated as a successful booking payment.',target_payload_sha256);
  end if;
  if target_amount_minor<>intent_row.amount_minor or target_currency<>intent_row.currency then
    exception_row:=public.gateway_upsert_payment_exception(source_ref,'AUTO_REFUND_STATUS_WEBHOOK','partial_auto_refund',intent_row.booking_id,intent_row.id,target_order_id,target_cf_payment_id,target_cf_refund_id,target_amount_minor,target_currency,'critical','recovery_required','Auto-refund amount does not match booking payment','The auto-refund is partial or has a currency/amount mismatch and cannot be represented by the single booking payment status.',target_payload_sha256);
    perform public.internal_ensure_provider_finance_hold(intent_row.booking_id,'auto_refund',source_ref,target_amount_minor,target_currency,'A gateway auto-refund requires finance review before provider payout.');
    return exception_row;
  end if;
  exception_row:=public.gateway_upsert_payment_exception(source_ref,'AUTO_REFUND_STATUS_WEBHOOK','auto_refund',intent_row.booking_id,intent_row.id,target_order_id,target_cf_payment_id,target_cf_refund_id,target_amount_minor,target_currency,'warning','open','Cashfree automatically refunded the booking payment',coalesce(target_refund_reason,target_status_description,'The payment gateway automatically refunded the successful booking payment.'),target_payload_sha256);
  perform public.internal_ensure_provider_finance_hold(intent_row.booking_id,'auto_refund',source_ref,target_amount_minor,target_currency,'A successful booking payment was automatically refunded by the payment gateway.');
  select * into booking_row from public.bookings where id=intent_row.booking_id for update;
  if booking_row.payment_status='paid' then
    perform set_config('takeitesee.payment_source','gateway',true);
    perform set_config('takeitesee.payment_note','Cashfree auto-refund completed successfully.',true);
    perform set_config('takeitesee.payment_reference',target_cf_refund_id,true);
    update public.bookings set payment_status='refunded',updated_at=now() where id=booking_row.id;
  end if;
  select * into settlement_row from public.provider_booking_settlements where booking_id=intent_row.booking_id;
  if found and settlement_row.status='paid' then
    perform public.internal_ensure_provider_recovery(intent_row.booking_id,'auto_refund',source_ref,target_amount_minor,target_currency,'Cashfree auto-refunded a booking after the provider payout had completed.');
    update public.payment_gateway_exceptions set status='recovery_required',severity='critical',last_seen_at=now() where id=exception_row.id returning * into exception_row;
  elsif found and settlement_row.status='assigned' then
    update public.payment_gateway_exceptions set status='recovery_required',severity='critical',detail='The provider payout is already processing. Recovery will be evaluated when the transfer reaches a terminal state.',last_seen_at=now() where id=exception_row.id returning * into exception_row;
  else
    update public.payment_gateway_exceptions set status='resolved',severity='info',resolved_at=now(),resolution_note='Auto-refund reconciled to the booking payment ledger before provider funds escaped.',last_seen_at=now() where id=exception_row.id returning * into exception_row;
    perform public.internal_release_finance_hold('auto_refund',source_ref,'Auto-refund reconciled before provider payout.');
  end if;
  perform public.internal_release_booking_holds_if_clear(intent_row.booking_id);
  return exception_row;
end; $$;
revoke all on function public.gateway_apply_cashfree_auto_refund(text,text,text,bigint,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gateway_apply_cashfree_auto_refund(text,text,text,bigint,text,text,text,text,text) to service_role;

create or replace function public.gateway_upsert_cashfree_dispute(
  target_gateway_dispute_id text,target_event_type text,target_dispute_type text,target_reason_code text,target_reason_description text,
  target_amount_minor bigint,target_currency text,target_gateway_status text,target_dispute_action_on text,target_cf_remarks text,
  target_respond_by timestamptz,target_gateway_created_at timestamptz,target_gateway_updated_at timestamptz,target_gateway_resolved_at timestamptz,
  target_order_id text,target_cf_payment_id text,target_payload_sha256 text
) returns public.payment_disputes
language plpgsql security definer set search_path=public,pg_temp as $$
declare intent_row public.booking_payment_intents%rowtype; booking_row public.bookings%rowtype; dispute_row public.payment_disputes%rowtype; settlement_row public.provider_booking_settlements%rowtype; owner_id uuid; state_value text; source_ref text:='dispute:'||target_gateway_dispute_id; gateway_status_value text:=upper(btrim(coalesce(target_gateway_status,''))); is_new boolean:=false;
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for dispute reconciliation.'; end if;
  state_value:=case
    when gateway_status_value like '%_MERCHANT_WON' then 'won'
    when gateway_status_value like '%_MERCHANT_LOST' then 'lost'
    when gateway_status_value like '%_MERCHANT_ACCEPTED' then 'accepted'
    when gateway_status_value like '%_UNDER_REVIEW' or gateway_status_value like '%_DOCS_RECEIVED' then 'under_review'
    when gateway_status_value like '%_CREATED' or gateway_status_value like '%_INSUFFICIENT_EVIDENCE' then 'action_required'
    else 'under_review' end;
  select * into intent_row from public.booking_payment_intents where gateway='cashfree' and gateway_session_id=target_order_id and gateway_payment_id=target_cf_payment_id order by created_at desc limit 1;
  if not found then state_value:='unmatched'; else owner_id:=public.internal_provider_owner_for_booking(intent_row.booking_id); end if;
  select * into dispute_row from public.payment_disputes where gateway='cashfree' and gateway_dispute_id=target_gateway_dispute_id for update;
  is_new:=not found;
  insert into public.payment_disputes(gateway,gateway_dispute_id,booking_id,payment_intent_id,provider_owner_user_id,gateway_order_id,gateway_payment_id,dispute_type,reason_code,reason_description,amount_minor,currency,gateway_status,local_state,dispute_action_on,cf_remarks,respond_by,gateway_created_at,gateway_updated_at,gateway_resolved_at)
  values('cashfree',target_gateway_dispute_id,case when state_value='unmatched' then null else intent_row.booking_id end,case when state_value='unmatched' then null else intent_row.id end,owner_id,target_order_id,target_cf_payment_id,target_dispute_type,target_reason_code,left(target_reason_description,500),target_amount_minor,target_currency,gateway_status_value,state_value,nullif(target_dispute_action_on,''),nullif(left(target_cf_remarks,1000),''),target_respond_by,target_gateway_created_at,target_gateway_updated_at,target_gateway_resolved_at)
  on conflict(gateway,gateway_dispute_id) do update set booking_id=coalesce(excluded.booking_id,payment_disputes.booking_id),payment_intent_id=coalesce(excluded.payment_intent_id,payment_disputes.payment_intent_id),provider_owner_user_id=coalesce(excluded.provider_owner_user_id,payment_disputes.provider_owner_user_id),gateway_order_id=excluded.gateway_order_id,gateway_payment_id=excluded.gateway_payment_id,dispute_type=excluded.dispute_type,reason_code=excluded.reason_code,reason_description=excluded.reason_description,amount_minor=excluded.amount_minor,currency=excluded.currency,gateway_status=excluded.gateway_status,local_state=excluded.local_state,dispute_action_on=excluded.dispute_action_on,cf_remarks=excluded.cf_remarks,respond_by=excluded.respond_by,gateway_created_at=coalesce(excluded.gateway_created_at,payment_disputes.gateway_created_at),gateway_updated_at=coalesce(excluded.gateway_updated_at,now()),gateway_resolved_at=coalesce(excluded.gateway_resolved_at,payment_disputes.gateway_resolved_at),last_seen_at=now()
  returning * into dispute_row;
  if state_value='unmatched' then
    perform public.gateway_upsert_payment_exception(source_ref,target_event_type,'unmatched_dispute',null,null,target_order_id,target_cf_payment_id,target_gateway_dispute_id,target_amount_minor,target_currency,'critical','open','Unmatched Cashfree payment dispute','A Cashfree dispute could not be matched to the exact Takeitesee payment attempt.',target_payload_sha256);
    return dispute_row;
  end if;
  if target_currency<>intent_row.currency or target_amount_minor>intent_row.amount_minor then
    perform public.gateway_upsert_payment_exception(source_ref||':mismatch',target_event_type,'dispute_mismatch',intent_row.booking_id,intent_row.id,target_order_id,target_cf_payment_id,target_gateway_dispute_id,target_amount_minor,target_currency,'critical','recovery_required','Dispute amount or currency mismatch','The dispute amount/currency exceeds or conflicts with the matched Takeitesee payment.',target_payload_sha256);
    perform public.internal_ensure_provider_finance_hold(intent_row.booking_id,'dispute',source_ref,target_amount_minor,target_currency,'A payment dispute requires finance review before provider payout.');
    update public.payment_disputes set local_state='recovery_required' where id=dispute_row.id returning * into dispute_row;
    return dispute_row;
  end if;

  if state_value in ('action_required','under_review') then
    perform public.internal_ensure_provider_finance_hold(intent_row.booking_id,'dispute',source_ref,target_amount_minor,target_currency,'A customer payment dispute is under review. Provider payout is temporarily held.');
    if is_new and owner_id is not null then insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(owner_id,intent_row.booking_id,'payment_dispute_opened','Payment dispute opened','A payment dispute was opened for a booking. The related provider balance is held until the dispute is resolved.'); end if;
    return dispute_row;
  end if;

  if state_value='won' then
    perform public.internal_release_finance_hold('dispute',source_ref,'Cashfree dispute closed in the merchant’s favour.');
    perform public.internal_release_booking_holds_if_clear(intent_row.booking_id);
    if owner_id is not null then insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(owner_id,intent_row.booking_id,'payment_dispute_resolved','Payment dispute resolved','The payment dispute was resolved in the merchant’s favour. Any related finance hold can now clear.'); end if;
    return dispute_row;
  end if;

  -- Merchant lost or accepted. Full losses can reconcile the single booking payment state; partial losses need finance recovery review.
  perform public.internal_ensure_provider_finance_hold(intent_row.booking_id,'dispute',source_ref,target_amount_minor,target_currency,'A payment dispute resulted in a financial loss and requires settlement reconciliation.');
  if target_amount_minor=intent_row.amount_minor then
    select * into booking_row from public.bookings where id=intent_row.booking_id for update;
    if booking_row.payment_status='paid' then
      perform set_config('takeitesee.payment_source','gateway',true);
      perform set_config('takeitesee.payment_note','Cashfree dispute resulted in a full payment reversal.',true);
      perform set_config('takeitesee.payment_reference',target_gateway_dispute_id,true);
      update public.bookings set payment_status='refunded',updated_at=now() where id=booking_row.id;
    end if;
    select * into settlement_row from public.provider_booking_settlements where booking_id=intent_row.booking_id;
    if found and settlement_row.status='paid' then
      perform public.internal_ensure_provider_recovery(intent_row.booking_id,'dispute',source_ref,target_amount_minor,target_currency,'A Cashfree dispute was lost or accepted after provider payout completed.');
      update public.payment_disputes set local_state='recovery_required' where id=dispute_row.id returning * into dispute_row;
    elsif found and settlement_row.status='assigned' then
      update public.payment_disputes set local_state='recovery_required' where id=dispute_row.id returning * into dispute_row;
    else
      perform public.internal_release_finance_hold('dispute',source_ref,'Full dispute loss reconciled before provider funds escaped.');
    end if;
  else
    perform public.gateway_upsert_payment_exception(source_ref||':partial',target_event_type,'partial_dispute_loss',intent_row.booking_id,intent_row.id,target_order_id,target_cf_payment_id,target_gateway_dispute_id,target_amount_minor,target_currency,'critical','recovery_required','Partial dispute loss requires finance recovery','The dispute amount is smaller than the captured booking payment and cannot be represented by the single booking payment status.',target_payload_sha256);
    select * into settlement_row from public.provider_booking_settlements where booking_id=intent_row.booking_id;
    if found and settlement_row.status='paid' then perform public.internal_ensure_provider_recovery(intent_row.booking_id,'dispute',source_ref,target_amount_minor,target_currency,'A partial Cashfree dispute loss occurred after provider payout completed.'); end if;
    update public.payment_disputes set local_state='recovery_required' where id=dispute_row.id returning * into dispute_row;
  end if;
  if owner_id is not null then insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(owner_id,intent_row.booking_id,'payment_dispute_resolved','Payment dispute closed','The payment dispute has closed with a financial impact. Finance reconciliation may be required before future payouts.'); end if;
  perform public.internal_release_booking_holds_if_clear(intent_row.booking_id);
  return dispute_row;
end; $$;
revoke all on function public.gateway_upsert_cashfree_dispute(text,text,text,text,text,bigint,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text) from public,anon,authenticated;
grant execute on function public.gateway_upsert_cashfree_dispute(text,text,text,text,text,bigint,text,text,text,text,timestamptz,timestamptz,timestamptz,timestamptz,text,text,text) to service_role;

create or replace function public.internal_reconcile_booking_risk_after_payout(target_booking_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.payment_disputes%rowtype; e public.payment_gateway_exceptions%rowtype;
begin
  for d in select * from public.payment_disputes where booking_id=target_booking_id and (gateway_status like '%_MERCHANT_LOST' or gateway_status like '%_MERCHANT_ACCEPTED') loop
    perform public.internal_ensure_provider_recovery(target_booking_id,'dispute','dispute:'||d.gateway_dispute_id,d.amount_minor,d.currency,'Provider payout completed after a payment dispute had already created a financial loss.');
    update public.payment_disputes set local_state='recovery_required',last_seen_at=now() where id=d.id;
  end loop;
  for e in select * from public.payment_gateway_exceptions where booking_id=target_booking_id and category='auto_refund' and status in ('open','recovery_required') loop
    perform public.internal_ensure_provider_recovery(target_booking_id,'auto_refund',e.exception_key,e.amount_minor,e.currency,'Provider payout completed after Cashfree auto-refunded the booking payment.');
    update public.payment_gateway_exceptions set status='recovery_required',severity='critical',last_seen_at=now() where id=e.id;
  end loop;
end; $$;
revoke all on function public.internal_reconcile_booking_risk_after_payout(uuid) from public,anon,authenticated;

create or replace function public.internal_reconcile_booking_risk_after_transfer_return(target_booking_id uuid,target_batch_id uuid)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare d public.payment_disputes%rowtype; e public.payment_gateway_exceptions%rowtype;
begin
  update public.provider_recovery_entries set status='recovered',resolved_at=now(),resolution_note='The payout transfer was reversed by the gateway, so provider funds returned automatically.',updated_at=now()
  where booking_id=target_booking_id and payout_batch_id=target_batch_id and status='open';
  for d in select * from public.payment_disputes where booking_id=target_booking_id and local_state='recovery_required' and (gateway_status like '%_MERCHANT_LOST' or gateway_status like '%_MERCHANT_ACCEPTED') loop
    if d.amount_minor=(select amount_minor from public.booking_payment_intents where id=d.payment_intent_id) then update public.payment_disputes set local_state=case when gateway_status like '%_MERCHANT_ACCEPTED' then 'accepted' else 'lost' end where id=d.id; end if;
  end loop;
  for e in select * from public.payment_gateway_exceptions where booking_id=target_booking_id and category='auto_refund' and status='recovery_required' loop
    update public.payment_gateway_exceptions set status='resolved',severity='info',resolved_at=coalesce(resolved_at,now()),resolution_note='Provider payout did not escape or was reversed; auto-refund financial risk is reconciled.',last_seen_at=now() where id=e.id;
  end loop;
  perform public.internal_release_booking_holds_if_clear(target_booking_id);
end; $$;
revoke all on function public.internal_reconcile_booking_risk_after_transfer_return(uuid,uuid) from public,anon,authenticated;

create or replace function public.admin_prepare_provider_payout(target_owner_user_id uuid,target_currency text)
returns public.provider_payout_batches
language plpgsql security definer set search_path=public,pg_temp as $$
declare policy_row public.platform_finance_policies%rowtype; batch_row public.provider_payout_batches%rowtype; identity_row public.provider_booking_settlements%rowtype; gross_value bigint; fee_value bigint; net_value bigint; count_value integer; currency_value text:=upper(btrim(coalesce(target_currency,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  select * into policy_row from public.platform_finance_policies where currency=currency_value and active=true;
  if not found then raise exception 'An active finance policy is required before preparing payouts.'; end if;
  if exists(select 1 from public.provider_recovery_entries where owner_user_id=target_owner_user_id and currency=currency_value and status='open') then raise exception 'Provider has an outstanding finance recovery balance. Resolve the recovery before preparing another payout.'; end if;
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
  select count(*)::int,coalesce(sum(s.gross_minor),0)::bigint,coalesce(sum(s.platform_fee_minor),0)::bigint,coalesce(sum(s.provider_net_minor),0)::bigint into count_value,gross_value,fee_value,net_value
  from public.provider_booking_settlements s where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='available'
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'))
    and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'));
  if count_value=0 or net_value<=0 then raise exception 'No provider funds are currently available for payout.'; end if;
  if net_value<policy_row.minimum_payout_minor then raise exception 'Available balance is below the configured minimum payout.'; end if;
  insert into public.provider_payout_batches(provider_type,professional_id,business_id,owner_user_id,currency,status,settlement_count,gross_minor,platform_fee_minor,provider_net_minor,created_by)
  values(identity_row.provider_type,identity_row.professional_id,identity_row.business_id,target_owner_user_id,currency_value,'ready',count_value,gross_value,fee_value,net_value,auth.uid()) returning * into batch_row;
  insert into public.provider_payout_items(payout_batch_id,settlement_id,provider_net_minor)
  select batch_row.id,s.id,s.provider_net_minor from public.provider_booking_settlements s where s.owner_user_id=target_owner_user_id and s.currency=currency_value and s.status='available'
    and not exists(select 1 from public.booking_refunds r where r.booking_id=s.booking_id and r.status in ('created','pending','onhold','requires_review'))
    and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required'));
  update public.provider_booking_settlements s set status='assigned',updated_at=now() where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id);
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) values(auth.uid(),'finance.payout.prepared','provider_payout',batch_row.id::text,jsonb_build_object('owner_user_id',target_owner_user_id,'currency',currency_value,'settlement_count',count_value,'gross_minor',gross_value,'platform_fee_minor',fee_value,'provider_net_minor',net_value));
  insert into public.notifications(recipient_user_id,event_type,title,body) values(target_owner_user_id,'provider_payout_prepared','Provider payout prepared','A provider payout batch has been prepared for '||currency_value||' '||to_char(net_value/100.0,'FM9999999990.00')||'.');
  return batch_row;
end; $$;
revoke all on function public.admin_prepare_provider_payout(uuid,text) from public,anon;
grant execute on function public.admin_prepare_provider_payout(uuid,text) to authenticated;

create or replace function public.gateway_apply_provider_payout_transfer_status(target_batch_id uuid,target_gateway_status text,target_gateway_status_code text,target_gateway_status_description text default null,target_gateway_transfer_id text default null,target_transfer_utr text default null)
returns public.provider_payout_batches language plpgsql security definer set search_path=public,pg_temp as $$
declare batch_row public.provider_payout_batches%rowtype; old_status text; status_value text:=upper(btrim(coalesce(target_gateway_status,''))); code_value text:=upper(btrim(coalesce(target_gateway_status_code,''))); description_value text:=nullif(left(btrim(coalesce(target_gateway_status_description,'')),500),''); gateway_id_value text:=nullif(left(btrim(coalesce(target_gateway_transfer_id,'')),200),''); utr_value text:=nullif(left(btrim(coalesce(target_transfer_utr,'')),200),''); settlement_record record;
begin
  if auth.role()<>'service_role' then raise exception 'Service role is required for payout gateway reconciliation.'; end if;
  if status_value='' then raise exception 'Gateway payout status is required.'; end if;
  select * into batch_row from public.provider_payout_batches where id=target_batch_id for update;
  if not found then raise exception 'Payout batch was not found.'; end if;
  old_status:=batch_row.status;
  if old_status='reversed' then return batch_row; end if;
  if old_status in ('failed','cancelled') then return batch_row; end if;
  if old_status='paid' and status_value<>'REVERSED' then return batch_row; end if;
  update public.provider_payout_batches set gateway_transfer_id=coalesce(gateway_id_value,gateway_transfer_id),transfer_status=status_value,transfer_status_code=nullif(code_value,''),transfer_status_description=description_value,transfer_utr=coalesce(utr_value,transfer_utr),updated_at=now() where id=batch_row.id returning * into batch_row;
  if status_value='SUCCESS' and code_value='COMPLETED' then
    update public.provider_payout_batches set status='paid',paid_at=coalesce(paid_at,now()),completed_at=coalesce(completed_at,now()),external_reference=coalesce(utr_value,gateway_id_value,transfer_id),failure_message=null,updated_at=now() where id=batch_row.id returning * into batch_row;
    update public.provider_booking_settlements s set status='paid',updated_at=now() where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id) and s.status='assigned';
    for settlement_record in select s.booking_id from public.provider_payout_items i join public.provider_booking_settlements s on s.id=i.settlement_id where i.payout_batch_id=batch_row.id loop perform public.internal_reconcile_booking_risk_after_payout(settlement_record.booking_id); end loop;
    if old_status<>'paid' then insert into public.notifications(recipient_user_id,event_type,title,body) values(batch_row.owner_user_id,'provider_payout_paid','Provider payout completed','Your provider payout has been completed successfully.'); end if;
  elsif status_value='REVERSED' then
    update public.provider_payout_batches set status='reversed',reversed_at=coalesce(reversed_at,now()),failure_message=coalesce(description_value,'Gateway payout was reversed.'),updated_at=now() where id=batch_row.id returning * into batch_row;
    update public.provider_booking_settlements s set status=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then 'reversed' when s.eligible_at<=now() then 'available' else 'held' end,reversal_reason=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then 'Booking payment was reversed before provider payout could remain settled.' else s.reversal_reason end,reversed_at=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then now() else s.reversed_at end,updated_at=now() where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id) and s.status in ('assigned','paid');
    for settlement_record in select s.booking_id from public.provider_payout_items i join public.provider_booking_settlements s on s.id=i.settlement_id where i.payout_batch_id=batch_row.id loop perform public.internal_reconcile_booking_risk_after_transfer_return(settlement_record.booking_id,batch_row.id); end loop;
    if old_status<>'reversed' then insert into public.notifications(recipient_user_id,event_type,title,body) values(batch_row.owner_user_id,'provider_payout_reversed','Provider payout reversed',coalesce(description_value,'The payout was reversed by the beneficiary bank and the balance is available for review.')); end if;
  elsif status_value in ('FAILED','REJECTED') then
    update public.provider_payout_batches set status='failed',failure_message=coalesce(description_value,'Gateway payout failed.'),updated_at=now() where id=batch_row.id returning * into batch_row;
    update public.provider_booking_settlements s set status=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then 'reversed' when s.eligible_at<=now() then 'available' else 'held' end,reversal_reason=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then 'Booking payment was reversed before provider payout completed.' else s.reversal_reason end,reversed_at=case when exists(select 1 from public.bookings bk where bk.id=s.booking_id and bk.payment_status='refunded') then now() else s.reversed_at end,updated_at=now() where s.id in(select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id) and s.status='assigned';
    for settlement_record in select s.booking_id from public.provider_payout_items i join public.provider_booking_settlements s on s.id=i.settlement_id where i.payout_batch_id=batch_row.id loop perform public.internal_reconcile_booking_risk_after_transfer_return(settlement_record.booking_id,batch_row.id); end loop;
    if old_status<>'failed' then insert into public.notifications(recipient_user_id,event_type,title,body) values(batch_row.owner_user_id,'provider_payout_failed','Provider payout needs attention',coalesce(description_value,'The payout could not be completed and the balance has been released for review.')); end if;
  else update public.provider_payout_batches set status='processing',updated_at=now() where id=batch_row.id returning * into batch_row; end if;
  return batch_row;
end; $$;
revoke all on function public.gateway_apply_provider_payout_transfer_status(uuid,text,text,text,text,text) from public,anon,authenticated;
grant execute on function public.gateway_apply_provider_payout_transfer_status(uuid,text,text,text,text,text) to service_role;

create or replace function public.admin_resolve_payment_gateway_exception(target_exception_id uuid,target_action text,target_note text)
returns public.payment_gateway_exceptions language plpgsql security definer set search_path=public,pg_temp as $$
declare row_value public.payment_gateway_exceptions%rowtype; action_value text:=lower(btrim(coalesce(target_action,''))); note_value text:=btrim(coalesce(target_note,''));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  if action_value not in ('resolve','ignore') then raise exception 'Exception action is invalid.'; end if;
  if char_length(note_value)<3 or char_length(note_value)>500 then raise exception 'Resolution note must be 3 to 500 characters.'; end if;
  select * into row_value from public.payment_gateway_exceptions where id=target_exception_id for update;
  if not found then raise exception 'Gateway exception was not found.'; end if;
  if row_value.status='recovery_required' and exists(select 1 from public.provider_recovery_entries where booking_id=row_value.booking_id and status='open') then raise exception 'Resolve the provider recovery balance before closing this exception.'; end if;
  update public.payment_gateway_exceptions set status=case when action_value='ignore' then 'ignored' else 'resolved' end,resolved_by=auth.uid(),resolved_at=now(),resolution_note=note_value,last_seen_at=now() where id=row_value.id returning * into row_value;
  if row_value.booking_id is not null then perform public.internal_release_booking_holds_if_clear(row_value.booking_id); end if;
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) values(auth.uid(),'finance.gateway_exception.'||action_value,'payment_gateway_exception',row_value.id::text,jsonb_build_object('category',row_value.category,'booking_id',row_value.booking_id,'note',note_value));
  return row_value;
end; $$;
revoke all on function public.admin_resolve_payment_gateway_exception(uuid,text,text) from public,anon;
grant execute on function public.admin_resolve_payment_gateway_exception(uuid,text,text) to authenticated;

create or replace function public.admin_resolve_provider_recovery(target_recovery_id uuid,target_action text,target_note text)
returns public.provider_recovery_entries language plpgsql security definer set search_path=public,pg_temp as $$
declare row_value public.provider_recovery_entries%rowtype; action_value text:=lower(btrim(coalesce(target_action,''))); note_value text:=btrim(coalesce(target_note,'')); dispute_row public.payment_disputes%rowtype;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  if action_value not in ('recovered','waived') then raise exception 'Recovery action is invalid.'; end if;
  if char_length(note_value)<3 or char_length(note_value)>500 then raise exception 'Resolution note must be 3 to 500 characters.'; end if;
  select * into row_value from public.provider_recovery_entries where id=target_recovery_id for update;
  if not found then raise exception 'Provider recovery entry was not found.'; end if;
  if row_value.status<>'open' then return row_value; end if;
  update public.provider_recovery_entries set status=action_value,resolved_at=now(),resolved_by=auth.uid(),resolution_note=note_value,updated_at=now() where id=row_value.id returning * into row_value;
  if row_value.source_type='dispute' then
    select * into dispute_row from public.payment_disputes where gateway='cashfree' and 'dispute:'||gateway_dispute_id=row_value.source_reference limit 1;
    if found then update public.payment_disputes set local_state=case when gateway_status like '%_MERCHANT_ACCEPTED' then 'accepted' when gateway_status like '%_MERCHANT_LOST' then 'lost' else local_state end,last_seen_at=now() where id=dispute_row.id; end if;
  elsif row_value.source_type='auto_refund' then
    update public.payment_gateway_exceptions set status='resolved',severity='info',resolved_by=auth.uid(),resolved_at=now(),resolution_note='Provider recovery resolved: '||note_value,last_seen_at=now() where gateway='cashfree' and exception_key=row_value.source_reference;
  end if;
  perform public.internal_release_booking_holds_if_clear(row_value.booking_id);
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) values(auth.uid(),'finance.provider_recovery.'||action_value,'provider_recovery',row_value.id::text,jsonb_build_object('owner_user_id',row_value.owner_user_id,'booking_id',row_value.booking_id,'amount_minor',row_value.amount_minor,'currency',row_value.currency,'note',note_value));
  insert into public.notifications(recipient_user_id,booking_id,event_type,title,body) values(row_value.owner_user_id,row_value.booking_id,'provider_recovery_resolved','Finance recovery resolved','The finance recovery hold for a booking has been resolved by platform finance.');
  return row_value;
end; $$;
revoke all on function public.admin_resolve_provider_recovery(uuid,text,text) from public,anon;
grant execute on function public.admin_resolve_provider_recovery(uuid,text,text) to authenticated;

create or replace function public.admin_record_payment_dispute_action(target_dispute_id uuid,target_action text,target_note text)
returns void language plpgsql security definer set search_path=public,pg_temp as $$
declare row_value public.payment_disputes%rowtype; note_value text:=btrim(coalesce(target_note,''));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  if char_length(note_value)<3 or char_length(note_value)>500 then raise exception 'Dispute action note must be 3 to 500 characters.'; end if;
  select * into row_value from public.payment_disputes where id=target_dispute_id;
  if not found then raise exception 'Payment dispute was not found.'; end if;
  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata) values(auth.uid(),'finance.dispute.'||left(lower(target_action),80),'payment_dispute',row_value.id::text,jsonb_build_object('gateway_dispute_id',row_value.gateway_dispute_id,'booking_id',row_value.booking_id,'note',note_value));
end; $$;
revoke all on function public.admin_record_payment_dispute_action(uuid,text,text) from public,anon;
grant execute on function public.admin_record_payment_dispute_action(uuid,text,text) to authenticated;

create or replace function public.get_booking_finance_risk_events(target_booking_id uuid)
returns table(id text,event_kind text,status text,title text,detail text,occurred_at timestamptz)
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare b public.bookings%rowtype; allowed boolean:=false; owner_id uuid;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into b from public.bookings where b.id=target_booking_id;
  if not found then return; end if;
  owner_id:=public.internal_provider_owner_for_booking(target_booking_id);
  allowed:=b.customer_id=auth.uid() or owner_id=auth.uid() or public.is_super_admin() or public.admin_can_view(null,null,null,b.service_id);
  if not allowed then return; end if;
  return query
    select 'dispute:'||e.id::text,'dispute',e.to_local_state,
      case when e.to_local_state='action_required' then 'Payment dispute opened' when e.to_local_state='under_review' then 'Payment dispute under review' when e.to_local_state='won' then 'Payment dispute resolved' when e.to_local_state in ('lost','accepted','recovery_required') then 'Payment dispute closed with financial impact' else 'Payment dispute updated' end,
      case when e.to_local_state='action_required' then 'The payment gateway reported a dispute for this booking. Finance review is in progress.' when e.to_local_state='under_review' then 'The payment dispute is under review with the payment gateway.' when e.to_local_state='won' then 'The payment dispute was resolved in the merchant’s favour.' when e.to_local_state in ('lost','accepted','recovery_required') then 'The dispute closed with a payment reversal or finance recovery requirement.' else 'The payment dispute status changed.' end,
      e.recorded_at from public.payment_dispute_events e where e.booking_id=target_booking_id
    union all
    select 'exception:'||x.id::text,'gateway_exception',x.to_status,
      case when x.category in ('auto_refund','partial_auto_refund') then 'Automatic payment refund' else 'Payment reconciliation review' end,
      case when x.category='auto_refund' and x.to_status='resolved' then 'Cashfree automatically refunded the payment and the booking payment ledger was reconciled.' when x.category in ('auto_refund','partial_auto_refund') then 'The payment gateway automatically refunded all or part of a payment. Finance reconciliation is in progress.' else 'A payment gateway reconciliation exception is being reviewed.' end,
      x.recorded_at from public.payment_gateway_exception_events x where x.booking_id=target_booking_id;
end; $$;
revoke all on function public.get_booking_finance_risk_events(uuid) from public,anon;
grant execute on function public.get_booking_finance_risk_events(uuid) to authenticated;

create or replace function public.get_my_provider_finance_overview()
returns jsonb language plpgsql stable security definer set search_path=public,pg_temp as $$
declare owner_id uuid:=auth.uid(); professional uuid; business uuid; policy_json jsonb; summary_json jsonb; settlements_json jsonb; payouts_json jsonb; destination_json jsonb; holds_json jsonb; recoveries_json jsonb;
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
    'recovery_open_minor',coalesce((select sum(r.amount_minor) from public.provider_recovery_entries r where r.owner_user_id=owner_id and r.status='open'),0),
    'finance_hold_count',(select count(*) from public.provider_finance_holds h where h.owner_user_id=owner_id and h.status in ('open','recovery_required')),
    'settlement_count',count(*) filter(where s.status<>'reversed'),
    'available_count',count(*) filter(where ((s.status='available') or (s.status='held' and s.eligible_at<=now())) and not exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required')))
  ) into summary_json from public.provider_booking_settlements s where s.owner_user_id=owner_id;
  select coalesce(jsonb_agg(jsonb_build_object('id',s.id,'booking_id',s.booking_id,'currency',s.currency,'gross_minor',s.gross_minor,'commission_bps',s.commission_bps,'platform_fee_minor',s.platform_fee_minor,'provider_net_minor',s.provider_net_minor,'policy_version',s.policy_version,'status',case when exists(select 1 from public.provider_finance_holds h where h.booking_id=s.booking_id and h.status in ('open','recovery_required')) then 'risk_hold' when s.status='held' and s.eligible_at<=now() then 'available' else s.status end,'eligible_at',s.eligible_at,'reversal_reason',s.reversal_reason,'created_at',s.created_at) order by s.created_at desc),'[]'::jsonb) into settlements_json from public.provider_booking_settlements s where s.owner_user_id=owner_id;
  select coalesce(jsonb_agg(to_jsonb(b) order by b.created_at desc),'[]'::jsonb) into payouts_json from public.provider_payout_batches b where b.owner_user_id=owner_id;
  select coalesce((select jsonb_build_object('id',d.id,'gateway',d.gateway,'gateway_beneficiary_id',d.gateway_beneficiary_id,'destination_type',d.destination_type,'masked_destination',d.masked_destination,'beneficiary_name',d.beneficiary_name,'status',d.status,'gateway_status',d.gateway_status,'last_error_code',d.last_error_code,'last_error_message',d.last_error_message,'verified_at',d.verified_at,'created_at',d.created_at,'updated_at',d.updated_at) from public.provider_payout_destinations d where d.owner_user_id=owner_id and d.status<>'deleted' order by d.created_at desc limit 1),'null'::jsonb) into destination_json;
  select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'booking_id',h.booking_id,'source_type',h.source_type,'amount_minor',h.amount_minor,'currency',h.currency,'status',h.status,'summary',h.public_summary,'opened_at',h.opened_at,'updated_at',h.updated_at) order by h.opened_at desc),'[]'::jsonb) into holds_json from public.provider_finance_holds h where h.owner_user_id=owner_id and h.status<>'released';
  select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'booking_id',r.booking_id,'amount_minor',r.amount_minor,'currency',r.currency,'status',r.status,'reason',r.reason,'created_at',r.created_at,'resolved_at',r.resolved_at,'resolution_note',r.resolution_note) order by r.created_at desc),'[]'::jsonb) into recoveries_json from public.provider_recovery_entries r where r.owner_user_id=owner_id;
  return jsonb_build_object('policies',policy_json,'summary',coalesce(summary_json,'{}'::jsonb),'settlements',settlements_json,'payouts',payouts_json,'payout_destination',destination_json,'finance_holds',holds_json,'recoveries',recoveries_json);
end; $$;
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
  'provider_payout_prepared','provider_payout_cancelled','provider_payout_processing','provider_payout_paid','provider_payout_failed','provider_payout_reversed','provider_payout_destination_updated',
  'refund_requested','refund_onhold','refund_failed','refund_cancelled',
  'payment_dispute_opened','payment_dispute_resolved','provider_finance_hold','provider_recovery_required','provider_recovery_resolved'
]));
