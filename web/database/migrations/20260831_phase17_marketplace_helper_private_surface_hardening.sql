-- Phase 17: move public marketplace readiness SECURITY DEFINER helpers behind the non-exposed private schema.
--
-- The four helpers below are internal launch/readiness predicates. Public service RLS, publish guards,
-- and server-side database functions depend on their function objects, so ALTER FUNCTION ... SET SCHEMA
-- lets PostgreSQL update those stored dependencies to private.* without weakening dynamic launch checks.
--
-- The Provider application directly calls provider_profile_is_complete() and service_scope_is_launchable().
-- Keep those two public RPC contracts as SECURITY INVOKER wrappers for authenticated/service-role callers.
-- provider_owner_is_verified() and provider_trust_allows_marketplace() have no direct application callers,
-- so their exposed public RPC names are intentionally removed.
--
-- Anonymous users receive USAGE on the non-exposed private schema and EXECUTE only on these four private
-- predicates because the public services RLS policy evaluates them for anonymous marketplace reads.
-- Other private Admin/RLS helpers retain their existing anonymous EXECUTE denial.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are untouched.

grant usage on schema private to anon;

alter function public.provider_owner_is_verified(text, uuid, uuid)
  set schema private;
alter function public.provider_profile_is_complete(text, uuid, uuid)
  set schema private;
alter function public.provider_trust_allows_marketplace(text, uuid, uuid)
  set schema private;
alter function public.service_scope_is_launchable(uuid)
  set schema private;

revoke all on function private.provider_owner_is_verified(text, uuid, uuid) from public;
revoke all on function private.provider_profile_is_complete(text, uuid, uuid) from public;
revoke all on function private.provider_trust_allows_marketplace(text, uuid, uuid) from public;
revoke all on function private.service_scope_is_launchable(uuid) from public;

grant execute on function private.provider_owner_is_verified(text, uuid, uuid)
  to anon, authenticated, service_role;
grant execute on function private.provider_profile_is_complete(text, uuid, uuid)
  to anon, authenticated, service_role;
grant execute on function private.provider_trust_allows_marketplace(text, uuid, uuid)
  to anon, authenticated, service_role;
grant execute on function private.service_scope_is_launchable(uuid)
  to anon, authenticated, service_role;

create function public.provider_profile_is_complete(
  p_provider_type text,
  p_professional_id uuid,
  p_business_id uuid
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.provider_profile_is_complete(
    p_provider_type,
    p_professional_id,
    p_business_id
  );
$$;

revoke all on function public.provider_profile_is_complete(text, uuid, uuid)
  from public, anon;
grant execute on function public.provider_profile_is_complete(text, uuid, uuid)
  to authenticated, service_role;

create function public.service_scope_is_launchable(p_service_id uuid)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.service_scope_is_launchable(p_service_id);
$$;

revoke all on function public.service_scope_is_launchable(uuid)
  from public, anon;
grant execute on function public.service_scope_is_launchable(uuid)
  to authenticated, service_role;

-- Preserve the existing service-role readiness JSON contract while teaching the helper gate
-- that the intended secure state is now: one intentional public booking RPC, no public owner/trust
-- helper RPCs, authenticated-only public wrappers for Provider callers, and private RLS predicates.
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
      and to_regprocedure('public.provider_owner_is_verified(text,uuid,uuid)') is null
      and to_regprocedure('public.provider_trust_allows_marketplace(text,uuid,uuid)') is null
      and not has_function_privilege('anon', 'public.provider_profile_is_complete(text,uuid,uuid)', 'execute')
      and not has_function_privilege('anon', 'public.service_scope_is_launchable(uuid)', 'execute')
      and has_function_privilege('authenticated', 'public.provider_profile_is_complete(text,uuid,uuid)', 'execute')
      and has_function_privilege('authenticated', 'public.service_scope_is_launchable(uuid)', 'execute')
      and has_schema_privilege('anon', 'private', 'usage')
      and has_function_privilege('anon', 'private.provider_owner_is_verified(text,uuid,uuid)', 'execute')
      and has_function_privilege('anon', 'private.provider_profile_is_complete(text,uuid,uuid)', 'execute')
      and has_function_privilege('anon', 'private.provider_trust_allows_marketplace(text,uuid,uuid)', 'execute')
      and has_function_privilege('anon', 'private.service_scope_is_launchable(uuid)', 'execute'),
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
      coalesce(
        (select p.active from public.platform_finance_policies p where p.currency = 'INR' limit 1),
        false
      )
  );
$$;

revoke execute on function public.platform_launch_readiness() from public, anon, authenticated;
grant execute on function public.platform_launch_readiness() to service_role;
