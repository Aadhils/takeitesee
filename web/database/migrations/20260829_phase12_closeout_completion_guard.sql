-- Phase 12 Module 8: prevent direct RPC completion after a no-show outcome.
create or replace function public.provider_update_booking_status(p_booking_id uuid, p_action text, p_reason text default null)
returns public.bookings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_booking public.bookings;
  v_expected public.booking_status;
  v_next public.booking_status;
  v_eligible_at timestamptz;
  v_reason text;
  v_attendance text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  if p_action not in ('accept','decline','complete') then raise exception 'A valid provider action is required.'; end if;
  v_reason := btrim(coalesce(p_reason, ''));
  if p_action = 'decline' then
    if char_length(v_reason) < 3 then raise exception 'A decline reason is required.'; end if;
    if char_length(v_reason) > 500 then raise exception 'Decline reason must be 500 characters or fewer.'; end if;
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
    and ((p_action = 'complete' and b.status = 'confirmed') or (p_action in ('accept','decline') and b.status in ('pending','rescheduled')))
    and ((b.business_id is not null and exists (select 1 from public.businesses bu where bu.id=b.business_id and bu.owner_user_id=auth.uid()))
      or (b.professional_id is not null and exists (select 1 from public.professional_profiles pp where pp.id=b.professional_id and pp.user_id=auth.uid())))
  for update;
  if not found then raise exception 'Booking was not found, is not actionable, or is not owned by this provider.'; end if;

  v_expected := v_booking.status;
  v_next := case when p_action='accept' then 'confirmed'::public.booking_status when p_action='decline' then 'cancelled'::public.booking_status else 'completed'::public.booking_status end;

  if p_action = 'complete' then
    select attendance_outcome into v_attendance from public.booking_closeouts where booking_id=p_booking_id;
    if v_attendance is not null and v_attendance <> 'pending' then
      raise exception 'This booking already has an attendance outcome and cannot be marked completed.';
    end if;
    v_eligible_at := ((v_booking.booking_date + v_booking.start_time) at time zone coalesce(v_booking.timezone,'Asia/Kolkata')) + make_interval(mins=>v_booking.duration_minutes);
    if now() < v_eligible_at then raise exception 'This service can be marked completed only after the scheduled service time.'; end if;
  end if;

  update public.bookings set status=v_next,updated_at=now() where id=p_booking_id returning * into v_booking;
  insert into public.booking_status_history(booking_id,from_status,to_status,changed_by,reason)
  values(p_booking_id,v_expected,v_next,auth.uid(),case when p_action='decline' then 'provider:decline | '||v_reason when p_action='accept' and v_expected='rescheduled' then 'provider:accept_reschedule' else 'provider:'||p_action end);
  return v_booking;
end;
$$;
