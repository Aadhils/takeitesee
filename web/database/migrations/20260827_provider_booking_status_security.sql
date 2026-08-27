create or replace function public.provider_update_booking_status(
  p_booking_id uuid,
  p_action text
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
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  if p_action not in ('accept','decline','complete') then
    raise exception 'A valid provider action is required.';
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
  values (p_booking_id, v_expected, v_next, auth.uid(), 'provider:' || p_action);

  return v_booking;
end;
$$;

revoke all on function public.provider_update_booking_status(uuid, text) from public;
grant execute on function public.provider_update_booking_status(uuid, text) to authenticated;

drop policy if exists bookings_provider_read_owned on public.bookings;
create policy bookings_provider_read_owned
on public.bookings
for select
to authenticated
using (
  (business_id is not null and exists (
    select 1 from public.businesses bu
    where bu.id = bookings.business_id
      and bu.owner_user_id = auth.uid()
  ))
  or
  (professional_id is not null and exists (
    select 1 from public.professional_profiles pp
    where pp.id = bookings.professional_id
      and pp.user_id = auth.uid()
  ))
);
