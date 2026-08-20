-- TakeItSee security hardening.
-- Keeps customer role server-controlled and validates cancellation input.

create or replace function public.handle_auth_user_created()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.users (id, name, email, phone, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'name', split_part(new.email, '@', 1)),
    new.email,
    new.raw_user_meta_data ->> 'phone',
    'customer'
  )
  on conflict (id) do update
    set email = excluded.email,
        updated_at = now();

  insert into public.customer_profiles (user_id)
  values (new.id)
  on conflict (user_id) do nothing;

  return new;
end;
$$;

revoke all on function public.handle_auth_user_created() from public;

create or replace function public.cancel_owned_booking(
  target_booking_id uuid,
  cancel_reason text default null
)
returns public.bookings
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_booking public.bookings;
  previous_status public.booking_status;
  normalized_reason text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required';
  end if;

  normalized_reason := nullif(btrim(cancel_reason), '');
  if normalized_reason is not null and char_length(normalized_reason) > 500 then
    raise exception 'Cancellation reason is too long';
  end if;

  select b.status
    into previous_status
    from public.bookings b
   where b.id = target_booking_id
     and b.customer_id = auth.uid();

  update public.bookings
     set status = 'cancelled',
         updated_at = now()
   where id = target_booking_id
     and customer_id = auth.uid()
     and status in ('pending', 'confirmed', 'rescheduled')
  returning * into updated_booking;

  if updated_booking.id is null then
    raise exception 'Booking not found or cannot be cancelled';
  end if;

  insert into public.booking_status_history
    (booking_id, from_status, to_status, changed_by, reason)
  values
    (updated_booking.id, previous_status, 'cancelled', auth.uid(), normalized_reason);

  return updated_booking;
end;
$$;

revoke all on function public.cancel_owned_booking(uuid, text) from public;
grant execute on function public.cancel_owned_booking(uuid, text) to authenticated;
