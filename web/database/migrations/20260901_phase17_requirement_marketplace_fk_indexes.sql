-- Phase 17: add covering indexes for non-finance requirement marketplace foreign keys.
--
-- Supabase Performance Advisor identified these foreign keys as unindexed. Existing composite
-- indexes do not lead with the affected FK columns, so add simple btree indexes for referential
-- checks and requirement/proposal workflow joins without changing RLS, data, or application behavior.
--
-- Cashfree, payment, cash-collection, refund, payout, recovery, settlement, and finance columns,
-- indexes, activation, state, and configuration remain HOLD and are intentionally untouched.

create index if not exists customer_requirements_category_id_idx
  on public.customer_requirements using btree (category_id);

create index if not exists customer_requirements_location_id_idx
  on public.customer_requirements using btree (location_id);

create index if not exists customer_requirements_accepted_proposal_id_idx
  on public.customer_requirements using btree (accepted_proposal_id);

create index if not exists requirement_proposals_service_id_idx
  on public.requirement_proposals using btree (service_id);

create index if not exists requirement_proposal_events_requirement_id_idx
  on public.requirement_proposal_events using btree (requirement_id);
