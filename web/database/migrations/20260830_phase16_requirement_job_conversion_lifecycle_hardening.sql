-- Phase 16 Module 4 lifecycle hardening.
-- Once a proposal is awarded, completion is authoritative through the linked booking.
-- A requirement cannot be cancelled while a live linked booking still exists.

create or replace function public.customer_update_requirement_status(target_requirement_id uuid,target_status text)
returns public.customer_requirements
language plpgsql
security definer
set search_path=public,pg_temp
as $$
declare
  row_value public.customer_requirements%rowtype;
  status_value text:=lower(btrim(coalesce(target_status,'')));
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if status_value not in ('open','paused','fulfilled','cancelled') then raise exception 'Requirement status is invalid.'; end if;

  select * into row_value
  from public.customer_requirements
  where id=target_requirement_id
  for update;
  if not found then raise exception 'Requirement was not found.'; end if;
  if row_value.customer_id<>auth.uid() then raise exception 'You can manage only your own requirement.'; end if;
  if row_value.status=status_value then return row_value; end if;
  if row_value.status in ('fulfilled','cancelled') then raise exception 'A closed requirement cannot be reopened.'; end if;

  if row_value.status='awarded' and status_value='fulfilled' then
    raise exception 'An awarded requirement is fulfilled automatically through its linked service job after completion, customer confirmation and payment settlement.';
  end if;

  if row_value.status='awarded' and status_value='cancelled' and exists(
    select 1 from public.marketplace_requirement_jobs
    where requirement_id=row_value.id and state in ('active','service_completed')
  ) then
    raise exception 'Cancel or finish the linked service job before cancelling this requirement.';
  end if;

  if row_value.status='awarded' and status_value not in ('fulfilled','cancelled') then
    raise exception 'An awarded requirement can only close through its service job or be cancelled after the linked job is closed.';
  end if;
  if row_value.status='open' and status_value not in ('paused','fulfilled','cancelled') then raise exception 'Invalid requirement status transition.'; end if;
  if row_value.status='paused' and status_value not in ('open','fulfilled','cancelled') then raise exception 'Invalid requirement status transition.'; end if;

  update public.customer_requirements
  set status=status_value,
      closed_at=case when status_value in ('fulfilled','cancelled') then now() else null end,
      updated_at=now()
  where id=row_value.id
  returning * into row_value;
  return row_value;
end;
$$;
revoke all on function public.customer_update_requirement_status(uuid,text) from public,anon;
grant execute on function public.customer_update_requirement_status(uuid,text) to authenticated;
