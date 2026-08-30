-- Phase 15: extend the service-role-only launch probe with recent Cashfree sandbox E2E evidence.
-- A successful payment API verification and a signed webhook receipt are separate gates so webhook failures remain visible.

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
    'sandbox_payment_api_verified',
      exists (
        select 1
        from public.cashfree_sandbox_e2e_runs r
        where r.state = 'verified_success'
          and r.verified_at is not null
          and r.amount_minor = 100
          and r.currency = 'INR'
          and upper(coalesce(r.gateway_payment_status, '')) = 'SUCCESS'
          and r.created_at >= now() - interval '30 days'
      ),
    'sandbox_payment_webhook_verified',
      exists (
        select 1
        from public.cashfree_sandbox_e2e_runs r
        where r.state = 'verified_success'
          and r.verified_at is not null
          and r.webhook_received_at is not null
          and r.webhook_event_id is not null
          and r.amount_minor = 100
          and r.currency = 'INR'
          and upper(coalesce(r.gateway_payment_status, '')) = 'SUCCESS'
          and r.created_at >= now() - interval '30 days'
      ),
    'inr_finance_policy_active',
      coalesce((select p.active from public.platform_finance_policies p where p.currency = 'INR' limit 1), false)
  );
$$;

revoke execute on function public.platform_launch_readiness() from public, anon, authenticated;
grant execute on function public.platform_launch_readiness() to service_role;
