begin;

create table if not exists public.referral_attribution_events (
  id uuid primary key default gen_random_uuid(),
  attribution_id uuid not null,
  referrer_handle text not null,
  referrer_identity_type text not null check (referrer_identity_type in ('customer','professional','business')),
  referrer_identity_id uuid not null,
  destination_handle text not null,
  destination_identity_type text not null check (destination_identity_type in ('professional','business')),
  destination_identity_id uuid not null,
  landing_path text not null check (char_length(landing_path) between 2 and 500 and landing_path like '/@%'),
  created_at timestamptz not null default now()
);

create unique index if not exists referral_attribution_events_touch_destination_uidx
  on public.referral_attribution_events(attribution_id, destination_identity_type, destination_identity_id);

create index if not exists referral_attribution_events_referrer_created_idx
  on public.referral_attribution_events(referrer_identity_type, referrer_identity_id, created_at desc);

alter table public.referral_attribution_events enable row level security;
revoke all on table public.referral_attribution_events from public, anon, authenticated;
grant all on table public.referral_attribution_events to service_role;

create or replace function public.record_public_referral_attribution(
  p_raw_referrer text,
  p_raw_destination text,
  p_attribution_id uuid,
  p_landing_path text
)
returns uuid
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  ref_handle text := public.normalize_identity_handle(p_raw_referrer);
  dest_handle text := public.normalize_identity_handle(p_raw_destination);
  ref_row public.identity_handles%rowtype;
  dest_row public.identity_handles%rowtype;
  first_referrer_identity_type text;
  first_referrer_identity_id uuid;
  event_id uuid;
begin
  if p_attribution_id is null then
    raise exception 'Attribution id is required.' using errcode = '22023';
  end if;

  if p_landing_path is null or char_length(p_landing_path) < 2 or char_length(p_landing_path) > 500 or p_landing_path not like '/@%' then
    raise exception 'Invalid landing path.' using errcode = '22023';
  end if;

  select ih.* into ref_row
  from public.identity_handles ih
  where ih.handle = ref_handle and ih.is_current = true;

  if ref_row.handle is null then
    raise exception 'Referrer handle is unavailable.' using errcode = '22023';
  end if;

  select ih.* into dest_row
  from public.identity_handles ih
  where ih.handle = dest_handle and ih.is_current = true;

  if dest_row.handle is null or dest_row.identity_type not in ('professional','business') then
    raise exception 'Destination handle is unavailable.' using errcode = '22023';
  end if;

  if ref_row.identity_type = dest_row.identity_type and ref_row.identity_id = dest_row.identity_id then
    raise exception 'Self-referral is not allowed.' using errcode = '22023';
  end if;

  select e.referrer_identity_type, e.referrer_identity_id
    into first_referrer_identity_type, first_referrer_identity_id
  from public.referral_attribution_events e
  where e.attribution_id = p_attribution_id
  order by e.created_at asc, e.id asc
  limit 1;

  if first_referrer_identity_id is not null
     and (first_referrer_identity_type <> ref_row.identity_type or first_referrer_identity_id <> ref_row.identity_id) then
    select e.id into event_id
    from public.referral_attribution_events e
    where e.attribution_id = p_attribution_id
    order by e.created_at asc, e.id asc
    limit 1;
    return event_id;
  end if;

  insert into public.referral_attribution_events (
    attribution_id,
    referrer_handle,
    referrer_identity_type,
    referrer_identity_id,
    destination_handle,
    destination_identity_type,
    destination_identity_id,
    landing_path
  ) values (
    p_attribution_id,
    ref_row.handle,
    ref_row.identity_type,
    ref_row.identity_id,
    dest_row.handle,
    dest_row.identity_type,
    dest_row.identity_id,
    p_landing_path
  )
  on conflict (attribution_id, destination_identity_type, destination_identity_id)
  do update set landing_path = excluded.landing_path
  returning id into event_id;

  return event_id;
end;
$$;

revoke all on function public.record_public_referral_attribution(text,text,uuid,text) from public;
grant execute on function public.record_public_referral_attribution(text,text,uuid,text) to anon, authenticated, service_role;

comment on table public.referral_attribution_events is
  'Finance-free first-touch referral attribution events. Contains no commission, payment, payout, settlement, or recovery state.';

commit;
