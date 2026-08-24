create or replace function public.reschedule_owned_booking(
  target_booking_id uuid,
  new_booking_date date,
  new_start_time time,
  reschedule_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  updated_booking public.bookings;
  previous_status public.booking_status;
  caller_id uuid := auth.uid();
begin
  if caller_id is null then raise exception 'Authentication required'; end if;
  select status into previous_status from public.bookings where id = target_booking_id and customer_id = caller_id;
  if previous_status is null then raise exception 'Booking not found or does not belong to the current customer'; end if;
  if previous_status not in ('pending', 'confirmed', 'rescheduled') then raise exception 'Booking cannot be rescheduled from status %', previous_status; end if;
  update public.bookings set booking_date = new_booking_date, start_time = new_start_time, status = 'rescheduled', updated_at = now()
  where id = target_booking_id and customer_id = caller_id and status = previous_status returning * into updated_booking;
  if updated_booking.id is null then raise exception 'Booking could not be rescheduled'; end if;
  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, reason)
  values (updated_booking.id, previous_status, 'rescheduled', caller_id, nullif(trim(reschedule_reason), ''));
  return updated_booking;
end;
$$;
revoke all on function public.reschedule_owned_booking(uuid, date, time, text) from public;
grant execute on function public.reschedule_owned_booking(uuid, date, time, text) to authenticated;
