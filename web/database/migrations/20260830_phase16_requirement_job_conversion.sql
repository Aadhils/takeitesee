-- Phase 16 Module 4: convert awarded marketplace requirements into normal service bookings.
-- The existing booking lifecycle remains authoritative for provider confirmation,
-- rescheduling, Cash on Service, completion, closeout and reviews.

create table if not exists public.marketplace_requirement_jobs (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.customer_requirements(id) on delete restrict,
  proposal_id uuid not null references public.requirement_proposals(id) on delete restrict,
  booking_id uuid not null unique references public.bookings(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0),
  state text not null default 'active' check (state in ('active','declined','cancelled','service_completed','fulfilled')),
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(requirement_id,sequence_no)
);

create unique index if not exists marketplace_requirement_jobs_one_live_idx
  on public.marketplace_requirement_jobs(requirement_id)
  where state in ('active','service_completed','fulfilled');
create index if not exists marketplace_requirement_jobs_proposal_idx
  on public.marketplace_requirement_jobs(proposal_id,created_at desc);
create index if not exists marketplace_requirement_jobs_requirement_idx
  on public.marketplace_requirement_jobs(requirement_id,sequence_no desc);

alter table public.marketplace_requirement_jobs enable row level security;
revoke all on public.marketplace_requirement_jobs from anon;
revoke insert,update,delete on public.marketplace_requirement_jobs from authenticated;
grant select on public.marketplace_requirement_jobs to authenticated;
grant select,insert,update,delete on public.marketplace_requirement_jobs to service_role;

drop policy if exists marketplace_requirement_jobs_participant_read on public.marketplace_requirement_jobs;
create policy marketplace_requirement_jobs_participant_read on public.marketplace_requirement_jobs
for select to authenticated using (
  exists(
    select 1
    from public.customer_requirements r
    join public.requirement_proposals p on p.id=marketplace_requirement_jobs.proposal_id
    where r.id=marketplace_requirement_jobs.requirement_id
      and (r.customer_id=auth.uid() or p.provider_user_id=auth.uid())
  )
);

