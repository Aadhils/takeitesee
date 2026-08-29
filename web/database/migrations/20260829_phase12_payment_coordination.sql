-- Phase 12 Module 5: payment and booking status coordination foundation.
-- This does not charge cards or move funds. It provides an immutable payment audit trail,
-- safe payment-state transitions, high-trust admin mutation, and payment notifications.

create table if not exists public.booking_payment_events (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references public.bookings(id) on delete cascade,
  from_status public.payment_status,
  to_status public.payment_status not null,
  amount numeric(12,2) not null check (amount >= 0),
  currency text not null,
  source text not null check (source in ('system','admin','gateway','migration')),
  external_reference text,
  note text,
  changed_by uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

create index if not exists booking_payment_events_booking_created_idx
  on public.booking_payment_events(booking_id, created_at desc);

alter table public.booking_payment_events enable row level security;

drop policy if exists payment_events_customer_read on public.booking_payment_events;
create policy payment_events_customer_read
on public.booking_payment_events
for select
to authenticated
using (
  exists (
    select 1 from public.bookings b
    where b.id = booking_payment_events.booking_id
      and b.customer_id = auth.uid()
  )
);

drop policy if exists payment_events_provider_read on public.booking_payment_events;
create policy payment_events_provider_read
on public.booking_payment_events
for select
to authenticated
using (
  exists (
    select 1
    from public.bookings b
    where b.id = booking_payment_events.booking_id
      and (
        exists (
          select 1 from public.professional_profiles p
          where p.id = b.professional_id and p.user_id = auth.uid()
        )
        or exists (
          select 1 from public.businesses biz
          where biz.id = b.business_id and biz.owner_user_id = auth.uid()
        )
      )
  )
);

drop policy if exists payment_events_admin_read on public.booking_payment_events;
create policy payment_events_admin_read
on public.booking_payment_events
for select
to authenticated
using (
  exists (
    select 1 from public.users u
    where u.id = auth.uid() and u.role::text in ('admin','super_admin')
  )
  or exists (
    select 1
    from public.admin_memberships am
    join public.admin_scopes s on s.admin_membership_id = am.id
    where am.user_id = auth.uid()
      and am.active = true
      and s.can_view = true
  )
);

create or replace function public.validate_booking_payment_transition()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.payment_status = old.payment_status then
    return new;
  end if;

  if not (
    (old.payment_status = 'unpaid' and new.payment_status in ('pending','paid'))
    or (old.payment_status = 'pending' and new.payment_status in ('unpaid','paid','failed'))
    or (old.payment_status = 'failed' and new.payment_status in ('unpaid','pending'))
    or (old.payment_status = 'paid' and new.payment_status = 'refunded')
  ) then
    raise exception 'Invalid payment transition from % to %.', old.payment_status, new.payment_status;
  end if;

  if new.payment_status = 'paid' and new.status = 'cancelled' then
    raise exception 'A cancelled booking cannot be newly marked paid.';
  end if;

  if new.payment_status = 'refunded' and new.status not in ('cancelled','completed') then
    raise exception 'Refunds are allowed only for cancelled or completed bookings.';
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_validate_payment_transition on public.bookings;
create trigger bookings_validate_payment_transition
before update of payment_status on public.bookings
for each row execute function public.validate_booking_payment_transition();

create or replace function public.log_booking_payment_event()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_source text;
  v_note text;
  v_reference text;
begin
  if tg_op = 'UPDATE' and new.payment_status = old.payment_status then
    return new;
  end if;

  v_source := nullif(current_setting('takeitesee.payment_source', true), '');
  v_note := nullif(current_setting('takeitesee.payment_note', true), '');
  v_reference := nullif(current_setting('takeitesee.payment_reference', true), '');

  if v_source is null then
    if auth.role() = 'service_role' then
      v_source := 'gateway';
    elsif exists (select 1 from public.users u where u.id = auth.uid() and u.role::text in ('admin','super_admin')) then
      v_source := 'admin';
    else
      v_source := 'system';
    end if;
  end if;

  insert into public.booking_payment_events(
    booking_id, from_status, to_status, amount, currency, source,
    external_reference, note, changed_by
  ) values (
    new.id,
    case when tg_op = 'INSERT' then null else old.payment_status end,
    new.payment_status,
    new.quoted_price,
    new.currency,
    v_source,
    v_reference,
    v_note,
    auth.uid()
  );

  return new;
end;
$$;

drop trigger if exists bookings_log_payment_event_insert on public.bookings;
create trigger bookings_log_payment_event_insert
after insert on public.bookings
for each row execute function public.log_booking_payment_event();

drop trigger if exists bookings_log_payment_event_update on public.bookings;
create trigger bookings_log_payment_event_update
after update of payment_status on public.bookings
for each row execute function public.log_booking_payment_event();

-- Backfill one baseline event for bookings that pre-date the payment ledger.
insert into public.booking_payment_events(
  booking_id, from_status, to_status, amount, currency, source, note, created_at
)
select b.id, null, b.payment_status, b.quoted_price, b.currency, 'migration',
       'Baseline payment state when Phase 12 payment ledger was introduced.', b.created_at
from public.bookings b
where not exists (
  select 1 from public.booking_payment_events e where e.booking_id = b.id
);

create or replace function public.admin_update_booking_payment(
  p_booking_id uuid,
  p_next_status public.payment_status,
  p_note text default null,
  p_external_reference text default null
)
returns public.bookings
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking public.bookings;
  v_note text;
  v_allowed boolean := false;
begin
  if auth.uid() is null then
    raise exception 'Authentication required.';
  end if;

  select (
    exists (
      select 1 from public.users u
      where u.id = auth.uid() and u.role::text = 'super_admin'
    )
    or exists (
      select 1
      from public.admin_memberships am
      join public.admin_scopes s on s.admin_membership_id = am.id
      where am.user_id = auth.uid()
        and am.active = true
        and s.scope_type::text = 'platform'
        and s.can_manage = true
    )
  ) into v_allowed;

  if not v_allowed then
    raise exception 'Platform payment management permission is required.';
  end if;

  v_note := nullif(btrim(coalesce(p_note, '')), '');
  if p_next_status in ('failed','refunded') and (v_note is null or char_length(v_note) < 3) then
    raise exception 'A reason is required for failed or refunded payment states.';
  end if;
  if v_note is not null and char_length(v_note) > 500 then
    raise exception 'Payment note must be 500 characters or fewer.';
  end if;

  select * into v_booking from public.bookings where id = p_booking_id for update;
  if not found then raise exception 'Booking not found.'; end if;
  if v_booking.payment_status = p_next_status then raise exception 'Payment is already in the requested state.'; end if;

  perform set_config('takeitesee.payment_source', 'admin', true);
  perform set_config('takeitesee.payment_note', coalesce(v_note, ''), true);
  perform set_config('takeitesee.payment_reference', coalesce(nullif(btrim(coalesce(p_external_reference, '')), ''), ''), true);

  update public.bookings
  set payment_status = p_next_status,
      updated_at = now()
  where id = p_booking_id
  returning * into v_booking;

  return v_booking;
end;
$$;

revoke all on function public.admin_update_booking_payment(uuid, public.payment_status, text, text) from public;
grant execute on function public.admin_update_booking_payment(uuid, public.payment_status, text, text) to authenticated;

alter table public.notifications drop constraint if exists notifications_event_type_check;
alter table public.notifications add constraint notifications_event_type_check check (
  event_type in (
    'booking_created', 'booking_accepted', 'booking_declined', 'booking_rescheduled', 'booking_cancelled', 'service_completed',
    'reschedule_requested', 'reschedule_accepted', 'reschedule_declined',
    'payment_pending', 'payment_paid', 'payment_failed', 'payment_refunded'
  )
);

create or replace function public.emit_payment_notifications()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  provider_user_id uuid;
  v_event text;
  v_customer_title text;
  v_customer_body text;
  v_provider_title text;
  v_provider_body text;
begin
  if new.payment_status = old.payment_status then return new; end if;

  if new.provider_type = 'business' then
    select owner_user_id into provider_user_id from public.businesses where id = new.business_id;
  else
    select user_id into provider_user_id from public.professional_profiles where id = new.professional_id;
  end if;

  case new.payment_status
    when 'pending' then
      v_event := 'payment_pending';
      v_customer_title := 'Payment processing';
      v_customer_body := 'Payment for ' || new.service_name_snapshot || ' is being processed.';
      v_provider_title := 'Payment processing';
      v_provider_body := 'Payment for ' || new.service_name_snapshot || ' is pending.';
    when 'paid' then
      v_event := 'payment_paid';
      v_customer_title := 'Payment received';
      v_customer_body := 'Payment for ' || new.service_name_snapshot || ' has been recorded as paid.';
      v_provider_title := 'Payment received';
      v_provider_body := 'Payment for ' || new.service_name_snapshot || ' has been recorded as paid.';
    when 'failed' then
      v_event := 'payment_failed';
      v_customer_title := 'Payment failed';
      v_customer_body := 'Payment for ' || new.service_name_snapshot || ' was not completed.';
      v_provider_title := 'Payment failed';
      v_provider_body := 'Payment for ' || new.service_name_snapshot || ' was not completed.';
    when 'refunded' then
      v_event := 'payment_refunded';
      v_customer_title := 'Payment refunded';
      v_customer_body := 'Payment for ' || new.service_name_snapshot || ' has been recorded as refunded.';
      v_provider_title := 'Payment refunded';
      v_provider_body := 'Payment for ' || new.service_name_snapshot || ' has been refunded and is excluded from earnings.';
    else
      return new;
  end case;

  insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
  values (new.customer_id, new.id, v_event, v_customer_title, v_customer_body);

  if provider_user_id is not null and provider_user_id is distinct from new.customer_id then
    insert into public.notifications(recipient_user_id, booking_id, event_type, title, body)
    values (provider_user_id, new.id, v_event, v_provider_title, v_provider_body);
  end if;

  return new;
end;
$$;

drop trigger if exists bookings_emit_payment_notifications on public.bookings;
create trigger bookings_emit_payment_notifications
after update of payment_status on public.bookings
for each row execute function public.emit_payment_notifications();
