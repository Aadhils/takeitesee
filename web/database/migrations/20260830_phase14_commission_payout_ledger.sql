-- Phase 14 Module 3: configurable commission snapshots and provider payout ledger.
-- Finance policy is intentionally inactive by default. No provider payout amount is created
-- until a platform-manage administrator explicitly activates a policy for the booking currency.

create table if not exists public.platform_finance_policies (
  currency text primary key check (currency in ('INR','USD')),
  active boolean not null default false,
  commission_bps integer not null default 0 check (commission_bps between 0 and 10000),
  settlement_hold_days integer not null default 0 check (settlement_hold_days between 0 and 90),
  minimum_payout_minor bigint not null default 0 check (minimum_payout_minor >= 0),
  version integer not null default 1 check (version > 0),
  updated_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

insert into public.platform_finance_policies(currency,active,commission_bps,settlement_hold_days,minimum_payout_minor)
values('INR',false,0,0,0)
on conflict(currency) do nothing;

create table if not exists public.provider_booking_settlements (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  provider_type text not null check (provider_type in ('professional','business')),
  professional_id uuid references public.professional_profiles(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  currency text not null check (currency in ('INR','USD')),
  gross_minor bigint not null check (gross_minor > 0),
  commission_bps integer not null check (commission_bps between 0 and 10000),
  platform_fee_minor bigint not null check (platform_fee_minor >= 0),
  provider_net_minor bigint not null check (provider_net_minor >= 0),
  policy_version integer not null check (policy_version > 0),
  status text not null check (status in ('held','available','assigned','paid','reversed')),
  eligible_at timestamptz not null,
  reversal_reason text,
  reversed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (
    (provider_type='professional' and professional_id is not null and business_id is null)
    or (provider_type='business' and business_id is not null and professional_id is null)
  ),
  check (platform_fee_minor + provider_net_minor = gross_minor),
  check (reversal_reason is null or char_length(reversal_reason) <= 500)
);
create index if not exists provider_booking_settlements_owner_status_idx on public.provider_booking_settlements(owner_user_id,status,eligible_at);
create index if not exists provider_booking_settlements_provider_idx on public.provider_booking_settlements(provider_type,professional_id,business_id);

create table if not exists public.provider_payout_batches (
  id uuid primary key default gen_random_uuid(),
  provider_type text not null check (provider_type in ('professional','business')),
  professional_id uuid references public.professional_profiles(id) on delete restrict,
  business_id uuid references public.businesses(id) on delete restrict,
  owner_user_id uuid not null references public.users(id) on delete restrict,
  currency text not null check (currency in ('INR','USD')),
  status text not null default 'ready' check (status in ('ready','processing','paid','failed','cancelled')),
  settlement_count integer not null check (settlement_count > 0),
  gross_minor bigint not null check (gross_minor > 0),
  platform_fee_minor bigint not null check (platform_fee_minor >= 0),
  provider_net_minor bigint not null check (provider_net_minor > 0),
  external_reference text,
  failure_message text,
  created_by uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  paid_at timestamptz,
  check (
    (provider_type='professional' and professional_id is not null and business_id is null)
    or (provider_type='business' and business_id is not null and professional_id is null)
  ),
  check (platform_fee_minor + provider_net_minor = gross_minor),
  check (external_reference is null or char_length(external_reference) <= 240),
  check (failure_message is null or char_length(failure_message) <= 500)
);
create index if not exists provider_payout_batches_owner_created_idx on public.provider_payout_batches(owner_user_id,created_at desc);
create unique index if not exists provider_payout_batches_one_open_idx on public.provider_payout_batches(owner_user_id,currency)
where status in ('ready','processing');

create table if not exists public.provider_payout_items (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null references public.provider_payout_batches(id) on delete cascade,
  settlement_id uuid not null references public.provider_booking_settlements(id) on delete restrict,
  provider_net_minor bigint not null check (provider_net_minor > 0),
  created_at timestamptz not null default now(),
  unique(payout_batch_id,settlement_id),
  unique(settlement_id)
);
create index if not exists provider_payout_items_batch_idx on public.provider_payout_items(payout_batch_id);

alter table public.platform_finance_policies enable row level security;
alter table public.provider_booking_settlements enable row level security;
alter table public.provider_payout_batches enable row level security;
alter table public.provider_payout_items enable row level security;

revoke insert,update,delete on public.platform_finance_policies from anon,authenticated;
revoke insert,update,delete on public.provider_booking_settlements from anon,authenticated;
revoke insert,update,delete on public.provider_payout_batches from anon,authenticated;
revoke insert,update,delete on public.provider_payout_items from anon,authenticated;

drop policy if exists finance_policy_authenticated_read on public.platform_finance_policies;
create policy finance_policy_authenticated_read on public.platform_finance_policies
for select to authenticated using (true);

drop policy if exists provider_settlements_private_read on public.provider_booking_settlements;
create policy provider_settlements_private_read on public.provider_booking_settlements
for select to authenticated using (
  owner_user_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_manage(null,null,null,null)
);

drop policy if exists provider_payout_batches_private_read on public.provider_payout_batches;
create policy provider_payout_batches_private_read on public.provider_payout_batches
for select to authenticated using (
  owner_user_id=auth.uid()
  or public.is_super_admin()
  or public.admin_can_manage(null,null,null,null)
);

drop policy if exists provider_payout_items_private_read on public.provider_payout_items;
create policy provider_payout_items_private_read on public.provider_payout_items
for select to authenticated using (
  exists(
    select 1 from public.provider_payout_batches b
    where b.id=provider_payout_items.payout_batch_id
      and (b.owner_user_id=auth.uid() or public.is_super_admin() or public.admin_can_manage(null,null,null,null))
  )
);

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
        update public.provider_payout_batches b
        set settlement_count=s.settlement_count,
            gross_minor=s.gross_minor,
            platform_fee_minor=s.platform_fee_minor,
            provider_net_minor=s.provider_net_minor,
            status=case when s.settlement_count=0 then 'cancelled' else b.status end,
            updated_at=now()
        from (
          select count(i.id)::int as settlement_count,
                 coalesce(sum(st.gross_minor),0)::bigint as gross_minor,
                 coalesce(sum(st.platform_fee_minor),0)::bigint as platform_fee_minor,
                 coalesce(sum(i.provider_net_minor),0)::bigint as provider_net_minor
          from public.provider_payout_items i
          join public.provider_booking_settlements st on st.id=i.settlement_id
          where i.payout_batch_id=batch_id
        ) s
        where b.id=batch_id;
      else
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

create or replace function public.bookings_reconcile_finance_settlement()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  perform public.reconcile_provider_booking_settlement(new.id);
  return new;
end;
$$;

drop trigger if exists bookings_reconcile_finance_settlement on public.bookings;
create trigger bookings_reconcile_finance_settlement
after insert or update of status,payment_status on public.bookings
for each row execute function public.bookings_reconcile_finance_settlement();

create or replace function public.admin_update_finance_policy(
  target_currency text,
  target_commission_bps integer,
  target_settlement_hold_days integer,
  target_minimum_payout_minor bigint,
  target_active boolean
)
returns public.platform_finance_policies
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  policy_row public.platform_finance_policies%rowtype;
  booking_id_value uuid;
  currency_value text:=upper(btrim(coalesce(target_currency,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  if currency_value not in ('INR','USD') then raise exception 'Finance policy currency is invalid.'; end if;
  if target_commission_bps<0 or target_commission_bps>10000 then raise exception 'Commission must be between 0 and 100 percent.'; end if;
  if target_settlement_hold_days<0 or target_settlement_hold_days>90 then raise exception 'Settlement hold must be between 0 and 90 days.'; end if;
  if target_minimum_payout_minor<0 then raise exception 'Minimum payout cannot be negative.'; end if;

  insert into public.platform_finance_policies(currency,active,commission_bps,settlement_hold_days,minimum_payout_minor,version,updated_by)
  values(currency_value,target_active,target_commission_bps,target_settlement_hold_days,target_minimum_payout_minor,1,auth.uid())
  on conflict(currency) do update set
    active=excluded.active,
    commission_bps=excluded.commission_bps,
    settlement_hold_days=excluded.settlement_hold_days,
    minimum_payout_minor=excluded.minimum_payout_minor,
    version=public.platform_finance_policies.version+1,
    updated_by=auth.uid(),updated_at=now()
  returning * into policy_row;

  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'finance.policy.updated','finance_policy',currency_value,jsonb_build_object(
    'active',policy_row.active,'commission_bps',policy_row.commission_bps,
    'settlement_hold_days',policy_row.settlement_hold_days,'minimum_payout_minor',policy_row.minimum_payout_minor,
    'version',policy_row.version
  ));

  if policy_row.active then
    for booking_id_value in
      select b.id from public.bookings b
      where b.currency=currency_value and b.status='completed'::public.booking_status and b.payment_status='paid'::public.payment_status
        and not exists(select 1 from public.provider_booking_settlements s where s.booking_id=b.id)
    loop
      perform public.reconcile_provider_booking_settlement(booking_id_value);
    end loop;
  end if;
  return policy_row;
end;
$$;
revoke all on function public.admin_update_finance_policy(text,integer,integer,bigint,boolean) from public,anon;
grant execute on function public.admin_update_finance_policy(text,integer,integer,bigint,boolean) to authenticated;

create or replace function public.get_my_provider_finance_overview()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
declare
  professional uuid;
  business uuid;
  owner_id uuid:=auth.uid();
  policy_json jsonb;
  summary_json jsonb;
  settlements_json jsonb;
  payouts_json jsonb;
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
  ) into summary_json
  from public.provider_booking_settlements s where s.owner_user_id=owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',s.id,'booking_id',s.booking_id,'currency',s.currency,'gross_minor',s.gross_minor,
    'commission_bps',s.commission_bps,'platform_fee_minor',s.platform_fee_minor,
    'provider_net_minor',s.provider_net_minor,'policy_version',s.policy_version,
    'status',case when s.status='held' and s.eligible_at<=now() then 'available' else s.status end,
    'eligible_at',s.eligible_at,'reversal_reason',s.reversal_reason,'created_at',s.created_at
  ) order by s.created_at desc),'[]'::jsonb) into settlements_json
  from public.provider_booking_settlements s where s.owner_user_id=owner_id;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',b.id,'currency',b.currency,'status',b.status,'settlement_count',b.settlement_count,
    'gross_minor',b.gross_minor,'platform_fee_minor',b.platform_fee_minor,'provider_net_minor',b.provider_net_minor,
    'external_reference',b.external_reference,'failure_message',b.failure_message,
    'created_at',b.created_at,'paid_at',b.paid_at
  ) order by b.created_at desc),'[]'::jsonb) into payouts_json
  from public.provider_payout_batches b where b.owner_user_id=owner_id;

  return jsonb_build_object('policies',policy_json,'summary',coalesce(summary_json,'{}'::jsonb),'settlements',settlements_json,'payouts',payouts_json);
