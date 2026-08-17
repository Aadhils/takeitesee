-- Grants the minimum table privileges required for anon/authenticated to actually reach the
-- RLS policies already defined in 20260817_phase_production_foundation.sql. Enabling RLS does
-- not itself grant any privilege: Postgres checks table-level GRANT first, and only evaluates
-- RLS policies if that check passes. These tables had RLS policies but no matching GRANT, so
-- every query against them was rejected with "permission denied for table <name>" before RLS
-- was ever reached. Each grant below mirrors exactly one already-reviewed policy; auth.users
-- and service_role are untouched.
--
-- Safe to re-run: GRANT is idempotent in PostgreSQL.

grant usage on schema public to anon, authenticated;

-- users_select_self: for select to authenticated using (id = auth.uid())
grant select on public.users to authenticated;

-- customer_profiles_self: for all to authenticated using/with check (user_id = auth.uid())
grant select, insert, update, delete on public.customer_profiles to authenticated;

-- professionals_public_read: for select to anon, authenticated using (true)
grant select on public.professional_profiles to anon, authenticated;

-- businesses_public_read: for select to anon, authenticated using (true)
grant select on public.businesses to anon, authenticated;

-- services_public_read: for select to anon, authenticated using (active = true)
grant select on public.services to anon, authenticated;

-- bookings_select_owned / bookings_insert_owned: for select/insert to authenticated using/with check (customer_id = auth.uid())
grant select, insert on public.bookings to authenticated;

-- history_select_owned: for select to authenticated using (exists (... b.customer_id = auth.uid()))
grant select on public.booking_status_history to authenticated;
