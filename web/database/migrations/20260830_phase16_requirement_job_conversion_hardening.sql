-- Phase 16 Module 4 hardening: booking_status has no `rejected` enum value.
-- Provider decline is represented by booking status `cancelled` in the existing lifecycle.

create or replace function public.sync_requirement_job_booking_state()
returns trigger
language plpgsql
security definer
set search_path=public,pg_temp
as $$
begin
  if tg_op='UPDATE'
     and new.status is not distinct from old.status
     and new.payment_status is not distinct from old.payment_status then
    return new;
  end if;

  update public.marketplace_requirement_jobs
  set state=case
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
