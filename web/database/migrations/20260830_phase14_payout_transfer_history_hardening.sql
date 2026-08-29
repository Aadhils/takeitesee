-- Phase 14 Module 4 hardening: immutable sanitized payout transfer status history.

create table if not exists public.provider_payout_transfer_events (
  id uuid primary key default gen_random_uuid(),
  payout_batch_id uuid not null references public.provider_payout_batches(id) on delete restrict,
  gateway text not null,
  transfer_id text not null,
  gateway_transfer_id text,
  batch_status text not null,
  transfer_status text,
  transfer_status_code text,
  transfer_status_description text,
  transfer_utr text,
  recorded_at timestamptz not null default now(),
  check (char_length(gateway) between 2 and 40),
  check (char_length(transfer_id) between 1 and 80),
  check (gateway_transfer_id is null or char_length(gateway_transfer_id) <= 200),
  check (transfer_status_description is null or char_length(transfer_status_description) <= 500),
  check (transfer_utr is null or char_length(transfer_utr) <= 200)
);
create index if not exists provider_payout_transfer_events_batch_recorded_idx
  on public.provider_payout_transfer_events(payout_batch_id,recorded_at desc);
create index if not exists provider_payout_transfer_events_transfer_recorded_idx
  on public.provider_payout_transfer_events(transfer_id,recorded_at desc);

alter table public.provider_payout_transfer_events enable row level security;
revoke insert,update,delete on public.provider_payout_transfer_events from anon,authenticated;
drop policy if exists provider_payout_transfer_events_private_read on public.provider_payout_transfer_events;
create policy provider_payout_transfer_events_private_read on public.provider_payout_transfer_events
for select to authenticated using (
  exists(
    select 1 from public.provider_payout_batches b
    where b.id=provider_payout_transfer_events.payout_batch_id
      and (b.owner_user_id=auth.uid() or public.is_super_admin() or public.admin_can_manage(null,null,null,null))
  )
);

create or replace function public.record_provider_payout_transfer_event()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.transfer_id is null then return new; end if;
  if tg_op='UPDATE' and
     new.status is not distinct from old.status and
     new.transfer_status is not distinct from old.transfer_status and
     new.transfer_status_code is not distinct from old.transfer_status_code and
     new.gateway_transfer_id is not distinct from old.gateway_transfer_id and
     new.transfer_utr is not distinct from old.transfer_utr then
    return new;
  end if;

  insert into public.provider_payout_transfer_events(
    payout_batch_id,gateway,transfer_id,gateway_transfer_id,batch_status,
    transfer_status,transfer_status_code,transfer_status_description,transfer_utr
  ) values (
    new.id,coalesce(new.gateway,'unknown'),new.transfer_id,new.gateway_transfer_id,new.status,
    new.transfer_status,new.transfer_status_code,new.transfer_status_description,new.transfer_utr
  );
  return new;
end;
$$;
revoke all on function public.record_provider_payout_transfer_event() from public,anon,authenticated;

drop trigger if exists provider_payout_transfer_event_history on public.provider_payout_batches;
create trigger provider_payout_transfer_event_history
after insert or update of status,transfer_status,transfer_status_code,gateway_transfer_id,transfer_utr on public.provider_payout_batches
for each row execute function public.record_provider_payout_transfer_event();