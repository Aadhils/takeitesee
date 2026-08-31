-- Phase 17: move the internal current-platform-user RLS helper out of the exposed public schema.
--
-- public.current_platform_user_id() is not called directly by the application. It is an
-- internal SECURITY DEFINER helper used by admin_audit_log RLS policies. Supabase recommends
-- keeping RLS SECURITY DEFINER helpers in a non-exposed schema and referencing them explicitly
-- from policies.
--
-- PostgreSQL tracks the policy dependency on the function object, so ALTER FUNCTION ... SET
-- SCHEMA updates the stored admin_audit_log policy expressions to private.current_platform_user_id()
-- without changing their authorization semantics.
--
-- Authenticated/service-role execution is preserved for policy/internal evaluation. Anonymous
-- execution remains denied. Existing Admin/Super Admin checks and audit-log ownership semantics
-- are unchanged.
--
-- Cashfree, payment, refund, payout, recovery, and finance functions/policies are untouched.

create schema if not exists private authorization postgres;

revoke all on schema private from public;
grant usage on schema private to authenticated, service_role;

alter function public.current_platform_user_id() set schema private;

revoke execute on function private.current_platform_user_id() from public, anon;
grant execute on function private.current_platform_user_id() to authenticated, service_role;
