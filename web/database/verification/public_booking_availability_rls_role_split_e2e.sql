-- Rollback-only verification for public booking availability RLS role split.
-- Run against the canonical database in a transaction. This script must leave no residue.

begin;

-- The regression is specifically that anonymous reads of these three tables must not require
-- Provider-owner-only columns such as professional_profiles.user_id.
set local role anon;
select count(*) as anon_service_availability_rows from public.service_availability;
select count(*) as anon_service_availability_window_rows from public.service_availability_windows;
select count(*) as anon_service_availability_blackout_rows from public.service_availability_blackouts;

reset role;

-- Authenticated reads must still compile under their owner/public policy union.
set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-000000000000', true);
select count(*) as authenticated_service_availability_rows from public.service_availability;
select count(*) as authenticated_service_availability_window_rows from public.service_availability_windows;
select count(*) as authenticated_service_availability_blackout_rows from public.service_availability_blackouts;

reset role;
rollback;
