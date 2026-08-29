-- Phase 12 Module 8: no-show outcomes cannot be overwritten by customer cancel/reschedule APIs.

create or replace function public.cancel_owned_booking(target_booking_id uuid, cancel_reason text default null)
returns public.bookings
language plpgsql
set search_path = public
as $$
declare
  updated_booking public.bookings;
  current_booking public.bookings%rowtype;
  previous_status public.booking_status;
  v_reason text;
  v_attendance text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  v_reason := trim(coalesce(cancel_reason, ''));
  if char_length(v_reason) < 3 then raise exception 'A cancellation reason is required.'; end if;
  if char_length(v_reason) > 500 then raise exception 'Cancellation reason must be 500 characters or fewer.'; end if;

  select * into current_booking from public.bookings
  where id = target_booking_id and customer_id = auth.uid()
  for update;
  if not found then raise exception 'Booking not found or cannot be cancelled'; end if;

  select attendance_outcome into v_attendance from public.booking_closeouts where booking_id = target_booking_id;
  if v_attendance is not null and v_attendance <> 'pending' then
    raise exception 'This booking already has an attendance outcome. Use support if you need to dispute it.';
  end if;

  if current_booking.status not in ('pending','confirmed','rescheduled') then
    raise exception 'Booking not found or cannot be cancelled';
  end if;
  previous_status := current_booking.status;

  update public.bookings set status = 'cancelled', updated_at = now()
  where id = target_booking_id
  returning * into updated_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, reason)
  values (updated_booking.id, previous_status, 'cancelled', auth.uid(), 'customer:cancel | ' || v_reason);
  return updated_booking;
end;
$$;

create or replace function public.reschedule_owned_booking(
  target_booking_id uuid,
  new_booking_date date,
  new_start_time time without time zone,
  reschedule_reason text
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_previous_status public.booking_status;
  v_reason text;
  v_old_slot text;
  v_new_slot text;
  v_attendance text;
begin
  if auth.uid() is null then raise exception 'Authentication required.'; end if;
  v_reason := btrim(coalesce(reschedule_reason, ''));
  if char_length(v_reason) < 3 then raise exception 'A reschedule reason is required.'; end if;
  if char_length(v_reason) > 500 then raise exception 'Reschedule reason must be 500 characters or fewer.'; end if;

  select b.* into v_booking from public.bookings b
  where b.id = target_booking_id
    and b.customer_id = auth.uid()
    and b.status in ('pending','confirmed','rescheduled')
  for update;
  if not found then raise exception 'Booking not found or cannot be rescheduled.'; end if;

  select attendance_outcome into v_attendance from public.booking_closeouts where booking_id = target_booking_id;
  if v_attendance is not null and v_attendance <> 'pending' then
    raise exception 'This booking already has an attendance outcome. Use support if you need to dispute it.';
  end if;

  if new_booking_date is null or new_start_time is null then raise exception 'New booking date and time are required.'; end if;
  if new_booking_date < current_date then raise exception 'New booking date cannot be in the past.'; end if;
  if v_booking.booking_date = new_booking_date and v_booking.start_time = new_start_time then raise exception 'Choose a different date or time to reschedule.'; end if;

  v_previous_status := v_booking.status;
  v_old_slot := v_booking.booking_date::text || ' ' || left(v_booking.start_time::text, 8);
  v_new_slot := new_booking_date::text || ' ' || left(new_start_time::text, 8);

  update public.bookings
  set booking_date = new_booking_date, start_time = new_start_time, status = 'rescheduled', updated_at = now()
  where id = target_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, reason)
  values (target_booking_id, v_previous_status, 'rescheduled', auth.uid(), 'customer:reschedule | ' || v_reason || ' | from=' || v_old_slot || ' | to=' || v_new_slot);
  return v_booking;
end;
$$;
