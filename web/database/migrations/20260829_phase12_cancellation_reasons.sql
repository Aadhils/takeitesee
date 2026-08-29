-- Phase 12: require explicit reasons for provider declines and customer cancellations,
-- preserve actor semantics in booking history, and emit clearer notifications.

drop function if exists public.provider_update_booking_status(uuid, text);

create function public.provider_update_booking_status(
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

  if p_action = 'decline' then
    v_reason := trim(coalesce(p_reason, ''));
    if char_length(v_reason) < 3 then
      raise exception 'A decline reason is required.';
    end if;
    if char_length(v_reason) > 500 then
      raise exception 'Decline reason must be 500 characters or fewer.';
    end if;
  end if;

  v_expected := case
    when p_action = 'complete' then 'confirmed'::public.booking_status
    else 'pending'::public.booking_status
  end;
  v_next := case
    when p_action = 'accept' then 'confirmed'::public.booking_status
    when p_action = 'decline' then 'cancelled'::public.booking_status
    else 'completed'::public.booking_status
  end;

  select b.* into v_booking
  from public.bookings b
  where b.id = p_booking_id
    and b.status = v_expected
    and (
      (b.business_id is not null and exists (
        select 1 from public.businesses bu
        where bu.id = b.business_id
          and bu.owner_user_id = auth.uid()
      ))
      or
      (b.professional_id is not null and exists (
        select 1 from public.professional_profiles pp
        where pp.id = b.professional_id
          and pp.user_id = auth.uid()
      ))
    )
  for update;

  if not found then
    raise exception 'Booking was not found, is no longer %, or is not owned by this provider.', v_expected;
  end if;

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
      else 'provider:' || p_action
    end
  );

  return v_booking;
end;
$$;

revoke all on function public.provider_update_booking_status(uuid, text, text) from public;
grant execute on function public.provider_update_booking_status(uuid, text, text) to authenticated;

create or replace function public.cancel_owned_booking(
  target_booking_id uuid,
  cancel_reason text default null
)
returns public.bookings
language plpgsql
set search_path = public
as $$
declare
  updated_booking public.bookings;
  previous_status public.booking_status;
  v_reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  v_reason := trim(coalesce(cancel_reason, ''));
  if char_length(v_reason) < 3 then
    raise exception 'A cancellation reason is required.';
  end if;
  if char_length(v_reason) > 500 then
    raise exception 'Cancellation reason must be 500 characters or fewer.';
  end if;

  select status into previous_status
  from public.bookings
  where id = target_booking_id
    and customer_id = auth.uid();

  update public.bookings
  set status = 'cancelled', updated_at = now()
  where id = target_booking_id
    and customer_id = auth.uid()
    and status in ('pending', 'confirmed', 'rescheduled')
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'Booking not found or cannot be cancelled';
  end if;

  insert into public.booking_status_history (booking_id, from_status, to_status, changed_by, reason)
  values (updated_booking.id, previous_status, 'cancelled', auth.uid(), 'customer:cancel | ' || v_reason);

  return updated_booking;
end;
$$;

revoke all on function public.cancel_owned_booking(uuid, text) from public;
grant execute on function public.cancel_owned_booking(uuid, text) to authenticated;

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
      event_name := 'booking_accepted';
      customer_title := 'Booking confirmed';
      customer_body := new.service_name_snapshot || ' has been confirmed by the provider.';
      provider_title := 'Booking confirmed';
      provider_body := new.service_name_snapshot || ' is confirmed for ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
    elsif new.status = 'cancelled' then
      if provider_user_id is not null and auth.uid() = provider_user_id and auth.uid() is distinct from new.customer_id then
        event_name := 'booking_declined';
        customer_title := 'Booking declined';
        customer_body := new.service_name_snapshot || ' was declined by the provider.';
        provider_title := 'Booking declined';
        provider_body := 'You declined the booking request for ' || new.service_name_snapshot || '.';
      else
        event_name := 'booking_cancelled';
        customer_title := 'Booking cancelled';
        customer_body := new.service_name_snapshot || ' has been cancelled.';
        provider_title := 'Booking cancelled';
        provider_body := 'The customer cancelled the booking for ' || new.service_name_snapshot || '.';
      end if;
    elsif new.status = 'rescheduled' then
      event_name := 'booking_rescheduled';
      customer_title := 'Booking rescheduled';
      customer_body := new.service_name_snapshot || ' is now scheduled for ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
      provider_title := 'Booking rescheduled';
      provider_body := new.service_name_snapshot || ' moved to ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
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
        and new.status in ('pending','confirmed','rescheduled') then
    event_name := 'booking_rescheduled';
    customer_title := 'Booking rescheduled';
    customer_body := new.service_name_snapshot || ' is now scheduled for ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
    provider_title := 'Booking rescheduled';
    provider_body := new.service_name_snapshot || ' moved to ' || new.booking_date::text || ' at ' || left(new.start_time::text, 5) || '.';
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