end;
$$;
revoke all on function public.get_my_provider_finance_overview() from public,anon;
grant execute on function public.get_my_provider_finance_overview() to authenticated;

create or replace function public.admin_list_finance_overview()
returns jsonb
language plpgsql stable security definer set search_path=public,pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not (public.is_super_admin() or public.admin_can_manage(null,null,null,null)) then raise exception 'Platform finance management permission is required.'; end if;
  return jsonb_build_object(
    'policies',coalesce((select jsonb_agg(to_jsonb(p) order by p.currency) from public.platform_finance_policies p),'[]'::jsonb),
    'providers',coalesce((
      select jsonb_agg(row_data order by (row_data->>'available_minor')::bigint desc)
      from (
        select jsonb_build_object(
          'owner_user_id',s.owner_user_id,'provider_type',max(s.provider_type),
          'professional_id',max(s.professional_id::text),'business_id',max(s.business_id::text),
          'display_name',coalesce(max(b.name),max(p.headline),max(u.name),'Provider'),
          'currency',s.currency,
          'gross_minor',sum(s.gross_minor) filter(where s.status<>'reversed'),
          'platform_fee_minor',sum(s.platform_fee_minor) filter(where s.status<>'reversed'),
          'provider_net_minor',sum(s.provider_net_minor) filter(where s.status<>'reversed'),
          'available_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='available' or (s.status='held' and s.eligible_at<=now())),0),
          'held_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='held' and s.eligible_at>now()),0),
          'assigned_minor',coalesce(sum(s.provider_net_minor) filter(where s.status='assigned'),0),
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

create or replace function public.admin_prepare_provider_payout(target_owner_user_id uuid,target_currency text)
returns public.provider_payout_batches
language plpgsql security definer set search_path=public,pg_temp as $$
declare
  policy_row public.platform_finance_policies%rowtype;
  batch_row public.provider_payout_batches%rowtype;
  provider_type_value text;
  professional_value uuid;
  business_value uuid;
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

  select max(provider_type),max(professional_id),max(business_id),count(*)::int,
         coalesce(sum(gross_minor),0)::bigint,coalesce(sum(platform_fee_minor),0)::bigint,coalesce(sum(provider_net_minor),0)::bigint
  into provider_type_value,professional_value,business_value,count_value,gross_value,fee_value,net_value
  from public.provider_booking_settlements
  where owner_user_id=target_owner_user_id and currency=currency_value and status='available';

  if count_value=0 or net_value<=0 then raise exception 'No provider funds are currently available for payout.'; end if;
  if net_value<policy_row.minimum_payout_minor then raise exception 'Available balance is below the configured minimum payout.'; end if;

  insert into public.provider_payout_batches(
    provider_type,professional_id,business_id,owner_user_id,currency,status,settlement_count,
    gross_minor,platform_fee_minor,provider_net_minor,created_by
  ) values (
    provider_type_value,professional_value,business_value,target_owner_user_id,currency_value,'ready',count_value,
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

  update public.provider_booking_settlements s
  set status=case when s.eligible_at<=now() then 'available' else 'held' end,updated_at=now()
  where s.id in (select i.settlement_id from public.provider_payout_items i where i.payout_batch_id=batch_row.id);
  delete from public.provider_payout_items where payout_batch_id=batch_row.id;
  update public.provider_payout_batches set status='cancelled',failure_message=reason_value,updated_at=now()
  where id=batch_row.id returning * into batch_row;

  insert into public.admin_audit_log(actor_user_id,action,resource_type,resource_id,metadata)
  values(auth.uid(),'finance.payout.cancelled','provider_payout',batch_row.id::text,jsonb_build_object('reason',reason_value,'owner_user_id',batch_row.owner_user_id));
  insert into public.notifications(recipient_user_id,event_type,title,body)
  values(batch_row.owner_user_id,'provider_payout_cancelled','Provider payout cancelled',reason_value);
  return batch_row;
end;
$$;
revoke all on function public.admin_cancel_provider_payout(uuid,text) from public,anon;
grant execute on function public.admin_cancel_provider_payout(uuid,text) to authenticated;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (event_type = any(array[
  'booking_created','booking_accepted','booking_declined','booking_rescheduled','booking_cancelled','service_completed',
  'reschedule_requested','reschedule_accepted','reschedule_declined','payment_pending','payment_paid','payment_failed','payment_refunded',
  'review_submitted','review_response','support_opened','support_updated','customer_no_show','provider_no_show','completion_confirmed','closeout_closed',
  'provider_application_submitted','provider_application_withdrawn','provider_application_approved','provider_application_rejected',
  'provider_verification_submitted','provider_verification_withdrawn','provider_verification_approved','provider_verification_changes','provider_verification_rejected','provider_verification_revoked',
  'service_launch_submitted','service_launch_withdrawn','service_launch_approved','service_launch_changes','service_launch_rejected',
  'provider_reverification_required','provider_suspended','provider_restored',
  'provider_payout_prepared','provider_payout_cancelled'
]));
