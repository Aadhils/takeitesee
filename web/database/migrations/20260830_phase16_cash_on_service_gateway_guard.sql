-- Phase 16 hardening: a delayed gateway event must never settle a Cash on Service booking.

create or replace function public.validate_booking_payment_transition()
returns trigger
language plpgsql
set search_path=public,pg_temp as $$
declare
  payment_source text:=coalesce(current_setting('takeitesee.payment_source',true),'');
begin
  if new.payment_status=old.payment_status then return new; end if;

  if not (
    (old.payment_status='unpaid' and new.payment_status in ('pending','paid'))
    or (old.payment_status='pending' and new.payment_status in ('unpaid','paid','failed'))
    or (old.payment_status='failed' and new.payment_status in ('unpaid','pending'))
    or (old.payment_status='paid' and new.payment_status='refunded')
  ) then
    raise exception 'Invalid payment transition from % to %.',old.payment_status,new.payment_status;
  end if;

  if new.payment_status='paid' and new.status='cancelled' then
    raise exception 'A cancelled booking cannot be newly marked paid.';
  end if;

  if new.payment_status='paid'
     and new.payment_method='cash_on_service'
     and (payment_source='gateway' or auth.role()='service_role') then
    raise exception 'Gateway payment cannot settle a Cash on Service booking.';
  end if;

  if new.payment_status='refunded'
     and new.status not in ('cancelled','completed')
     and payment_source<>'gateway' then
    raise exception 'Manual refunds are allowed only for cancelled or completed bookings.';
  end if;

  return new;
end;
$$;
