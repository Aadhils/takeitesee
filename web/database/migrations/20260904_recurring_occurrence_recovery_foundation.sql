-- Universal Services Ecosystem: explicit recovery for failed recurring requirement occurrences.
-- A cancelled/declined occurrence is retried at the same sequence number. The next occurrence stays locked.
-- Old booking history is preserved; no payment, Cashfree, payout, refund or settlement behavior is changed.

create table if not exists public.requirement_occurrence_recoveries (
  id uuid primary key default gen_random_uuid(),
  requirement_id uuid not null references public.customer_requirements(id) on delete restrict,
  sequence_no integer not null check (sequence_no > 0),
  prior_job_id uuid not null,
  prior_booking_id uuid not null references public.bookings(id) on delete restrict,
  prior_proposal_id uuid not null references public.requirement_proposals(id) on delete restrict,
  action text not null default 'retry_same_occurrence' check (action in ('retry_same_occurrence')),
  status text not null default 'initiated' check (status in ('initiated','completed')),
  -- Requirement job rows are intentionally replaceable on a later retry. Preserve their UUIDs as audit facts without FK delete blocking.
  replacement_job_id uuid,
  replacement_booking_id uuid references public.bookings(id) on delete restrict,
  created_by uuid not null references public.users(id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  unique(prior_job_id)
);

create index if not exists requirement_occurrence_recoveries_requirement_idx
  on public.requirement_occurrence_recoveries(requirement_id,sequence_no,created_at desc);

alter table public.requirement_occurrence_recoveries enable row level security;
revoke all on public.requirement_occurrence_recoveries from anon;
revoke insert,update,delete on public.requirement_occurrence_recoveries from authenticated;
grant select on public.requirement_occurrence_recoveries to authenticated;
grant select,insert,update,delete on public.requirement_occurrence_recoveries to service_role;

drop policy if exists requirement_occurrence_recoveries_customer_read on public.requirement_occurrence_recoveries;
create policy requirement_occurrence_recoveries_customer_read
on public.requirement_occurrence_recoveries
for select to authenticated
using (
  exists(
    select 1
    from public.customer_requirements r
    where r.id=requirement_occurrence_recoveries.requirement_id
      and r.customer_id=auth.uid()
  )
);

create or replace function public.customer_retry_requirement_occurrence(
  target_requirement_id uuid,
  requested_booking_date date,
  requested_start_time time without time zone,
  requested_notes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  requirement_row public.customer_requirements%rowtype;
  failed_job public.marketplace_requirement_jobs%rowtype;
  failed_booking public.bookings%rowtype;
  recovery_row public.requirement_occurrence_recoveries%rowtype;
  replacement jsonb;
  replacement_job_id uuid;
  replacement_booking_id uuid;
  archived_key text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if requested_booking_date is null or requested_start_time is null then
    raise exception 'Booking date and time are required.';
  end if;

  select * into requirement_row
  from public.customer_requirements
  where id=target_requirement_id
  for update;
  if not found then raise exception 'Requirement was not found.'; end if;
  if requirement_row.customer_id<>auth.uid() then
    raise exception 'You can recover only your own requirement occurrence.';
  end if;
  if requirement_row.schedule_pattern<>'recurring' or requirement_row.status<>'awarded' then
    raise exception 'Occurrence recovery is available only for an awarded recurring requirement.';
  end if;

  select * into failed_job
  from public.marketplace_requirement_jobs
  where requirement_id=requirement_row.id
  order by sequence_no desc
  limit 1
  for update;
  if not found then raise exception 'No recurring occurrence is available to recover.'; end if;
  if failed_job.state not in ('cancelled','declined') then
    raise exception 'Only a cancelled or declined occurrence can be retried.';
  end if;
  if failed_job.sequence_no>coalesce(requirement_row.recurrence_count,0) then
    raise exception 'The failed occurrence sequence is outside the recurring plan.';
  end if;
  if exists(
    select 1 from public.marketplace_requirement_jobs
    where requirement_id=requirement_row.id
      and state in ('active','service_completed')
      and id<>failed_job.id
  ) then
    raise exception 'Another occurrence is already active.';
  end if;
  if exists(
    select 1 from public.requirement_occurrence_recoveries
    where prior_job_id=failed_job.id
  ) then
    raise exception 'This failed occurrence has already been recovered.';
  end if;

  select * into failed_booking
  from public.bookings
  where id=failed_job.booking_id
  for update;
  if not found then raise exception 'The failed occurrence booking was not found.'; end if;
  if failed_booking.status<>'cancelled' then
    raise exception 'The failed occurrence booking must be cancelled before retry.';
  end if;
  if failed_booking.payment_status<>'unpaid' then
    raise exception 'A cancelled occurrence with payment activity requires support review before retry.';
  end if;

  archived_key:=failed_booking.idempotency_key||':recovered:'||substr(replace(gen_random_uuid()::text,'-',''),1,8);
  update public.bookings
  set idempotency_key=archived_key,updated_at=now()
  where id=failed_booking.id;

  insert into public.requirement_occurrence_recoveries(
    requirement_id,sequence_no,prior_job_id,prior_booking_id,prior_proposal_id,created_by
  ) values (
    requirement_row.id,failed_job.sequence_no,failed_job.id,failed_job.booking_id,failed_job.proposal_id,auth.uid()
  ) returning * into recovery_row;

  delete from public.marketplace_requirement_jobs where id=failed_job.id;

  replacement:=public.customer_create_requirement_job(
    target_requirement_id,
    requested_booking_date,
    requested_start_time,
    requested_notes
  );

  replacement_job_id:=nullif(replacement#>>'{job,id}','')::uuid;
  replacement_booking_id:=nullif(replacement#>>'{booking,id}','')::uuid;
  if replacement_job_id is null or replacement_booking_id is null then
    raise exception 'Replacement occurrence could not be created.';
  end if;

  if (replacement#>>'{job,sequence_no}')::integer<>failed_job.sequence_no then
    raise exception 'Recovery sequence mismatch.';
  end if;

  update public.requirement_occurrence_recoveries
  set status='completed',replacement_job_id=replacement_job_id,replacement_booking_id=replacement_booking_id,completed_at=now()
  where id=recovery_row.id;

  return jsonb_build_object(
    'recovery',jsonb_build_object(
      'id',recovery_row.id,
      'action','retry_same_occurrence',
      'sequence_no',failed_job.sequence_no,
      'prior_booking_id',failed_job.booking_id,
      'replacement_job_id',replacement_job_id,
      'replacement_booking_id',replacement_booking_id
    ),
    'job',replacement->'job',
    'booking',replacement->'booking'
  );
end;
$$;

revoke all on function public.customer_retry_requirement_occurrence(uuid,date,time without time zone,text) from public,anon;
grant execute on function public.customer_retry_requirement_occurrence(uuid,date,time without time zone,text) to authenticated;

create or replace function public.get_customer_requirement_recovery_history(target_requirement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  result_value jsonb;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if not exists(
    select 1 from public.customer_requirements
    where id=target_requirement_id and customer_id=auth.uid()
  ) then
    raise exception 'Requirement access is required.';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'id',r.id,
    'sequence_no',r.sequence_no,
    'action',r.action,
    'status',r.status,
    'prior_booking_id',r.prior_booking_id,
    'replacement_booking_id',r.replacement_booking_id,
    'created_at',r.created_at,
    'completed_at',r.completed_at
  ) order by r.created_at desc),'[]'::jsonb)
  into result_value
  from public.requirement_occurrence_recoveries r
  where r.requirement_id=target_requirement_id;

  return result_value;
end;
$$;

revoke all on function public.get_customer_requirement_recovery_history(uuid) from public,anon;
grant execute on function public.get_customer_requirement_recovery_history(uuid) to authenticated;
