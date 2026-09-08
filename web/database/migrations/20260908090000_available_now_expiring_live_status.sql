-- Available Now UX: make live operational states intentionally short-lived.
--
-- This remains Provider-level live work state only. It does NOT replace:
--   - per-service booking schedules / availability windows / blackouts, or
--   - Business Shop Open/Closed / operating hours.
--
-- Available and Busy must carry a future expiry so stale live state fails safe to Offline.
-- Offline and Paused never carry an expiry.
-- Finance/payment and recurrence/recovery surfaces are intentionally untouched.

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'provider_live_availability_expiry_shape'
      and conrelid = 'public.provider_live_availability'::regclass
  ) then
    alter table public.provider_live_availability
      add constraint provider_live_availability_expiry_shape check (
        (
          work_mode in ('available'::public.provider_work_mode, 'busy'::public.provider_work_mode)
          and mode_expires_at is not null
        )
        or
        (
          work_mode in ('offline'::public.provider_work_mode, 'paused'::public.provider_work_mode)
          and mode_expires_at is null
        )
      );
  end if;
end
$$;

create or replace function public.maintain_provider_live_availability()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  if tg_op = 'UPDATE' then
    if new.provider_type is distinct from old.provider_type
      or new.professional_id is distinct from old.professional_id
      or new.business_id is distinct from old.business_id then
      raise exception 'Provider live availability identity is immutable.';
    end if;
  end if;

  if new.work_mode in ('offline'::public.provider_work_mode, 'paused'::public.provider_work_mode) then
    new.mode_expires_at := null;
  else
    if new.mode_expires_at is null then
      raise exception 'Available and Busy live work modes require an expiry.';
    end if;
    if new.mode_expires_at <= now() then
      raise exception 'Live work-mode expiry must be in the future.';
    end if;
    if new.mode_expires_at > now() + interval '2 hours' then
      raise exception 'Live work-mode expiry cannot be more than two hours in the future.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    new.status_changed_at := now();
    new.created_at := coalesce(new.created_at, now());
  elsif new.work_mode is distinct from old.work_mode
    or new.mode_expires_at is distinct from old.mode_expires_at then
    new.status_changed_at := now();
  end if;

  new.updated_at := now();
  return new;
end;
$$;

revoke all on function public.maintain_provider_live_availability() from public, anon, authenticated;

comment on column public.provider_live_availability.mode_expires_at is
  'Required future expiry for Available/Busy live mode; Offline/Paused have no expiry. Consumers treat expired live state as Offline.';
