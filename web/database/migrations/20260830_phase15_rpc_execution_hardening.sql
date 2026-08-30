-- Phase 15: narrow SECURITY DEFINER execution before finance activation.
--
-- Public marketplace helper functions intentionally retain anonymous execution where
-- they are required by public availability / RLS policy paths. Mutating and
-- user-specific RPCs become signed-in-only, while trigger functions are not exposed
-- as callable Data API RPCs.

-- Signed-in / privileged actions: anonymous callers must never invoke these.
revoke execute on function public.admin_update_booking_payment(uuid, public.payment_status, text, text) from public, anon;
revoke execute on function public.apply_booking_closeout_rules(uuid) from public, anon;
revoke execute on function public.customer_confirm_service_completion(uuid) from public, anon;
revoke execute on function public.customer_report_provider_no_show(uuid, text) from public, anon;
revoke execute on function public.get_reschedule_booking_conflicts(uuid, date, date) from public, anon;
revoke execute on function public.open_booking_support_case(uuid, text, text, text, text) from public, anon;
revoke execute on function public.provider_report_customer_no_show(uuid, text) from public, anon;
revoke execute on function public.provider_trust_status(text, uuid, uuid) from public, anon;
revoke execute on function public.provider_update_booking_status(uuid, text, text) from public, anon;
revoke execute on function public.reschedule_owned_booking(uuid, date, time without time zone, text) from public, anon;
revoke execute on function public.respond_to_owned_review(uuid, text) from public, anon;
revoke execute on function public.super_admin_set_admin_membership_active(uuid, boolean) from public, anon;
revoke execute on function public.super_admin_update_admin_scope(uuid, boolean, boolean) from public, anon;
revoke execute on function public.update_marketplace_issue(uuid, text, text) from public, anon;
revoke execute on function public.update_scoped_service_settings(uuid, uuid, uuid, uuid, boolean, boolean, text, boolean, boolean, smallint) from public, anon;

-- Trigger-only SECURITY DEFINER functions execute through their triggers. They do not
-- need to be directly callable by anonymous or ordinary signed-in API roles.
revoke execute on function public.audit_provider_trust_event() from public, anon, authenticated;
revoke execute on function public.emit_booking_notifications() from public, anon, authenticated;
revoke execute on function public.emit_payment_notifications() from public, anon, authenticated;
revoke execute on function public.ensure_provider_trust_state() from public, anon, authenticated;
revoke execute on function public.log_booking_payment_event() from public, anon, authenticated;
revoke execute on function public.notify_provider_of_review() from public, anon, authenticated;
revoke execute on function public.sync_completed_booking_closeout() from public, anon, authenticated;

-- Keep explicit signed-in execution on user/admin RPCs. Function bodies retain their
-- ownership / admin / Super Admin authorization checks and fail closed.
grant execute on function public.admin_update_booking_payment(uuid, public.payment_status, text, text) to authenticated, service_role;
grant execute on function public.apply_booking_closeout_rules(uuid) to authenticated, service_role;
grant execute on function public.customer_confirm_service_completion(uuid) to authenticated, service_role;
grant execute on function public.customer_report_provider_no_show(uuid, text) to authenticated, service_role;
grant execute on function public.get_reschedule_booking_conflicts(uuid, date, date) to authenticated, service_role;
grant execute on function public.open_booking_support_case(uuid, text, text, text, text) to authenticated, service_role;
grant execute on function public.provider_report_customer_no_show(uuid, text) to authenticated, service_role;
grant execute on function public.provider_trust_status(text, uuid, uuid) to authenticated, service_role;
grant execute on function public.provider_update_booking_status(uuid, text, text) to authenticated, service_role;
grant execute on function public.reschedule_owned_booking(uuid, date, time without time zone, text) to authenticated, service_role;
grant execute on function public.respond_to_owned_review(uuid, text) to authenticated, service_role;
grant execute on function public.super_admin_set_admin_membership_active(uuid, boolean) to authenticated, service_role;
grant execute on function public.super_admin_update_admin_scope(uuid, boolean, boolean) to authenticated, service_role;
grant execute on function public.update_marketplace_issue(uuid, text, text) to authenticated, service_role;
grant execute on function public.update_scoped_service_settings(uuid, uuid, uuid, uuid, boolean, boolean, text, boolean, boolean, smallint) to authenticated, service_role;

-- Preserve service-role execution for trigger functions for controlled maintenance and
-- keep their normal trigger execution path intact.
grant execute on function public.audit_provider_trust_event() to service_role;
grant execute on function public.emit_booking_notifications() to service_role;
grant execute on function public.emit_payment_notifications() to service_role;
grant execute on function public.ensure_provider_trust_state() to service_role;
grant execute on function public.log_booking_payment_event() to service_role;
grant execute on function public.notify_provider_of_review() to service_role;
grant execute on function public.sync_completed_booking_closeout() to service_role;

-- Fail the migration if a high-risk anonymous grant survives or if the intentionally
-- public marketplace helpers are accidentally removed.
do $$
begin
  if has_function_privilege('anon', 'public.admin_update_booking_payment(uuid,public.payment_status,text,text)', 'execute')
     or has_function_privilege('anon', 'public.super_admin_set_admin_membership_active(uuid,boolean)', 'execute')
     or has_function_privilege('anon', 'public.super_admin_update_admin_scope(uuid,boolean,boolean)', 'execute')
     or has_function_privilege('anon', 'public.provider_update_booking_status(uuid,text,text)', 'execute')
     or has_function_privilege('anon', 'public.reschedule_owned_booking(uuid,date,time without time zone,text)', 'execute') then
    raise exception 'Phase 15 RPC hardening failed: an anonymous mutation grant remains.';
  end if;

  if not has_function_privilege('anon', 'public.get_public_booking_conflicts(text,uuid,date,date)', 'execute')
     or not has_function_privilege('anon', 'public.provider_owner_is_verified(text,uuid,uuid)', 'execute')
     or not has_function_privilege('anon', 'public.provider_profile_is_complete(text,uuid,uuid)', 'execute')
     or not has_function_privilege('anon', 'public.provider_trust_allows_marketplace(text,uuid,uuid)', 'execute')
     or not has_function_privilege('anon', 'public.service_scope_is_launchable(uuid)', 'execute') then
    raise exception 'Phase 15 RPC hardening failed: a required public marketplace helper lost anonymous execution.';
  end if;
end;
$$;
