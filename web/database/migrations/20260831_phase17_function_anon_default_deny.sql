-- Phase 17: make future postgres-owned function execution fail closed for anonymous callers.
--
-- PostgreSQL grants EXECUTE on newly created functions to PUBLIC by default. Supabase also
-- currently has explicit default EXECUTE grants for anon, authenticated, and service_role in
-- the public schema. This migration removes the built-in PUBLIC default and the public-schema
-- anon default while preserving the existing authenticated and service_role defaults.
--
-- Existing functions and their current grants are intentionally unchanged. Public marketplace
-- RPCs that already grant anon execution continue to work. Any future function that is meant to
-- be anonymously callable must opt in with an explicit GRANT EXECUTE ... TO anon in its migration.
--
-- Cashfree, payment, refund, payout, recovery, and finance functions/policies are untouched.

alter default privileges for role postgres
  revoke execute on functions from public;

alter default privileges for role postgres in schema public
  revoke execute on functions from anon;
