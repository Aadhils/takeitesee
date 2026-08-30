-- Phase 15: service-role-only, read-only database launch readiness probe.
-- This function does not elevate privileges and exposes no row data or secrets.

create or replace function public.platform_launch_readiness()
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select jsonb_build_object(
    'rpc_anon_mutations_closed',
      not has_function_privilege('anon', 'public.admin_update_booking_payment(uuid,public.payment_status,text,text)', 'execute')
      and not has_function_privilege('anon', 'public.super_admin_set_admin_membership_active(uuid,boolean)', 'execute')
      and not has_function_privilege('anon', 'public.super_admin_update_admin_scope(uuid,boolean,boolean)', 'execute')
      and not has_function_privilege('anon', 'public.provider_update_booking_status(uuid,text,text)', 'execute')
      and not has_function_privilege('anon', 'public.reschedule_owned_booking(uuid,date,time without time zone,text)', 'execute'),
    'trigger_rpc_surface_closed',
      not has_function_privilege('anon', 'public.emit_payment_notifications()', 'execute')
      and not has_function_privilege('authenticated', 'public.emit_payment_notifications()', 'execute')
      and not has_function_privilege('anon', 'public.emit_booking_notifications()', 'execute')
      and not has_function_privilege('authenticated', 'public.emit_booking_notifications()', 'execute')
      and not has_function_privilege('anon', 'public.log_booking_payment_event()', 'execute')
      and not has_function_privilege('authenticated', 'public.log_booking_payment_event()', 'execute'),
    'public_marketplace_helpers_available',
      has_function_privilege('anon', 'public.get_public_booking_conflicts(text,uuid,date,date)', 'execute')
      and has_function_privilege('anon', 'public.provider_owner_is_verified(text,uuid,uuid)', 'execute')
      and has_function_privilege('anon', 'public.provider_profile_is_complete(text,uuid,uuid)', 'execute')
      and has_function_privilege('anon', 'public.provider_trust_allows_marketplace(text,uuid,uuid)', 'execute')
      and has_function_privilege('anon', 'public.service_scope_is_launchable(uuid)', 'execute'),
    'inr_finance_policy_active',
      coalesce((select p.active from public.platform_finance_policies p where p.currency = 'INR' limit 1), false)
  );
$$;

revoke execute on function public.platform_launch_readiness() from public, anon, authenticated;
grant execute on function public.platform_launch_readiness() to service_role;
