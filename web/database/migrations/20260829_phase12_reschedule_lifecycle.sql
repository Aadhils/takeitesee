-- Phase 12 Module 3: production-grade customer reschedule lifecycle.
-- Customer reschedules become provider-confirmation requests, preserving old/new slots in history.

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (
  event_type in (
    'booking_created', 'booking_accepted', 'booking_declined', 'booking_rescheduled', 'booking_cancelled', 'service_completed',
    'reschedule_requested', 'reschedule_accepted', 'reschedule_declined'
  )
);

create or replace function public.get_reschedule_booking_conflicts(
  target_booking_id uuid,
  from_date date,
  to_date date
)
returns table (
  booking_date date,
  start_time time,
  duration_minutes integer,
  status public.booking_status
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_target public.bookings;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select b.* into v_target
  from public.bookings b
  where b.id = target_booking_id
    and b.customer_id = auth.uid();

  if not found then
    raise exception 'Booking not found or does not belong to this customer.';
  end if;

  return query
  select b.booking_date, b.start_time, b.duration_minutes, b.status
  from public.bookings b
  where b.id <> target_booking_id
    and b.status in ('pending', 'confirmed', 'rescheduled')
    and b.booking_date between from_date and to_date
    and (
      (v_target.provider_type = 'business' and b.business_id = v_target.business_id)
      or (v_target.provider_type = 'professional' and b.professional_id = v_target.professional_id)
    );
end;
$$;

revoke all on function public.get_reschedule_booking_conflicts(uuid, date, date) from public;
grant execute on function public.get_reschedule_booking_conflicts(uuid, date, date) to authenticated;

create or replace function public.reschedule_owned_booking(
  target_booking_id uuid,
  new_booking_date date,
  new_start_time time,
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_reason := btrim(coalesce(reschedule_reason, ''));
  if char_length(v_reason) < 3 then
    raise exception 'A reschedule reason is required.';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Reschedule reason must be 500 characters or fewer.';
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = target_booking_id
    and b.customer_id = auth.uid()
    and b.status in ('pending', 'confirmed', 'rescheduled')
  for update;

  if not found then
    raise exception 'Booking not found or cannot be rescheduled.';
  end if;

  if new_booking_date is null or new_start_time is null then
    raise exception 'New booking date and time are required.';
  end if;
  if new_booking_date < current_date then
    raise exception 'New booking date cannot be in the past.';
  end if;
  if v_booking.booking_date = new_booking_date and v_booking.start_time = new_start_time then
    raise exception 'Choose a different date or time to reschedule.';
  end if;

  v_previous_status := v_booking.status;
  v_old_slot := v_booking.booking_date::text || ' ' || left(v_booking.start_time::text, 8);
  v_new_slot := new_booking_date::text || ' ' || left(new_start_time::text, 8);

  update public.bookings
  set booking_date = new_booking_date,
      start_time = new_start_time,
      status = 'rescheduled',
      updated_at = now()
  where id = target_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, reason)
  values (
    target_booking_id,
    v_previous_status,
    'rescheduled',
    auth.uid(),
    'customer:reschedule | ' || v_reason || ' | from=' || v_old_slot || ' | to=' || v_new_slot
  );

  return v_booking;
end;
$$;

revoke all on function public.reschedule_owned_booking(uuid, date, time, text) from public;
grant execute on function public.reschedule_owned_booking(uuid, date, time, text) to authenticated;

create or replace function public.provider_update_booking_status(
  p_booking_id uuid,
  p_action text,
  p_reason text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_expected public.booking_status;
  v_next public.booking_status;
  v_eligible_at timestamptz;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_action not in ('accept','decline','complete') then
    raise exception 'A valid provider action is required.';
  end if;

  v_reason := btrim(coalesce(p_reason, ''));
  if p_action = 'decline' then
    if char_length(v_reason) < 3 then raise exception 'A decline reason is required.'; end if;
    if char_length(v_reason) > 500 then raise exception 'Decline reason must be 500 characters or fewer.'; end if;
  end if;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
    and (
      (p_action = 'complete' and b.status = 'confirmed')
      or (p_action in ('accept','decline') and b.status in ('pending','rescheduled'))
    )
    and (
      (b.business_id is not null and exists (
        select 1 from public.businesses bu
        where bu.id = b.business_id and bu.owner_user_id = auth.uid()
      ))
      or
      (b.professional_id is not null and exists (
        select 1 from public.professional_profiles pp
        where pp.id = b.professional_id and pp.user_id = auth.uid()
      ))
    )
  for update;

  if not found then
    raise exception 'Booking was not found, is not actionable, or is not owned by this provider.';
  end if;

  v_expected := v_booking.status;
  v_next := case
    when p_action = 'accept' then 'confirmed'::public.booking_status
    when p_action = 'decline' then 'cancelled'::public.booking_status
    else 'completed'::public.booking_status
  end;

  if p_action = 'complete' then
    v_eligible_at := ((v_booking.booking_date + v_booking.start_time) at time zone coalesce(v_booking.timezone, 'Asia/Kolkata'))
      + make_interval(mins => v_booking.duration_minutes);
    if now() < v_eligible_at then
      raise exception 'This service can be marked completed only after the scheduled service time.';
    end if;
  end if;

  update public.bookings
  set status = v_next,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, reason)
  values (
    p_booking_id,
    v_expected,
    v_next,
    auth.uid(),
    case
      when p_action = 'decline' then 'provider:decline | ' || v_reason
      when p_action = 'accept' and v_expected = 'rescheduled' then 'provider:accept_reschedule'
      else 'provider:' || p_action
    end
  );

  return v_booking;
end;
$$;

revoke all on function public.provider_update_booking_status(uuid, text, text) from public;
grant execute on function public.provider_update_booking_status(uuid, text, text) to authenticated;

create or replace function public.emit_booking_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_user_id uuid;
  customer_title text;
  customer_body text;
  provider_title text;
  provider_body text;
  event_name text;
begin
  if new.provider_type = 'business' then
    select owner_user_id into provider_user_id from public.businesses where id = new.business_id;
  else
    select user_id into provider_user_id from public.professional_profiles where id = new.professional_id;
  end if;

  if tg_op = 'INSERT' then
    event_name := 'booking_created';
    customer_title := 'Booking request sent';
    customer_body := new.service_name_snapshot || ' is awaiting provider confirmation.';
    provider_title := 'New booking request';
    provider_body := 'A customer requested ' || new.service_name_snapshot || ' for ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
  elsif new.status is distinct from old.status then
    if new.status = 'confirmed' then
      if old.status = 'rescheduled' then
        event_name := 'reschedule_accepted';
        customer_title := 'New time confirmed';
        customer_body := new.service_name_snapshot || ' is confirmed for ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
        provider_title := 'Reschedule confirmed';
        provider_body := 'You confirmed the new time for ' || new.service_name_snapshot || '.';
      else
        event_name := 'booking_accepted';
        customer_title := 'Booking confirmed';
        customer_body := new.service_name_snapshot || ' has been confirmed by the provider.';
        provider_title := 'Booking confirmed';
        provider_body := new.service_name_snapshot || ' is confirmed for ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
      end if;
    elsif new.status = 'cancelled' then
      if provider_user_id is not null and auth.uid() = provider_user_id and auth.uid() is distinct from new.customer_id then
        event_name := case when old.status = 'rescheduled' then 'reschedule_declined' else 'booking_declined' end;
        customer_title := case when old.status = 'rescheduled' then 'New time declined' else 'Booking declined' end;
        customer_body := case when old.status = 'rescheduled'
          then 'The provider could not accept the new time for ' || new.service_name_snapshot || '.'
          else new.service_name_snapshot || ' was declined by the provider.' end;
        provider_title := customer_title;
        provider_body := case when old.status = 'rescheduled'
          then 'You declined the reschedule request for ' || new.service_name_snapshot || '.'
          else 'You declined the booking request for ' || new.service_name_snapshot || '.' end;
      else
        event_name := 'booking_cancelled';
        customer_title := 'Booking cancelled';
        customer_body := new.service_name_snapshot || ' has been cancelled.';
        provider_title := 'Booking cancelled';
        provider_body := 'The customer cancelled the booking for ' || new.service_name_snapshot || '.';
      end if;
    elsif new.status = 'rescheduled' then
      event_name := 'reschedule_requested';
      customer_title := 'Reschedule request sent';
      customer_body := 'Your new time for ' || new.service_name_snapshot || ' is awaiting provider confirmation.';
      provider_title := 'New reschedule request';
      provider_body := new.service_name_snapshot || ' was moved to ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '. Please confirm the new time.';
    elsif new.status = 'completed' then
      event_name := 'service_completed';
      customer_title := 'Service completed';
      customer_body := new.service_name_snapshot || ' has been marked completed. You can now leave a review.';
      provider_title := 'Service completed';
      provider_body := new.service_name_snapshot || ' has been marked completed.';
    else
      return new;
    end if;
  elsif (new.booking_date is distinct from old.booking_date or new.start_time is distinct from old.start_time)
        and new.status = 'rescheduled' then
    event_name := 'reschedule_requested';
    customer_title := 'Reschedule request sent';
    customer_body := 'Your new time for ' || new.service_name_snapshot || ' is awaiting provider confirmation.';
    provider_title := 'New reschedule request';
    provider_body := new.service_name_snapshot || ' was moved to ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '. Please confirm the new time.';
  else
    return new;
  end if;

  if new.customer_id is not null then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
    values (new.customer_id, new.id, event_name, customer_title, customer_body);
  end if;

  if provider_user_id is not null and provider_user_id is distinct from new.customer_id then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
    values (provider_user_id, new.id, event_name, provider_title, provider_body);
  end if;

  return new;
end;
$$;
