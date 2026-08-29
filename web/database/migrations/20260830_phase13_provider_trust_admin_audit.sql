-- Mirror immutable provider trust events into the platform control-plane audit log.

create or replace function public.audit_provider_trust_event()
returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
  if new.actor_type='admin' and new.actor_user_id is not null then
    insert into public.admin_audit_log(
      actor_user_id,
      action,
      resource_type,
      resource_id,
      metadata
    ) values (
      new.actor_user_id,
      'provider.trust.' || new.event_type,
      'provider_trust_state',
      new.trust_state_id::text,
      jsonb_build_object(
        'from_status',new.from_status,
        'to_status',new.to_status,
        'reason',new.reason
      )
    );
  end if;
  return new;
end;
$$;

drop trigger if exists provider_trust_events_admin_audit on public.provider_trust_events;
create trigger provider_trust_events_admin_audit
after insert on public.provider_trust_events
for each row execute function public.audit_provider_trust_event();
