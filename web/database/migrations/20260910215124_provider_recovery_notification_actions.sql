-- Provider trust recovery notifications -> exact next-action routes.
-- Normalize future notification targets at the notification boundary without rewriting trust/verification state machines.
-- Finance/Cashfree/payment/refund/payout/settlement/reconciliation/recovery remain HOLD.
-- Recurrence/recovery remain frozen.

create or replace function private.align_provider_recovery_notification_target()
returns trigger
language plpgsql
security definer
set search_path=''
as $$
begin
  if new.event_type='provider_reverification_required' then
    new.target_path:='/provider/verification';
  elsif new.event_type='provider_suspended' then
    new.target_path:='/account/support';
  elsif new.event_type='provider_restored' then
    new.target_path:='/provider/public-readiness';
  elsif new.event_type='provider_verification_approved' then
    new.target_path:='/provider/public-readiness';
  end if;
  return new;
end;
$$;
revoke all on function private.align_provider_recovery_notification_target() from public,anon,authenticated;

drop trigger if exists notifications_provider_recovery_target_alignment on public.notifications;
create trigger notifications_provider_recovery_target_alignment
before insert or update of event_type,target_path on public.notifications
for each row execute function private.align_provider_recovery_notification_target();