create or replace function public.customer_create_requirement_job(
  target_requirement_id uuid,
  requested_booking_date date,
  requested_start_time time without time zone,
  requested_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  requirement_row public.customer_requirements%rowtype;
  proposal_row public.requirement_proposals%rowtype;
  service_row public.services%rowtype;
  availability_mode text;
  timezone_value text;
  provider_user_id uuid;
  notes_value text:=nullif(btrim(coalesce(requested_notes,'')),'');
  sequence_value integer;
  booking_uuid uuid:=gen_random_uuid();
  job_row public.marketplace_requirement_jobs%rowtype;
  booking_row public.bookings%rowtype;
  requested_start_local timestamp without time zone;
  requested_end_local timestamp without time zone;
  requested_start_at timestamptz;
  requested_end_at timestamptz;
  quoted_price_value numeric;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if requested_booking_date is null or requested_start_time is null then raise exception 'Booking date and time are required.'; end if;
  if notes_value is not null and char_length(notes_value)>1000 then raise exception 'Job notes must be 1000 characters or fewer.'; end if;

  select * into requirement_row
  from public.customer_requirements
  where id=target_requirement_id
  for update;
  if not found then raise exception 'Requirement was not found.'; end if;
  if requirement_row.customer_id<>auth.uid() then raise exception 'You can create a service job only for your own requirement.'; end if;
  if requirement_row.status<>'awarded' or requirement_row.accepted_proposal_id is null then
    raise exception 'A service job can be created only after a provider proposal is accepted.';
  end if;

  select * into proposal_row
  from public.requirement_proposals
  where id=requirement_row.accepted_proposal_id
    and requirement_id=requirement_row.id
    and status='accepted'
  for share;
  if not found then raise exception 'The accepted proposal is unavailable.'; end if;

  if exists(
    select 1 from public.marketplace_requirement_jobs
    where requirement_id=requirement_row.id
      and state in ('active','service_completed','fulfilled')
  ) then
    raise exception 'This requirement already has an active service job. Open the existing booking to reschedule or continue it.';
  end if;

  select * into service_row
  from public.services
  where id=proposal_row.service_id and active=true and status='active'
  for share;
  if not found then raise exception 'The selected provider service is no longer active.'; end if;

  if service_row.provider_type::text='business' then
    select owner_user_id into provider_user_id from public.businesses where id=service_row.business_id;
  else
    select user_id into provider_user_id from public.professional_profiles where id=service_row.professional_id;
  end if;
  if provider_user_id is null or provider_user_id<>proposal_row.provider_user_id then
    raise exception 'The accepted proposal no longer matches the selected provider service.';
  end if;
  if service_row.duration_minutes is null or service_row.duration_minutes<=0 then raise exception 'Service duration is not configured.'; end if;
  if proposal_row.amount_minor<=0 then raise exception 'The accepted proposal amount is invalid.'; end if;
  if proposal_row.currency not in ('INR','USD') then raise exception 'The accepted proposal currency is unsupported.'; end if;

  select coalesce(sa.mode::text,'on_request'),coalesce(nullif(sa.timezone,''),'Asia/Kolkata')
  into availability_mode,timezone_value
  from (select 1) seed
  left join public.service_availability sa on sa.service_id=service_row.id;

  requested_start_local:=requested_booking_date::timestamp + requested_start_time;
  requested_end_local:=requested_start_local + make_interval(mins=>service_row.duration_minutes);
  requested_start_at:=requested_start_local at time zone timezone_value;
  requested_end_at:=requested_end_local at time zone timezone_value;

  if requested_start_at<=now() then raise exception 'Choose a future booking time.'; end if;

  if availability_mode='scheduled' then
    if not exists(
      select 1 from public.service_availability_windows w
      where w.service_id=service_row.id
        and w.day_of_week=extract(dow from requested_booking_date)::smallint
        and (requested_booking_date::timestamp+w.start_time)<=requested_start_local
        and (requested_booking_date::timestamp+w.end_time)>=requested_end_local
    ) then
      raise exception 'The selected time is outside the provider availability window.';
    end if;
  else
    if requested_start_time<time '09:00' or requested_end_local>(requested_booking_date::timestamp+time '18:00') then
      raise exception 'The selected time is outside the provider booking hours.';
    end if;
  end if;

  if exists(
    select 1 from public.service_availability_blackouts x
    where x.service_id=service_row.id
      and x.starts_at<requested_end_at
      and x.ends_at>requested_start_at
  ) then
    raise exception 'The selected time is blocked by the provider.';
  end if;

  -- Serialize booking creation for the accepted provider/date and recheck overlap under the lock.
  perform pg_advisory_xact_lock(hashtextextended(proposal_row.provider_user_id::text||':'||requested_booking_date::text,0));

  if exists(
    select 1 from public.bookings b
    where b.booking_date=requested_booking_date
      and b.status in ('pending','confirmed','rescheduled')
      and (
        (service_row.provider_type::text='business' and b.business_id=service_row.business_id)
        or
        (service_row.provider_type::text='professional' and b.professional_id=service_row.professional_id)
      )
      and (b.booking_date::timestamp+b.start_time)<requested_end_local
      and (b.booking_date::timestamp+b.start_time+make_interval(mins=>b.duration_minutes))>requested_start_local
  ) then
    raise exception 'The provider already has a booking during the selected time.';
  end if;

  select coalesce(max(sequence_no),0)+1 into sequence_value
  from public.marketplace_requirement_jobs
  where requirement_id=requirement_row.id;

  quoted_price_value:=proposal_row.amount_minor::numeric/100;

  insert into public.bookings(
    id,booking_reference,idempotency_key,customer_id,service_id,provider_type,professional_id,business_id,
    service_name_snapshot,booking_date,start_time,timezone,duration_minutes,location,customer_notes,
    quoted_price,currency,status,payment_status,payment_method
  ) values (
    booking_uuid,
    'TIS-RQ-'||to_char(requested_booking_date,'YYYYMMDD')||'-'||upper(substr(replace(gen_random_uuid()::text,'-',''),1,6)),
    'requirement-job:'||requirement_row.id::text||':'||sequence_value::text,
    requirement_row.customer_id,service_row.id,service_row.provider_type,service_row.professional_id,service_row.business_id,
    service_row.name,requested_booking_date,requested_start_time,timezone_value,service_row.duration_minutes,
    coalesce(nullif(service_row.location,''),'Service location'),notes_value,quoted_price_value,proposal_row.currency,
    'pending','unpaid','unselected'
  ) returning * into booking_row;

  insert into public.marketplace_requirement_jobs(requirement_id,proposal_id,booking_id,sequence_no,state,created_by)
  values(requirement_row.id,proposal_row.id,booking_row.id,sequence_value,'active',auth.uid())
  returning * into job_row;

  return jsonb_build_object(
    'job',jsonb_build_object(
      'id',job_row.id,'requirement_id',job_row.requirement_id,'proposal_id',job_row.proposal_id,
      'booking_id',job_row.booking_id,'sequence_no',job_row.sequence_no,'state',job_row.state,'created_at',job_row.created_at
    ),
    'booking',jsonb_build_object(
      'id',booking_row.id,'booking_reference',booking_row.booking_reference,'status',booking_row.status,
      'payment_status',booking_row.payment_status,'payment_method',booking_row.payment_method,
      'booking_date',booking_row.booking_date,'start_time',booking_row.start_time,'timezone',booking_row.timezone,
      'duration_minutes',booking_row.duration_minutes,'location',booking_row.location,
      'quoted_price',booking_row.quoted_price,'currency',booking_row.currency,'service_name',booking_row.service_name_snapshot
    )
  );
end;
$$;
revoke all on function public.customer_create_requirement_job(uuid,date,time without time zone,text) from public,anon;
grant execute on function public.customer_create_requirement_job(uuid,date,time without time zone,text) to authenticated;

create or replace function public.get_requirement_job_history(target_requirement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path=public,pg_temp
as $$
declare
  requirement_row public.customer_requirements%rowtype;
  accepted_provider uuid;
  result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  select * into requirement_row from public.customer_requirements where id=target_requirement_id;
  if not found then raise exception 'Requirement was not found.'; end if;
  select provider_user_id into accepted_provider from public.requirement_proposals where id=requirement_row.accepted_proposal_id;
  if auth.uid()<>requirement_row.customer_id and auth.uid() is distinct from accepted_provider
     and not public.is_super_admin() and not public.admin_can_view(null,requirement_row.location_id,requirement_row.category_id,null) then
    raise exception 'This service job history is not accessible.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',j.id,'sequence_no',j.sequence_no,'state',j.state,'created_at',j.created_at,
    'booking_id',b.id,'booking_reference',b.booking_reference,'booking_status',b.status,
    'payment_status',b.payment_status,'payment_method',b.payment_method,'cash_collected_at',b.cash_collected_at,
    'booking_date',b.booking_date,'start_time',b.start_time,'timezone',b.timezone,'duration_minutes',b.duration_minutes,
    'location',b.location,'quoted_price',b.quoted_price,'currency',b.currency,'service_name',b.service_name_snapshot
  ) order by j.sequence_no desc),'[]'::jsonb)
  into result_value
  from public.marketplace_requirement_jobs j
  join public.bookings b on b.id=j.booking_id
  where j.requirement_id=target_requirement_id;
  return result_value;
