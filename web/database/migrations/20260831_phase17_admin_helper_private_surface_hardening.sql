-- Phase 17: move core Admin authorization SECURITY DEFINER helpers behind the non-exposed private schema.
--
-- admin_can_manage(), admin_can_view(), is_active_admin(), and is_super_admin() are authorization
-- primitives used by RLS policies and privileged database RPCs. Their original function objects are moved
-- into private so stored RLS dependencies rebind automatically while preserving the authorization model.
--
-- Existing database function bodies (including finance functions that remain on HOLD) contain textual
-- public.* helper calls. Keep same-signature public SECURITY INVOKER compatibility wrappers so those bodies
-- continue to resolve without altering finance/payment/refund/payout/recovery code. Direct authenticated
-- EXECUTE on the public wrappers is removed; service_role retains diagnostic compatibility.
--
-- provider_trust_status() has no direct application caller. Move it private and update the already-private
-- marketplace trust predicate to call it directly, removing the exposed public RPC entirely.
--
-- Cashfree, payment, refund, payout, recovery, settlement, and finance activation/state are untouched.

alter function public.is_super_admin()
  set schema private;
alter function public.is_active_admin()
  set schema private;
alter function public.admin_can_view(uuid, uuid, uuid, uuid)
  set schema private;
alter function public.admin_can_manage(uuid, uuid, uuid, uuid)
  set schema private;
alter function public.provider_trust_status(text, uuid, uuid)
  set schema private;

revoke all on function private.is_super_admin() from public, anon;
revoke all on function private.is_active_admin() from public, anon;
revoke all on function private.admin_can_view(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function private.admin_can_manage(uuid, uuid, uuid, uuid) from public, anon;

grant execute on function private.is_super_admin()
  to authenticated, service_role;
grant execute on function private.is_active_admin()
  to authenticated, service_role;
grant execute on function private.admin_can_view(uuid, uuid, uuid, uuid)
  to authenticated, service_role;
grant execute on function private.admin_can_manage(uuid, uuid, uuid, uuid)
  to authenticated, service_role;

revoke all on function private.provider_trust_status(text, uuid, uuid)
  from public, anon, authenticated;
grant execute on function private.provider_trust_status(text, uuid, uuid)
  to service_role;

create or replace function private.provider_trust_allows_marketplace(
  p_provider_type text,
  p_professional_id uuid,
  p_business_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.provider_trust_status(
    p_provider_type,
    p_professional_id,
    p_business_id
  ) = 'normal';
$$;

-- Compatibility wrappers preserve textual public.* references inside existing SECURITY DEFINER RPC bodies.
-- They are not authenticated application endpoints.
create function public.is_super_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_super_admin();
$$;

revoke all on function public.is_super_admin() from public, anon, authenticated;
grant execute on function public.is_super_admin() to service_role;

create function public.is_active_admin()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.is_active_admin();
$$;

revoke all on function public.is_active_admin() from public, anon, authenticated;
grant execute on function public.is_active_admin() to service_role;

create function public.admin_can_view(
  p_application_id uuid default null,
  p_location_id uuid default null,
  p_category_id uuid default null,
  p_service_id uuid default null
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_can_view(
    p_application_id,
    p_location_id,
    p_category_id,
    p_service_id
  );
$$;

revoke all on function public.admin_can_view(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_can_view(uuid, uuid, uuid, uuid)
  to service_role;

create function public.admin_can_manage(
  p_application_id uuid default null,
  p_location_id uuid default null,
  p_category_id uuid default null,
  p_service_id uuid default null
)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.admin_can_manage(
    p_application_id,
    p_location_id,
    p_category_id,
    p_service_id
  );
$$;

revoke all on function public.admin_can_manage(uuid, uuid, uuid, uuid)
  from public, anon, authenticated;
grant execute on function public.admin_can_manage(uuid, uuid, uuid, uuid)
  to service_role;
