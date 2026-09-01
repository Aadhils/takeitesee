-- Launch readiness: add covering indexes for non-finance admin control-plane foreign keys.
--
-- Supabase Performance Advisor and a live catalog check identified these foreign keys as lacking
-- covering indexes. Add simple btree indexes for admin audit, membership creator, and scoped catalog
-- joins without changing RLS, permissions, data, admin scope behavior, or application behavior.
--
-- Cashfree, payment, cash-collection, refund, payout, recovery, settlement, and finance tables,
-- columns, indexes, activation, state, configuration, functions, and policies remain HOLD and are
-- intentionally untouched.

create index if not exists admin_audit_log_application_id_idx
  on public.admin_audit_log using btree (application_id);

create index if not exists admin_audit_log_location_id_idx
  on public.admin_audit_log using btree (location_id);

create index if not exists admin_memberships_created_by_idx
  on public.admin_memberships using btree (created_by);

create index if not exists admin_scopes_category_id_idx
  on public.admin_scopes using btree (category_id);

create index if not exists admin_scopes_created_by_idx
  on public.admin_scopes using btree (created_by);

create index if not exists admin_scopes_service_id_idx
  on public.admin_scopes using btree (service_id);