end;
$$;
revoke all on function public.get_requirement_job_history(uuid) from public,anon;
grant execute on function public.get_requirement_job_history(uuid) to authenticated;

create or replace function public.sync_requirement_job_fulfillment(target_booking_id uuid)
returns void
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  booking_row public.bookings%rowtype;
  closeout_row public.booking_closeouts%rowtype;
  job_row public.marketplace_requirement_jobs%rowtype;
begin
  select * into job_row from public.marketplace_requirement_jobs where booking_id=target_booking_id for update;
  if not found then return; end if;
  select * into booking_row from public.bookings where id=target_booking_id;
  if not found or booking_row.status<>'completed' then return; end if;
  select * into closeout_row from public.booking_closeouts where booking_id=target_booking_id;
  if not found or closeout_row.customer_completion_confirmed_at is null then return; end if;
  if not public.booking_closeout_payment_settled(booking_row,closeout_row) then return; end if;

  update public.marketplace_requirement_jobs
  set state='fulfilled',updated_at=now()
  where id=job_row.id and state<>'fulfilled';

  update public.customer_requirements
  set status='fulfilled',closed_at=coalesce(closed_at,now()),updated_at=now()
  where id=job_row.requirement_id and status='awarded';
end;
$$;
revoke all on function public.sync_requirement_job_fulfillment(uuid) from public,anon,authenticated;
grant execute on function public.sync_requirement_job_fulfillment(uuid) to service_role;

