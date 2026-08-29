create or replace function public.get_public_booking_conflicts(
  target_provider_type text,
  target_provider_id uuid,
  from_date date,
  to_date date
)
returns table (
  booking_date date,
  start_time time without time zone,
  duration_minutes integer,
  status text
)
language sql
stable
security definer
set search_path = public
as $$
  select
    b.booking_date,
    b.start_time,
    b.duration_minutes,
    b.status::text
  from public.bookings b
  where b.booking_date between from_date and to_date
    and b.status in ('pending', 'confirmed', 'rescheduled')
    and (
      (target_provider_type = 'professional' and b.professional_id = target_provider_id)
      or
      (target_provider_type = 'business' and b.business_id = target_provider_id)
    );
$$;

revoke all on function public.get_public_booking_conflicts(text, uuid, date, date) from public;
grant execute on function public.get_public_booking_conflicts(text, uuid, date, date) to anon, authenticated;