create or replace function public.sync_requirement_job_booking_state()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='UPDATE' and new.status is not distinct from old.status and new.payment_status is not distinct from old.payment_status then return new; end if;

  update public.marketplace_requirement_jobs
  set state=case
    when new.status='rejected' then 'declined'
    when new.status='cancelled' then 'cancelled'
    when new.status='completed' then case when state='fulfilled' then 'fulfilled' else 'service_completed' end
    else 'active'
  end,
  updated_at=now()
  where booking_id=new.id and state<>'fulfilled';

  perform public.sync_requirement_job_fulfillment(new.id);
  return new;
end;
$$;
revoke all on function public.sync_requirement_job_booking_state() from public,anon,authenticated;

drop trigger if exists bookings_sync_requirement_job_state on public.bookings;
create trigger bookings_sync_requirement_job_state
after update of status,payment_status on public.bookings
for each row execute function public.sync_requirement_job_booking_state();

create or replace function public.sync_requirement_job_from_closeout()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  perform public.sync_requirement_job_fulfillment(new.booking_id);
  return new;
end;
$$;
revoke all on function public.sync_requirement_job_from_closeout() from public,anon,authenticated;

drop trigger if exists booking_closeouts_sync_requirement_job on public.booking_closeouts;
create trigger booking_closeouts_sync_requirement_job
after insert or update of customer_completion_confirmed_at on public.booking_closeouts
for each row execute function public.sync_requirement_job_from_closeout();

-- Once a requirement is linked to the booking lifecycle, manual fulfillment must not bypass
-- service completion, customer confirmation and payment settlement.
create or replace function public.customer_update_requirement_status(target_requirement_id uuid,target_status text)
returns public.customer_requirements
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare row_value public.customer_requirements%rowtype; status_value text:=lower(btrim(coalesce(target_status,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if status_value not in ('open','paused','fulfilled','cancelled') then raise exception 'Requirement status is invalid.'; end if;
  select * into row_value from public.customer_requirements where id=target_requirement_id for update;
  if not found then raise exception 'Requirement was not found.'; end if;
  if row_value.customer_id<>auth.uid() then raise exception 'You can manage only your own requirement.'; end if;
  if row_value.status=status_value then return row_value; end if;
  if row_value.status in ('fulfilled','cancelled') then raise exception 'A closed requirement cannot be reopened.'; end if;
  if status_value='fulfilled' and exists(select 1 from public.marketplace_requirement_jobs where requirement_id=row_value.id) then
    raise exception 'This requirement is fulfilled automatically after the linked service job is completed, confirmed and payment is settled.';
  end if;
  if row_value.status='awarded' and status_value not in ('fulfilled','cancelled') then raise exception 'An awarded requirement can only be fulfilled or cancelled.'; end if;
  if row_value.status='open' and status_value not in ('paused','fulfilled','cancelled') then raise exception 'Invalid requirement status transition.'; end if;
  if row_value.status='paused' and status_value not in ('open','fulfilled','cancelled') then raise exception 'Invalid requirement status transition.'; end if;
  update public.customer_requirements
  set status=status_value,closed_at=case when status_value in ('fulfilled','cancelled') then now() else null end,updated_at=now()
  where id=row_value.id returning * into row_value;
  return row_value;
end;
$$;
revoke all on function public.customer_update_requirement_status(uuid,text) from public,anon;
grant execute on function public.customer_update_requirement_status(uuid,text) to authenticated;
